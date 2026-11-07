# Complete Guide to Celery: Concepts, Workflow, and Core Methods

---

## 1. What is Celery?

**Celery** is an open-source, distributed asynchronous task queue and job scheduler for Python. It allows developers to offload time-consuming, resource-intensive, or scheduled tasks out of the main request-response cycle into background worker processes running across one or many machines.

### Why Celery is Needed
Web frameworks like FastAPI, Flask, or Django are optimized for handling high-throughput, short-lived HTTP requests (typically resolving within 50–200 milliseconds). If a user initiates an operation that takes 30 seconds to several minutes (such as parsing a 1,000-page PDF, generating embeddings, rendering video, or training a model):
* Running it synchronously blocks the server worker thread entirely.
* Running it inside `asyncio` still shares CPU time and memory space with all incoming web requests, making it vulnerable to process crashes, memory limits, and the Python Global Interpreter Lock (GIL).

Celery solves this by decoupling **task dispatching** (performed instantly by your web server) from **task execution** (performed independently by dedicated worker processes).

---

## 2. Core Components of a Celery Ecosystem

A Celery system relies on four primary components:

1. **The Client (Producer):** Your application code (e.g., FastAPI route handler) that defines and dispatches tasks.
2. **The Message Broker:** A middleware service (most commonly **Redis** or **RabbitMQ**) that maintains the queues holding task messages until a worker retrieves them.
3. **The Worker Pool (Consumer):** One or more standalone OS daemon processes running on single or multiple machines that listen to the queue, deserialize the task payloads, execute the Python code, and report progress.
4. **The Results Backend:** A persistent data store (e.g., Redis, PostgreSQL, Memcached) where Celery saves return values, errors, stack traces, and completion states (`PENDING`, `STARTED`, `SUCCESS`, `FAILURE`).

---

## 3. End-to-End Execution Flow

Below is the complete lifecycle of a Celery task from HTTP request initiation to final status retrieval.

### Architecture Flow Diagram

```
[ User / Frontend Client ]
          │
          │ 1. POST /ingest/start (Initiates heavy job)
          ▼
┌────────────────────────────────────────────────────────┐
│ FastAPI Application (The Producer)                     │
│                                                        │
│  • Generates Task Parameters / IDs                     │
│  • Serializes Task Call to JSON                        │
│  • Dispatches using .delay() or .apply_async()         │
└───────────────────────┬────────────────────────────────┘
                        │
                        │ 2. Enqueue Message (Task ID, Name, Args)
                        ▼
┌────────────────────────────────────────────────────────┐
│ Message Broker (Redis DB 0 / RabbitMQ)                 │
│                                                        │
│   Queue: [ Task Payload #1 ] [ Task Payload #2 ] ...   │
└───────────────────────┬────────────────────────────────┘
                        │
                        │ 3. Fetch/Prefetch Task Message
                        ▼
┌────────────────────────────────────────────────────────┐
│ Celery Worker Daemon (The Consumer / Worker Fleet)     │
│                                                        │
│  • Unpacks Task Arguments                              │
│  • Executes Work (PyMuPDF, Chunking, Pinecone Upsert)  │
│  • Captures Return Value or Exception                  │
└───────────────────────┬────────────────────────────────┘
                        │
                        │ 4. Write Execution Result & Status
                        ▼
┌────────────────────────────────────────────────────────┐
│ Results Backend (Redis DB 1 / PostgreSQL)              │
│                                                        │
│   Key: celery-task-meta-<task_id>                      │
│   Value: { "status": "SUCCESS", "result": {...} }      │
└───────────────────────▲────────────────────────────────┘
                        │
                        │ 5. GET /tasks/{task_id} (Poll / Check status)
[ User / Frontend Client ]
```

