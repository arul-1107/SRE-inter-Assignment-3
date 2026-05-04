import requests
import time
import concurrent.futures

# Configuration - Updated to explicit IPv4 for Docker-to-Host stability
API_URL = "http://127.0.0.1:8000/ingest"
TOTAL_SIGNALS = 150
STATION_ID = "RDBMS_PRIMARY_01"

def send_signal(i):
    payload = {
        "station_id": STATION_ID,
        "signal_type": "HEARTBEAT",
        "value": 100 + i,
        "timestamp": time.time()
    }
    try:
        # Targeting the FastAPI ingestion gateway
        response = requests.post(API_URL, json=payload, timeout=5)
        return response.status_code
    except Exception as e:
        return f"Error: {e}"

def run_load_test():
    print(f"🚀 Starting Load Test: Sending {TOTAL_SIGNALS} signals to {STATION_ID}...")
    print(f"Targeting: {API_URL}")
    
    results = []
    start_time = time.time()

    # Using threads to simulate a burst of signals to test rate limiting (Req 4)
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(send_signal, i) for i in range(TOTAL_SIGNALS)]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    end_time = time.time()
    duration = end_time - start_time

    # Analyze Status Codes
    success = results.count(200) + results.count(201) + results.count(202)
    rate_limited = results.count(429)
    errors = len([r for r in results if str(r).startswith("Error")])

    print("\n" + "="*30)
    print("📊 LOAD TEST RESULTS")
    print("="*30)
    print(f"Total Requests:   {TOTAL_SIGNALS}")
    print(f"Successful:       {success}")
    print(f"Rate Limited:     {rate_limited} (Status 429)")
    print(f"Network Errors:   {errors}")
    print(f"Total Duration:   {duration:.2f} seconds")
    print("="*30)

    if success > 0:
        print(f"✅ Success! {success} signals reached the API.")
    
    if rate_limited > 0:
        print("✅ Requirement 4 (Rate Limiting) Verified: 429 errors detected.")
    else:
        print("⚠️ No 429s. If you expect rate limiting, check your Redis/Middleware config.")

    print("\nFinal Step: Verify Requirement 2.A (Debouncing) in Postgres.")

if __name__ == "__main__":
    run_load_test()
