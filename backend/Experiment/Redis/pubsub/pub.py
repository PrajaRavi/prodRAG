import redis
import json
import time

def run_publisher():
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    channel_name = "doc_status:doc_101"

    print("[*] Simulating background ingestion...")
    time.sleep(2)  # Simulating processing delay

    event_payload = {
        "doc_id": "doc_101",
        "status": "SUCCESS",
        "total_chunks": 1420,
        "message": "Pinecone upsert completed across all slices."
    }

    # Publish message to channel
    # The return value is the count of active subscribers that received the message
    receivers_count = client.publish(channel_name, json.dumps(event_payload))

    print(f"[+] Published event to '{channel_name}'.")
    print(f"    Active listeners reached: {receivers_count}")

if __name__ == "__main__":
    run_publisher()