### Step-by-Step Flow Description
1. **Trigger:** The client sends an HTTP request to FastAPI.
2. **Serialization & Enqueue:** FastAPI packages the task metadata (e.g., task name `tasks.process_pdf_range`, function arguments, unique `task_id`) into JSON and pushes it to the Redis queue.
3. **Immediate Acknowledgment:** FastAPI returns HTTP `202 Accepted` along with the `task_id` to the client in less than 10ms.
4. **Execution:** A worker process claims the message from Redis, runs the Python function, and handles any internal retries.
5. **State Storage:** When execution finishes, the worker serializes the return value into the Results Backend under the key `celery-task-meta-<task_id>`.
6. **Query:** The client or coordinator inspects status and output using `AsyncResult(task_id)`.

---

## 4. Basic Project Setup

Below is a complete, minimal, and fully runnable setup.

### Directory Structure
```text
celery_project/
├── celery_app.py      # Celery instance configuration
├── tasks.py           # Task definitions
└── main.py            # FastAPI entry point
```

### 1. Configuration (`celery_app.py`)
```python
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# broker is used for queues (DB 0); backend stores return values (DB 1)
celery_app = Celery(
    "rag_pipeline",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1"
)

# Optional recommended production configurations
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Drop task results after 24 hours to prevent memory bloat in Redis
    result_expires=86400,
    # Workers prefetch 1 task at a time (essential for long-running jobs)
    worker_prefetch_multiplier=1,
    # Acknowledge task only AFTER completion so failed workers don't drop tasks
    task_acks_late=True,
)
```

### 2. Task Definitions (`tasks.py`)
```python
import time
import logging
from celery_app import celery_app

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def process_pdf_slice(self, doc_id: str, start_page: int, end_page: int):
    """Simulates extracting, chunking, and upserting a page range."""
    try:
        logger.info(f"Starting processing for Doc {doc_id}: pages {start_page}-{end_page}")
        
        # Simulate processing duration
        time.sleep(2) 
        
        return {
            "doc_id": doc_id,
            "pages": [start_page, end_page],
            "chunks_upserted": (end_page - start_page + 1) * 2,
            "status": "COMPLETED"
        }
    except Exception as exc:
        logger.error(f"Error on doc {doc_id} pages {start_page}-{end_page}: {exc}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))
```

### 3. FastAPI Endpoint (`main.py`)
```python
from fastapi import FastAPI, HTTPException
from celery.result import AsyncResult
from celery_app import celery_app
from tasks import process_pdf_slice

app = FastAPI(title="Distributed Ingestion Service")

@app.post("/tasks/start")
def trigger_task(doc_id: str, start: int, end: int):
    # Enqueue task non-blockingly
    task = process_pdf_slice.delay(doc_id, start, end)
    return {"task_id": task.id, "status": "QUEUED"}

@app.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "state": result.state,  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
    }
    
    if result.state == "SUCCESS":
        response["result"] = result.result
    elif result.state == "FAILURE":
        response["error"] = str(result.info)
        
    return response
```

### Running the System
1. **Start Redis Server:**
   ```bash
   redis-server
   ```
2. **Start Celery Worker (in a separate terminal):**
   ```bash
   celery -A tasks worker --loglevel=info --concurrency=4
   celery -A tasks worker --loglevel=info --pool=threads -c 5
   after -A celery_app_path->this is the path of the file where celery app is initilized not the task files 
   so the flow will be like using this path celery_app is initilized and since we already mantion the path of task file so it will automatically connect with task file
   ```
3. **Start FastAPI:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

## 5. Core Methods & Canvas Workflows Explained

Celery provides a variety of invocation methods and composition primitives collectively known as the **Canvas**.

---

### Method 1: `.delay(*args, **kwargs)`
* **Definition:** A shorthand wrapper around `.apply_async()`. It sends the task to the default queue with default parameters.
* **When to Use:** Standard, straightforward background jobs where you do not need custom countdowns, alternative queues, or specific expiration windows.

