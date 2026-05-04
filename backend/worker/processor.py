import asyncio
import json
import os
import ast
import redis.asyncio as aioredis
import psycopg2
from aiokafka import AIOKafkaConsumer

# Configuration from environment
KAFKA_INSTANCE = os.getenv("KAFKA_BROKER", "kafka:9092")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
DB_CONFIG = {
    "dbname": "ims_db",
    "user": "user",
    "password": "password",
    "host": "postgres"
}

async def process_signals():
    # 1. Initialize Consumer with 'earliest' to catch backlog signals
    consumer = AIOKafkaConsumer(
        "ingest-topic",
        bootstrap_servers=KAFKA_INSTANCE,
        group_id="ims-worker-group-v3",  # Incremented group to reset offsets
        auto_offset_reset="earliest"
    )

    # 2. Initialize Redis for High-Performance Debouncing
    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    
    # 3. Initialize Postgres Connection for Relational Linking
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cursor = conn.cursor()

    await consumer.start()
    print("🚀 Worker active. Listening for signals on Kafka...")

    try:
        async for msg in consumer:
            try:
                raw_data = msg.value.decode("utf-8")
                
                # Robust Parsing: Handle standard JSON and Python-style strings
                try:
                    payload = json.loads(raw_data)
                except json.JSONDecodeError:
                    # Fallback for strings like {'source_id': 'xyz'}
                    payload = ast.literal_eval(raw_data)
                
                # Flexible lookup to ensure source_id is captured
                source_id = payload.get("source_id") or payload.get("id")
                
                if not source_id:
                    print(f"⚠️ Skipping invalid payload: {payload}")
                    continue

                # --- REQUIREMENT 2.A: DEBOUNCING LOGIC ---
                # Check Redis cache (High-performance NoSQL lookup)
                is_duplicate = await redis.get(f"seen:{source_id}")

                if is_duplicate:
                    print(f"⏭️ Skipping duplicate signal: {source_id}")
                    continue

                # --- REQUIREMENT 2.B: RELATIONAL LINKING ---
                print(f"📥 Processing unique signal: {source_id}")
                
                # Cache in Redis for 60 seconds to prevent double-processing
                await redis.setex(f"seen:{source_id}", 60, "true")

                # Final Relational Persistance in PostgreSQL
                cursor.execute(
                    "INSERT INTO work_items (source_id, status) VALUES (%s, %s)",
                    (source_id, "OPEN")
                )
                print(f"✅ Successfully persisted {source_id} to Postgres.")

            except Exception as e:
                print(f"❌ Error processing message: {e}")

    finally:
        await consumer.stop()
        cursor.close()
        conn.close()

if __name__ == "__main__":
    asyncio.run(process_signals())
