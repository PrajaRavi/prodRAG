import redis
import json
import time

def run_subscriber(channel_name = "doc_status:doc_101"):
    # 1. Connect to Redis (DB index does not matter; Pub/Sub is server-global)
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    
    # 2. Instantiate the pubsub manager
    pubsub = client.pubsub()
    
    
    # 3. Subscribe to the channel
    pubsub.subscribe(channel_name)
    print(f"[*] Subscribed to '{channel_name}'. Waiting for events... (Press Ctrl+C to exit)")

    # 4. Listen for messages
    try:
        # listen() blocks until a new message arrives from Redis
        for message in pubsub.listen():
            # Redis sends an initial handshake message with type='subscribe'
            if message["type"] == "subscribe":
                print(f"[i] Successfully connected to channel: {message['channel']}")
                continue

            if message["type"] == "message":
                channel = message["channel"]
                raw_data = message["data"]
                
                payload = json.loads(raw_data)
                print(f"\n[+] Received Event on {channel}:")
                print(f"    Status:  {payload.get('status')}")
                print(f"    Payload: {payload}")
                
                # If this indicates completion, exit listener
                if payload.get("status") in ["SUCCESS", "FAILED"]:
                    print("[*] Document processing finalized. Closing subscription.")
                    break

    except KeyboardInterrupt:
        print("\n[*] Gracefully stopping subscriber...")
    finally:
        # 5. Clean up connection
        pubsub.unsubscribe(channel_name)
        pubsub.close()
        print("[*] Unsubscribed and closed connection.")

# if __name__ == "__main__":
#     run_subscriber()
