import json
import redis
import time
import psycopg2
from kafka import KafkaConsumer

# Configuration
KAFKA_TOPIC = "ims_signals"
REDIS_CONFIG = {"host": "redis", "port": 6379, "decode_responses": True}
DB_CONFIG = {
    "host": "postgres",
    "database": "ims_db",
    "user": "user",
    "password": "password"
}

def connect_kafka():
    while True:
        try:
            consumer = KafkaConsumer(
                KAFKA_TOPIC,
                bootstrap_servers='kafka:9092',
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                auto_offset_reset='earliest',
                group_id='ims-consumer-group'
            )
            print("✅ Kafka Connected!")
            return consumer
        except Exception as e:
            print(f"Waiting for Kafka: {e}")
            time.sleep(3)

def main():
    print("🚀 Consumer Starting...")
    r = redis.Redis(**REDIS_CONFIG)
    consumer = connect_kafka()

    for message in consumer:
        signal = message.value
        source_id = signal.get('source_id', 'UNKNOWN')
        print(f"📥 Received signal: {source_id}")

        try:
            # 1. Update Dashboard Metrics (Redis)
            r.incr("total_ingress")
            r.incr("persisted_count")
            
            # 2. Persist to Database (Postgres)
            conn = psycopg2.connect(**DB_CONFIG)
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO work_items (source_id, event, severity, created_at) VALUES (%s, %s, %s, NOW())",
                (source_id, signal.get('event', 'none'), signal.get('severity', 3))
            )
            conn.commit()
            cur.close()
            conn.close()
            
            print(f"✨ Synced {source_id} to Dashboard and Database")
            
        except Exception as e:
            print(f"⚠️ Sync Error: {e}")

if __name__ == "__main__":
    main()
