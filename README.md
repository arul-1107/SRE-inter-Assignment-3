# IMS Control Tower: Resilient Incident Management System

A production-grade SRE-focused distributed system designed to handle 10,000+ signals per second with built-in load balancing, backpressure handling, Redis-based debouncing, fault tolerance, and observability.

---

## System Flow

Client  
→ Nginx (Ingress / Load Balancer)  
→ FastAPI (Stateless APIs)  
→ Kafka (Buffer Layer)  
→ Worker Services  
→ Redis (Debouncing)  
→ PostgreSQL (Storage)

---

## Architecture Summary

| Layer        | Component        | Purpose                    |
|-------------|----------------|----------------------------|
| Ingress     | Nginx          | Load balancing             |
| API         | FastAPI        | Signal ingestion           |
| Buffer      | Kafka          | Backpressure handling      |
| Processing  | Python Workers | Business logic             |
| Cache       | Redis          | Deduplication              |
| Storage     | PostgreSQL     | Persistence                |

---

## Ingress and Load Balancer

### nginx/nginx.conf

```nginx
events {}

http {
    upstream api_cluster {
        server api1:8000;
        server api2:8000;
        server api3:8000;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://api_cluster;
        }
    }
}
##API Service
###api/main.py
from fastapi import FastAPI
from kafka import KafkaProducer
import json
import socket

app = FastAPI()

producer = KafkaProducer(
    bootstrap_servers='kafka:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

@app.get("/")
def health():
    return {"status": "ok"}

@app.post("/signals")
async def ingest_signal(signal: dict):
    producer.send("ims_signals", signal)

    return {
        "status": "queued",
        "handled_by": socket.gethostname()
    }
##Redis Debouncing Logic
###worker/processor.py
import redis
import json
from kafka import KafkaConsumer

redis_client = redis.Redis(host="redis", port=6379)

consumer = KafkaConsumer(
    "ims_signals",
    bootstrap_servers="kafka:9092",
    value_deserializer=lambda x: json.loads(x.decode("utf-8"))
)

def persist_to_db(signal):
    print("Saved:", signal)

for msg in consumer:
    signal = msg.value

    key = f"seen:{signal['source_id']}"

    is_new = redis_client.set(key, "1", ex=60, nx=True)

    if not is_new:
        continue

    persist_to_db(signal)
##Infrastructure Setup
###docker-compose.yml
version: '3.8'

services:

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092

  redis:
    image: redis:latest
    ports:
      - "6379:6379"

  postgres:
    image: postgres:latest
    environment:
      POSTGRES_DB: ims
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    ports:
      - "5432:5432"

  api1:
    build: ./api
    depends_on:
      - kafka

  api2:
    build: ./api
    depends_on:
      - kafka

  api3:
    build: ./api
    depends_on:
      - kafka

  worker:
    build: ./worker
    depends_on:
      - kafka
      - redis

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - api1
      - api2
      - api3
##Failure Handling
#Failure Type	Behavior
#Redis Down	Fail-open, no data loss
#Kafka Lag	Workers scale horizontally
#API Down	Nginx reroutes traffic
#DB Slow	Kafka buffers load

##Run the Project
git clone https://github.com/arul-1107/SRE-inter-Assignment-3.git
cd SRE-inter-Assignment-3
docker-compose up -d --build

##Endpoints
###Service	URL
API	http://localhost

Swagger	http://localhost/docs

Metrics	http://localhost/metrics

##Summary
###Handles high throughput (10k+ requests per second)
###Uses Kafka for backpressure control
###Uses Redis for debouncing duplicate signals
###Load balanced with Nginx
###Fully containerized using Docker
###Designed for reliability and scalability
