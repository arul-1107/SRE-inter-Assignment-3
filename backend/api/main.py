import os
import asyncio
import redis
import asyncpg
import socket  # Added for hostname reporting
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Config
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
DB_URL = os.getenv("DATABASE_URL", "postgresql://user:password@postgres:5432/ims_db")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = None
db_pool = None

@app.on_event("startup")
async def startup():
    global redis_client, db_pool
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)

    for _ in range(10):
        try:
            db_pool = await asyncpg.create_pool(dsn=DB_URL)
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS signals (
                        id SERIAL PRIMARY KEY,
                        source_id TEXT,
                        type TEXT,
                        value FLOAT,
                        status TEXT DEFAULT 'OPEN',
                        priority TEXT DEFAULT 'LOW',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        resolved_at TIMESTAMP
                    );
                """)
            break
        except Exception:
            await asyncio.sleep(2)

@app.get("/metrics")
async def get_metrics():
    ingress = redis_client.get("kafka_ingress_total") or 0
    persisted = 0
    avg_mttr = "0s"

    if db_pool:
        async with db_pool.acquire() as conn:
            persisted = await conn.fetchval("SELECT COUNT(*) FROM signals")
            seconds = await conn.fetchval("""
                SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))), 0)
                FROM signals WHERE resolved_at IS NOT NULL
            """)
            avg_mttr = f"{round(seconds, 1)}s"

    return {
        "ingress": int(ingress),
        "persisted": int(persisted),
        "cache_active": redis_client.dbsize(),
        "avg_mttr": avg_mttr,
        "hostname": socket.gethostname()  # Now correctly returns the Container ID
    }

@app.get("/incidents")
async def get_incidents():
    if not db_pool: return []
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM signals ORDER BY created_at DESC LIMIT 50")
        return [dict(r) for r in rows]

@app.post("/signals")
async def create_signal(data: dict):
    device_id = data.get("device_id")
    redis_client.incr("kafka_ingress_total")
    
    if not device_id:
        return {"status": "error", "message": "device_id is required"}

    is_new_signal = redis_client.set(f"debounce:{device_id}", "active", nx=True, ex=30)

    if is_new_signal:
        if db_pool:
            async with db_pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO signals (source_id, type, value, priority) VALUES ($1, $2, $3, $4)",
                    device_id, data.get("type"), data.get("value"), data.get("priority", "LOW")
                )
        return {"status": "success", "action": "persisted"}
    
    return {"status": "success", "action": "debounced"}

@app.post("/rca")
async def resolve_incident(rca: dict):
    incident_id = rca.get("incident_id")
    if db_pool and incident_id:
        async with db_pool.acquire() as conn:
            await conn.execute(
                "UPDATE signals SET status='RESOLVED', resolved_at=NOW() WHERE id=$1",
                int(incident_id)
            )
    return {"status": "resolved"}
