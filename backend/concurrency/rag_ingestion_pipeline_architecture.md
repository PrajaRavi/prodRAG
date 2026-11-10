# End-to-End RAG Ingestion Pipeline: Execution & Concurrency Deep Dive

This document details how our hybrid FastAPI architecture processes multiple document uploads concurrently without freezing the server.

---

## 1. Scenario: Concurrent Upload of Two Documents

To understand the interaction between the **AsyncIO Event Loop**, the **CPU ThreadPool**, and **External APIs**, consider this scenario:

* **Document A:** `big_manual.pdf` (800 pages, ~3,200 chunks, heavy CPU parsing).
* **Document B:** `short_invoice.pdf` (2 pages, ~8 chunks, quick parsing).

Both requests arrive from the frontend at almost the exact same millisecond ($T_0$).

---

## 2. High-Level Architecture Flowchart

```
                          Frontend Client
                 (Concurrent Axios / Fetch Uploads)
                        │                 │
           POST Doc A   │                 │   POST Doc B
           (800 pages)  ▼                 ▼   (2 pages)
      ┌─────────────────────────────────────────────────────────┐
      │               FastAPI AsyncIO Event Loop                │
      │                  (Single Main Thread)                   │
      │                                                         │
      │  • Validates URL / HMAC tokens (Fast, Async)            │
      │  • Dispatches heavy CPU task to `run_in_executor()`     │
      │  • Immediately yields control back to event loop        │
      └──────────────┬───────────────────────────┬──────────────┘
                     │                           │
          Offload Doc A Task          Offload Doc B Task
                     │                           │
                     ▼                           ▼
      ┌─────────────────────────────────────────────────────────┐
      │         `cpu_pool` (ThreadPoolExecutor - 5 Workers)     │
      │                                                         │
      │   [Worker 1] Busy: Extracting & Chunking Doc A (800p)   │
      │   [Worker 2] Free ──► Picks up Doc B (2p) ──► Done (1s) │
      │   [Worker 3] Idle                                       │
      │   [Worker 4] Idle                                       │
      │   [Worker 5] Idle                                       │
      └──────────────────────────────────────────┬──────────────┘
                                                 │
                               Doc B finishes in 1 sec
                                                 │
                                                 ▼
      ┌─────────────────────────────────────────────────────────┐
      │               FastAPI AsyncIO Event Loop                │
      │              (Resumes Doc B Task via await)             │
      │                                                         │
      │  • Batches 8 chunks for Nomic Cloud API                 │
      │  • Awaits Pinecone Upsert (Async/Non-blocking)          │
      │  • Returns HTTP 200 for Doc B in ~2-3 seconds!          │
      │                                                         │
      │  *(Meanwhile, Worker 1 is still parsing Doc A chunks)*  │
      └─────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Execution Timeline

| Timestamp | AsyncIO Event Loop (Main Thread) | `cpu_pool` Worker 1 | `cpu_pool` Worker 2 | External Services (Nomic / Pinecone) |
| :--- | :--- | :--- | :--- | :--- |
| **$T_0$** | Receives `POST /api/...` for **Doc A** and **Doc B**. | Idle | Idle | Idle |
| **$T_1$** | Validates URLs and signatures. Calls `run_in_executor()` for Doc A, then Doc B. | Assigned **Doc A** (Starts PDF extraction). | Assigned **Doc B** (Starts PDF extraction). | Idle |
| **$T_2$** | **Yields control.** Main thread is free to handle new requests or health checks. | Grinding through pages 1–50 of Doc A. | Finishes 2 pages of Doc B and generates 8 chunks. | Idle |
| **$T_3$** | **Awakens for Doc B.** `await` on Worker 2 resolves. Prepares Nomic embedding call. | Grinding through pages 51–150 of Doc A. | **Done.** Returns to idle pool. | Receives Doc B chunks for embedding. |
| **$T_4$** | Awaits Pinecone upsert for Doc B vectors. | Still processing Doc A. | Idle | Pinecone indexes Doc B vectors. |
| **$T_5$ (3s)** | **Doc B completes!** Returns `HTTP 200` to frontend. | Still processing Doc A (~Page 300). | Idle | Doc B is queryable in vector DB. |
| **...** | Handles ordinary web traffic. | Still chunking Doc A. | Idle | Idle |
| **$T_{70}$ (70s)** | **Doc A finishes parsing.** Worker 1 returns 3,200 chunks. Event loop resumes Doc A. | **Done.** Returns to idle pool. | Idle | Receives concurrent batches of Doc A embeddings. |
| **$T_{85}$ (85s)** | Batches Doc A vectors and finishes Pinecone upsert. Returns `HTTP 200` for Doc A. | Idle | Idle | Doc A is queryable in vector DB. |

---

## 4. Code Breakdown: What Happens Under the Hood?

### Phase 1: The Event Loop & Non-Blocking Dispatch

```python
# In FastAPI endpoint or service
loop = asyncio.get_running_loop()

