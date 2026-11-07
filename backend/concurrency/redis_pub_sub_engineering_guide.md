# Engineering Guide: Building a Redis Pub/Sub System

As software systems grow, services inevitably need to communicate in real time without becoming tightly coupled. In distributed architectures, **Publish/Subscribe (Pub/Sub)** is one of the foundational patterns for decoupling event producers from event consumers.

This guide breaks down how Redis Pub/Sub works under the hood, how it differs from task queues like Celery, and how to implement a clean, production-grade Pub/Sub pattern using Python.

---

## 1. Mental Model: What is Redis Pub/Sub?

In a traditional request-response model, **Service A** calls **Service B** directly via HTTP or RPC. Service A must know Service B's network address, wait for its response, and handle network timeouts if Service B is slow or down.

In **Pub/Sub**, publishers and subscribers never talk to each other directly:

* **Publisher:** Emits a message to a named topic called a **Channel** (e.g., `doc_status:doc_999`). It does not know or care who is listening.
* **Broker (Redis):** Acts as a high-speed routing hub. It receives the message and immediately broadcasts a copy to all active listeners.
* **Subscriber:** Registers interest in one or more channels (e.g., `SUBSCRIBE doc_status:doc_999`). When a message arrives on that channel, Redis pushes it to the subscriber over an open TCP socket.

```
                  ┌──────────────────────┐
                  │      Publisher       │
                  │ (e.g., Celery Task)  │
                  └──────────┬───────────┘
                             │ PUBLISH channel payload
                             ▼
                  ┌──────────────────────┐
                  │    Redis Server      │
                  │ (Routing & Fan-out)  │
                  └──────┬────────┬──────┘
                         │        │
       Broadcasts to ALL │        │ active subscribers
                         ▼        ▼
       ┌──────────────────┐      ┌──────────────────┐
       │   Subscriber 1   │      │   Subscriber 2   │
       │ (FastAPI SSE/WS) │      │ (Audit Log / DB) │
       └──────────────────┘      └──────────────────┘
```

---

## 2. Pub/Sub vs. Message Queues (Celery/Redis Lists)

Before writing code, you must understand a critical architectural distinction: **Redis Pub/Sub is not a queue.**

| Feature | Redis Task Queue (Celery / LPUSH) | Redis Pub/Sub (PUBLISH / SUBSCRIBE) |
| :--- | :--- | :--- |
| **Delivery Model** | **Point-to-Point (1-to-1):** Exactly one worker pulls and processes a message. | **Fan-Out (1-to-Many):** Every connected subscriber receives the message simultaneously. |
| **Persistence** | **Persistent:** Messages sit safely in Redis RAM/disk until a worker claims them. | **Fire-and-Forget (Ephemeral):** Messages exist only during in-flight delivery. |
| **Offline Handling** | If all workers are down, messages wait in the queue indefinitely. | If no subscriber is listening when an event is published, **the message is permanently lost**. |
| **Primary Use Case** | Long-running asynchronous execution (PDF processing, email sending). | Real-time event notifications (chat, live UI state updates, telemetry). |

> **Architectural Takeaway:** Use Celery queues to **execute work**. Use Redis Pub/Sub to **announce that work finished**.

---

## 3. Core Redis Pub/Sub Commands

Under the hood, Redis manages Pub/Sub using a minimal set of internal socket-level primitives:

1. `SUBSCRIBE <channel>`: Puts the client connection into listening mode for specific channels.
2. `PUBLISH <channel> <message>`: Broadcasts `<message>` to `<channel>` and returns an integer indicating how many clients received it.
3. `UNSUBSCRIBE <channel>`: Stops listening to `<channel>`.
4. `PSUBSCRIBE <pattern>`: Pattern-matching subscription (e.g., `PSUBSCRIBE doc_status:*` listens to status events across *all* documents).

---

## 4. Minimal Implementation: Sync Publisher & Subscriber

Let's build a standalone proof-of-concept using `redis-py`.

### Prerequisites

```bash
pip install redis
```

Ensure a local Redis instance is running on port 6379:
```bash
redis-server
```

---

### Step A: The Subscriber (`subscriber_demo.py`)

The subscriber opens a persistent TCP connection to Redis, subscribes to a channel, and enters a blocking loop listening for events.

```python
import redis
import json
import time

def run_subscriber():
    # 1. Connect to Redis (DB index does not matter; Pub/Sub is server-global)
    client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    
    # 2. Instantiate the pubsub manager
    pubsub = client.pubsub()
    
    channel_name = "doc_status:doc_101"
    
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

if __name__ == "__main__":
    run_subscriber()
```

---

### Step B: The Publisher (`publisher_demo.py`)

The publisher connects to Redis, emits a JSON payload to the specified channel, and disconnects.

```python
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
```

---

### How to Test This Setup

1. Open **Terminal 1** and start the subscriber:
   ```bash
   python subscriber_demo.py
   ```
   *Terminal 1 will print:* `[*] Subscribed to 'doc_status:doc_101'. Waiting for events...`

2. Open **Terminal 2** and run the publisher:
   ```bash
   python publisher_demo.py
   ```
   *Terminal 2 will output:* `[+] Published event to 'doc_status:doc_101'. Active listeners reached: 1`

3. Look back at **Terminal 1**: it immediately processes the message, prints the payload, and cleanly shuts down.

---

## 5. Integrating Pub/Sub with Celery and FastAPI

Now let's apply this directly to your distributed PDF ingestion pipeline.