#### Code Example
```python
from tasks import process_pdf_slice

# Dispatches immediately with positional arguments
task = process_pdf_slice.delay("doc_101", 1, 100)

print("Task Enqueued. Generated ID:", task.id)
```

---

### Method 2: `.apply_async(args=(), kwargs={}, ...)`
* **Definition:** The fundamental dispatch method in Celery. It gives explicit control over execution timing, queue routing, priority, and deadlines.
* **Key Parameters:**
  * `countdown`: Delay execution by $N$ seconds.
  * `eta`: Absolute `datetime` when the task should run.
  * `expires`: Revoke task if not started before this deadline.
  * `queue`: Route to an isolated queue (e.g., `"high_priority"`, `"heavy_gpu"`).
  * `retry`: Fine-grained dispatch retry configuration.
* **When to Use:** Timed notifications, rate-limited outbound operations, priority queues, and scheduled tasks.

#### Code Example
```python
from datetime import datetime, timedelta, timezone
from tasks import process_pdf_slice

# 1. Run 30 seconds into the future
task_delayed = process_pdf_slice.apply_async(
    args=["doc_102", 101, 200],
    countdown=30
)

# 2. Route to a specific priority queue with an expiration timestamp
task_priority = process_pdf_slice.apply_async(
    kwargs={"doc_id": "doc_urgent", "start_page": 1, "end_page": 50},
    queue="high_priority",
    expires=datetime.now(timezone.utc) + timedelta(minutes=10)
)
```

---

### Method 3: Signatures: `.s(*args, **kwargs)` and `.signature()`
* **Definition:** A **Signature** wraps task arguments, execution options, and a task function into a single object that can be passed around, chained, serialized, or bundled into workflows before being dispatched.
* **When to Use:** Building blocks for complex pipelines (`group`, `chain`, `chord`).

#### Code Example
```python
from tasks import process_pdf_slice

# Create a signature without executing it yet
task_sig = process_pdf_slice.s("doc_103", 201, 300)

# You can pass task_sig into other functions or execute it later
async_result = task_sig.apply_async()
```

---

### Method 4: `group` (Parallel Execution)
* **Definition:** Takes a collection of task signatures and executes them in parallel across available workers.
* **When to Use:** Independent parallel jobs that do not depend on one another and do not require a single combined callback.

#### Code Example
```python
from celery import group
from tasks import process_pdf_slice

# Create parallel signatures for different page ranges
job_group = group([
    process_pdf_slice.s("doc_large", 1, 100),
    process_pdf_slice.s("doc_large", 101, 200),
    process_pdf_slice.s("doc_large", 201, 300),
    process_pdf_slice.s("doc_large", 301, 400),
])

# Dispatch all 4 in parallel
group_result = job_group.apply_async()

# Check overall readiness across the group
print("All finished?", group_result.ready())
print("Completed count:", group_result.completed_count())
```

---

### Method 5: `chain` (Sequential Pipelines)
* **Definition:** Links tasks together sequentially so that the output of task $N$ becomes the first argument of task $N+1$.
* **When to Use:** Multi-step pipelines where each step strictly depends on the artifact produced by the previous step (e.g., Download $\rightarrow$ Clean $\rightarrow$ OCR $\rightarrow$ Index).

#### Code Example
```python
from celery import chain
from celery_app import celery_app

@celery_app.task
def download_pdf(file_url: str):
    return {"file_path": "/tmp/downloaded.pdf", "pages": 100}

@celery_app.task
def extract_metadata(download_info: dict):
    # Receives the dictionary returned by download_pdf
    return f"Doc with {download_info['pages']} pages ready."

# Chain execution: download_pdf runs -> passes output -> extract_metadata runs
pipeline = chain(
    download_pdf.s("https://example.com/document.pdf"),
    extract_metadata.s()
)

result = pipeline.apply_async()
```

---

