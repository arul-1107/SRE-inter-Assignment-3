import requests
import time
import concurrent.futures

# Target the Nginx Load Balancer listening on port 80
API_URL = "http://127.0.0.1:80/signals"
TOTAL_SIGNALS = 150
STATION_ID = "RDBMS_PRIMARY_01"

def send_signal(i):
    payload = {
        "device_id": STATION_ID,
        "type": "HEARTBEAT",
        "value": 100 + i,
        "priority": "LOW"
    }
    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        return response
    except Exception as e:
        return f"Error: {e}"

def run_load_test():
    print(f"🚀 Starting Load Test: Sending {TOTAL_SIGNALS} signals to {STATION_ID}...")
    print(f"Targeting Load Balancer: {API_URL}")
    
    start_time = time.time()
    persisted = 0
    debounced = 0
    network_errors = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(send_signal, i) for i in range(TOTAL_SIGNALS)]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            
            if isinstance(res, requests.Response):
                if res.status_code == 200:
                    try:
                        data = res.json()
                        if data.get("action") == "persisted":
                            persisted += 1
                        elif data.get("action") == "debounced":
                            debounced += 1
                    except Exception:
                        pass
                else:
                    network_errors += 1
            else:
                network_errors += 1
                
    duration = time.time() - start_time
    
    print("\n" + "="*30)
    print("📊 LOAD TEST RESULTS")
    print("="*30)
    print(f"Total Requests Sent: {TOTAL_SIGNALS}")
    print(f"Persisted to DB:     {persisted}")
    print(f"Debounced by Redis:  {debounced}")
    print(f"Network / Errors:    {network_errors}")
    print(f"Total Duration:      {duration:.2f} seconds")
    print("="*30)
    
    if persisted == 1 and debounced > 0:
        print("✅ Requirement 2.A (Debouncing) Verified: Only 1 unique signal written, others debounced.")
    else:
        print("⚠️ Unexpected behavior. Check backend logs.")

if __name__ == "__main__":
    run_load_test()