```
[ Celery Worker Task ]                 [ Redis ]               [ FastAPI (Async Loop) ]           [ Frontend (Browser) ]
  chord callback finishes                 │                              │                                  │
  └─► client.publish("doc_status:123") ──►│                              │                                  │
                                          │──► pubsub receives event ───►│                                  │
                                          │                               └─► yields SSE chunk "data: ..." ─►│
                                          │                                                                  └─► UI updates!
```

### 1. The Worker Callback (Synchronous Publisher)

Celery tasks run synchronously in worker processes, so use standard synchronous `redis.Redis`:

```python
# tasks.py
import json
import redis
from celery import shared_task

# Dedicated Redis client for event publishing
redis_publisher = redis.Redis(host="localhost", port=6379, db=2, decode_responses=True)

@shared_task
def document_ready_callback(results: list, doc_id: str):
    """Fires when all chord slices finish in Pinecone."""
    total_chunks = sum(item.get("chunks_upserted", 0) for item in results)

    # 1. Update your primary database state (PostgreSQL / MongoDB)
    # db.documents.update_one({"id": doc_id}, {"$set": {"status": "READY"}})

    # 2. Broadcast the completion event over Redis Pub/Sub
    event = {
        "event": "DOCUMENT_INGESTION_COMPLETED",
        "doc_id": doc_id,
        "total_chunks": total_chunks,
        "status": "READY"
    }

    channel = f"doc_status:{doc_id}"
    redis_publisher.publish(channel, json.dumps(event))
    
    return event
```

---

### 2. The FastAPI Endpoint (Asynchronous Subscriber & SSE Stream)

FastAPI runs on an asynchronous event loop (`asyncio`). To avoid blocking the web server thread while waiting for a message, use `redis.asyncio`:

```python
# main.py
import asyncio
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

app = FastAPI()

REDIS_URL = "redis://localhost:6379/2"

async def document_event_generator(doc_id: str):
    """
    Subscribes to the document's Redis channel and yields Server-Sent Events (SSE).
    """
    async_redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = async_redis.pubsub()
    channel = f"doc_status:{doc_id}"

    await pubsub.subscribe(channel)

    try:
        while True:
            # Non-blocking fetch with 1-second timeout to allow loop cancellation
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message and message["type"] == "message":
                data = message["data"]
                
                # Format required by SSE standard: "data: <payload>\n\n"
                yield f"data: {data}\n\n"

                payload = json.loads(data)
                if payload.get("status") in ["READY", "FAILED"]:
                    # Ingestion is complete; exit the generator to close the HTTP stream
                    break

            # Cooperative yield to prevent event loop starvation
            await asyncio.sleep(0.1)

    except asyncio.CancelledError:
        # Triggered if client closes the browser or disconnects early
        print(f"[*] Client disconnected from stream: {channel}")
    finally:
        # Mandatory cleanup: unsubscribe and return connection to pool
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await async_redis.aclose()


@app.get("/api/documents/stream/{doc_id}")
async def stream_document_status(doc_id: str):
    """
    HTTP endpoint consumed by browser EventSource.
    """
    return StreamingResponse(
        document_event_generator(doc_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Prevents Nginx from buffering SSE chunks
        }
    )
```

---

### 3. Frontend Client (Browser EventSource)

The browser uses the native `EventSource` API—no external libraries needed:

```javascript
function trackDocumentIngestion(docId) {
  const eventSource = new EventSource(`/api/documents/stream/${docId}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("Received status update:", data);

    if (data.status === "READY") {
      eventSource.close(); // Close HTTP connection
      updateUIStatus("Document ready! You can now query your knowledge base.");
      enableChatInput();
    } else if (data.status === "FAILED") {
      eventSource.close();
      showErrorNotification("Ingestion failed. Please try again.");
    }
  };

  eventSource.onerror = (err) => {
    console.error("Stream connection dropped:", err);
    eventSource.close();
  };
}
```

---

## 6. Senior Engineer Checklist: Production Pitfalls & Hardening

When deploying Redis Pub/Sub in high-traffic production environments, watch out for these operational challenges:

### 1. The "Missed Event" Race Condition
* **Problem:** If the Celery chord callback executes and publishes to Redis **before** the user's browser opens the SSE connection, the subscriber misses the event entirely (because Pub/Sub does not buffer or persist messages).
* **Fix (Rehydration Guard):** In your FastAPI streaming endpoint, query your database **first**:
  ```python
  # Check if document already completed before opening the stream
  doc = await db.documents.find_one({"id": doc_id})
  if doc and doc["status"] == "READY":
      yield f"data: {json.dumps({'status': 'READY'})}\n\n"
      return
  ```

### 2. Slow Consumer Buffer Overflow
* **Problem:** If a subscriber reads messages slower than the publisher produces them, Redis buffers unread messages in memory (`client-output-buffer-limit pubsub`). If this limit is breached, Redis forcefully disconnects the slow subscriber.
* **Fix:** Keep Pub/Sub payloads small (metadata, IDs, status flags). Never send entire document text or embedding arrays over Pub/Sub.

### 3. Connection Leaks
* **Problem:** Every open `EventSource` or WebSocket holds an active connection open in Redis and FastAPI.
* **Fix:** Always wrap your subscription in a `try...finally` block that calls `pubsub.unsubscribe()` and `pubsub.close()`. Add a stream timeout (e.g., terminate after 5 minutes if no event is received).

### 4. When to Use Redis Streams Instead
If your system demands:
* Guaranteed delivery (subscribers can reconnect and fetch missed events from 10 minutes ago).
* Consumer group acking (multiple backend workers dividing events).

Upgrade from **Redis Pub/Sub** to **Redis Streams (`XADD`, `XREADGROUP`)**. For basic real-time status notifications to a frontend UI, standard Redis Pub/Sub combined with an SSE endpoint is lighter, faster, and simpler to maintain.