### Method 6: `chord` (Parallel Execution + Synchronized Callback)
* **Definition:** A barrier synchronization pattern. A `chord` consists of a **header** (a group of tasks executed in parallel) and a **callback** (a single task executed only after *all* header tasks finish successfully).
* **Return Behavior:** The callback receives a list containing the return values of all header tasks in order.
* **Requirement:** Must have a configured Celery Results Backend (Redis, Database).
* **When to Use:** Ingestion pipelines, map-reduce workloads, multi-page document parsing where a final "Ready" notification must trigger once all slices are uploaded.

#### Code Example
```python
from celery import chord
from celery_app import celery_app
from tasks import process_pdf_slice

@celery_app.task
def document_ready_callback(results: list, doc_id: str):
    """
    Executed ONLY after all process_pdf_slice tasks finish.
    results = [
        {"doc_id": "doc_999", "pages": [1, 100], "chunks_upserted": 200, ...},
        {"doc_id": "doc_999", "pages": [101, 200], "chunks_upserted": 200, ...},
        ...
    ]
    """
    total_chunks = sum(item["chunks_upserted"] for item in results)
    
    # Notify database, send WebSocket message to user, etc.
    return {
        "doc_id": doc_id,
        "total_chunks_stored": total_chunks,
        "status": "DOCUMENT_READY_FOR_ANALYSIS"
    }

# 1. Define header tasks (Parallel slices)
header = [
    process_pdf_slice.s("doc_999", 1, 100),
    process_pdf_slice.s("doc_999", 101, 200),
    process_pdf_slice.s("doc_999", 201, 300),
]

# 2. Define callback
callback = document_ready_callback.s(doc_id="doc_999")

# 3. Dispatch the chord
chord_job = chord(header)(callback)
print("Chord Job ID:", chord_job.id)
```

---

## 6. Canvas Method Comparison Reference

| Method / Primitive | Execution Style | Output Flow | Common Use Case |
| :--- | :--- | :--- | :--- |
| **`.delay()`** | Single task | Single output | Fire-and-forget background jobs |
| **`.apply_async()`** | Single task | Single output | Delayed execution, queue routing, retry policies |
| **`group`** | Parallel ($N$ tasks) | List of outputs | Bulk independent operations (e.g., resizing 100 images) |
| **`chain`** | Sequential ($1 \rightarrow 2 \rightarrow 3$) | Piped input $\rightarrow$ output | Multi-stage data pipelines (Fetch $\rightarrow$ Transform $\rightarrow$ Load) |
| **`chord`** | Parallel header + 1 Join callback | Aggregated list $\rightarrow$ callback | Map-reduce, multi-slice PDF ingestion with final completion signal |

---

## 7. Production Best Practices for Celery

1. **Avoid Passing Large Payloads to Tasks:**
   Never pass large files, dataframes, or large text strings inside `args` or `kwargs`. Serializing 50MB of PDF text into Redis degrades broker memory and throughput. Pass storage keys, URLs, or database primary keys instead:
   ```python
   # Anti-pattern:
   process_pdf.delay(raw_pdf_bytes)

   # Recommended pattern:
   process_pdf.delay(s3_file_key="uploads/contracts/doc_1.pdf")
   ```

2. **Always Set `worker_prefetch_multiplier = 1` for Long Tasks:**
   By default, Celery pre-allocates 4 tasks per worker thread. If Worker A is given 4 long PDF tasks, while Worker B is idle, tasks will sit stalled in Worker A’s local queue. Setting `prefetch_multiplier=1` guarantees fair distribution.

3. **Make Tasks Idempotent:**
   Because Celery may re-deliver a message if a worker reboots mid-job (`task_acks_late=True`), ensure running the same task twice with identical arguments produces the exact same outcome without corrupting state.

4. **Always Set Time Limits:**
   Prevent rogue infinite loops from permanently blocking worker slots:
   ```python
   @celery_app.task(time_limit=300, soft_time_limit=240)
   def robust_task():
       ...
   ```