# 1. Non-blocking validation on the main loop
if not urlparse(file_path).scheme:
    _validate_local_file(file_path, max_size_mb)

# 2. THE HANDOFF: loop.run_in_executor()
chunks = await loop.run_in_executor(
    cpu_pool,                     # The pool of 5 worker threads
    _sync_extract_and_chunk,      # Pure synchronous, CPU-heavy function
    file_path,
    loader_func,
    user_id,
    conversation_id,
    600,
)
```

#### What happens during `loop.run_in_executor`?
1. **Task Packaging:** The event loop packages `_sync_extract_and_chunk` along with its arguments into an internal `concurrent.futures.Future`.
2. **Enqueueing:** It pushes this package into `cpu_pool`'s task queue.
3. **Suspension (`await`):** The `await` keyword halts execution of *this specific coroutine*, but **not the thread**. The event loop switches immediately to other pending tasks (such as starting Document B).

---

### Phase 2: CPU-Bound Execution in the Thread Pool

```python
def _sync_extract_and_chunk(file_path, loader_func, user_id, conversation_id, chunk_size):
    # This runs inside an OS thread (e.g., 'rag_ingest_cpu_0')
    raw_docs = loader_func(file_path)             # PDF parsing (Heavy CPU/disk)
    chunks = doc_chunking(chunk_size, raw_docs)   # Recursive text splitting (Heavy CPU)
    return chunks
```

* **No GIL Blocking for C-based PDF loaders:** High-performance parsers (like PyMuPDF or pypdfium2) release Python's GIL during text extraction, enabling parallel execution across CPU cores.
* **Isolation:** If Doc A takes 60 seconds of CPU time, it is isolated in Worker 1. Worker 2 picks up Doc B, completes in 1 second, and leaves the pool without waiting for Worker 1.

---

### Phase 3: Resuming on the Event Loop for Network I/O

Once `_sync_extract_and_chunk` returns the list of chunks:
1. The thread pool marks the `Future` as complete.
2. The event loop wakes up the suspended coroutine.
3. The remaining operations (cloud embedding & database writes) are **I/O-bound**, which run on the event loop:

```python
# 3. Vector DB Upsert (Network I/O)
# Runs via non-blocking async network sockets back on the event loop
result = await update_vector_store(chunks)
return result
```

---

## 5. What If We Didn't Use `run_in_executor`? (The Anti-Pattern)

If `loader_func` and `doc_chunking` were called directly inside an `async def` function without `run_in_executor`:

```
                       Without run_in_executor (Head-of-Line Blocking)

Time ───►
Main Thread: [ Doc A (800p) Chunking: 70 seconds ] ──► [ Doc B (2p): 1s ] ──► [ Doc B Done ]
             ▲                                         ▲
             Doc A & B arrive here                     Doc B was forced to wait 70s!
```

* **Server Freeze:** The single-threaded event loop would be blocked for 70 seconds by Document A.
* **Starvation:** Document B (a simple 2-page invoice) would hang for over a minute, even though it only needed 1 second of actual processing.
* **Timeout Errors:** The frontend might hit an HTTP 504 Gateway Timeout on Document B.

---

## 6. Summary of Component Responsibilities

| Component | Technology | Primary Role |
| :--- | :--- | :--- |
| **API Layer** | FastAPI (`async def`) | Manages incoming HTTP requests, route authorization, and returns responses. |
| **Event Loop** | Python `asyncio` | Orchestrates concurrent tasks, handles network I/O, and coordinates worker handoffs. |
| **Worker Pool** | `ThreadPoolExecutor(max_workers=5)` | Absorbs CPU spikes from PDF reading, regex splitting, and token counting. |
| **Embedding Engine**| Nomic Cloud API | Transforms chunked text into dense vector representations over HTTPS. |
| **Vector Store** | Pinecone | Persists and indexes vector embeddings with namespaces and metadata. |