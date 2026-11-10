# Distributed RAG Ingestion Architecture with Celery & Pinecone

## 1. Executive Summary

Transitioning from in-process concurrency (`asyncio.gather` / OS threading in FastAPI) to a distributed task queue (Celery + Redis) enables resilient, horizontally scalable ingestion for large documents (800–1000+ pages).

This document evaluates the proposed distributed architecture, identifies critical bottlenecks, outlines the corrected distributed sequence, and details trade-offs and best practices.

---

## 2. Evaluation of Proposed Flow

### Proposed Concept
1. Extract the entire 1,000-page PDF content in the dispatcher.
2. The dispatcher splits the extracted text into 100-page jobs and pushes them to Celery.
3. Workers pull jobs, chunk, embed, and upsert vectors into Pinecone.
4. Use Celery's `chord` primitive to trigger an acknowledgment when all 1,000 pages complete.

---

### Critical Architecture Flaw & Remediation

#### The Flaw: Centralized Extraction Bottleneck
Extracting text across all 1,000 pages on the dispatcher/API layer creates three severe points of friction:
1. **Dispatcher CPU Freeze:** Reading and parsing 1,000 pages of PDF data consumes significant CPU and RAM, freezing the FastAPI event loop or API thread.
2. **Message Broker Bloat:** Pushing 100 pages of raw extracted text and chunk objects into Redis or RabbitMQ inflates broker memory usage. Message brokers are optimized for lightweight pointers, IDs, and metadata—not megabytes of serialized text.
3. **Loss of Extraction Parallelism:** Text extraction itself is not parallelized, nullifying a major performance benefit of a multi-worker setup.

#### The Corrected Sequence: Distributed Page-Range Slices
Instead of serializing extracted text into the queue, pass **page-range boundaries and the document reference**:

```
FastAPI / Dispatcher (Lightweight)
  │
  ├─► Inspects PDF metadata: Total Pages = 1,000 (PyMuPDF: ~5ms)
  ├─► Calculates slices: (1-100), (101-200), (201-300), ..., (901-1000)
  └─► Dispatches Celery Chord:
           │
           ├── Task 1: {file_url, start: 1, end: 100}   ──► [Worker 1: Extract -> Chunk -> Embed -> Pinecone]
           ├── Task 2: {file_url, start: 101, end: 200} ──► [Worker 2: Extract -> Chunk -> Embed -> Pinecone]
           ├── ...
           └── Task 10: {file_url, start: 901, end: 1000}──► [Worker 10: Extract -> Chunk -> Embed -> Pinecone]
                                 │
                         (When all 10 finish)
                                 ▼
                        [Callback Task: chord]
                                 │
                                 └─► Trigger Acknowledgment (DB update / WebSocket / Webhook)
```

---

## 3. Comprehensive Pros and Cons

### Pros

1. **Process & Machine Isolation:**
   * Workers run in dedicated operating system processes or separate containers/virtual machines.
   * Heavy CPU operations (PDF parsing, regex chunking) do not block the FastAPI API loop or contend for Python's Global Interpreter Lock (GIL).

2. **Granular Fault Tolerance & Automatic Retries:**
   * If Worker 4 fails (e.g., transient network drop or temporary rate limit on pages 301–400), Celery retries *only that specific 100-page slice* via exponential backoff without discarding the other 900 processed pages.

3. **Elastic Horizontal Scalability:**
   * When ingestion traffic spikes, your web layer remains responsive.
   * Worker instances can scale dynamically (e.g., via AWS ECS/EKS auto-scaling or KEDA) to drain the queue without touching the API code.

4. **Guaranteed Synchronization via `chord`:**
   * Celery's `chord` primitive handles distributed state management natively. It tracks individual task completions in Redis and executes the final completion callback only after all sub-tasks return successfully.

5. **Elimination of Shared Session Collisions:**
   * Each Celery worker maintains an independent connection pool to Pinecone and embedding providers, preventing the `session closed` errors common to shared async clients in event loops.

---

### Cons & Operational Considerations

1. **Infrastructure Overhead:**
   * Requires provisioning and monitoring a message broker (RabbitMQ or Redis) and a results backend (Redis) for Celery chords.
   * Requires managing deployment pipelines and monitoring for separate worker processes.

2. **File Storage Accessibility:**
   * Because workers may execute across separate containers or physical servers, local disk paths (e.g., `/tmp/document.pdf`) cannot be shared reliably.
   * **Mitigation:** Store PDFs in cloud object storage (S3, MinIO, GCS) and pass a pre-signed URL or download stream to workers.

3. **External API Rate Limits (Pinecone & Nomic):**
   * Running 10 workers simultaneously means 10 concurrent clients hitting downstream embedding models and vector databases.
   * **Mitigation:** Configure task-level rate limits (`rate_limit="20/m"`) or tune Celery worker concurrency to align with your API plan tier.

4. **Handling Partial Failures in Chords:**
   * By default, if any worker task permanently fails, the final `chord` callback will not fire.
   * **Mitigation:** Attach an error callback (`link_error`) to handle failures explicitly and update the document state to `FAILED`.

---

## 4. Reference Implementation Pattern

### Celery Tasks Definition (`tasks.py`)

```python
import logging
from celery import Celery
import fitz  # PyMuPDF
import httpx

logger = logging.getLogger(__name__)

celery_app = Celery(
    "rag_ingestion",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1"
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_pdf_slice(self, file_url: str, start_page: int, end_page: int, doc_id: str):
    """
    Extracts text for assigned pages, chunks, embeds, and upserts to Pinecone.
    """
    try:
        logger.info(f"Processing pages {start_page}-{end_page} for doc: {doc_id}")
        
        # 1. Fetch file bytes
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(file_url)
            resp.raise_for_status()
            pdf_bytes = resp.content

        # 2. Extract slice text using PyMuPDF
        extracted_chunks = []
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page_num in range(start_page - 1, min(end_page, doc.page_count)):
                page_text = doc[page_num].get_text()
                if page_text.strip():
                    extracted_chunks.append({
                        "page": page_num + 1,
                        "content": page_text
                    })

        # 3. Chunk text, generate embeddings via Nomic, and upsert to Pinecone
        # ... (Embed & Upsert logic here) ...

        return {
            "doc_id": doc_id,
            "range": [start_page, end_page],
            "chunks_count": len(extracted_chunks),
            "status": "SUCCESS"
        }

    except Exception as exc:
        logger.error(f"Error processing slice {start_page}-{end_page}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task
def document_ingestion_complete(results, doc_id: str):
    """
    Final callback executed when all parallel tasks in the chord complete.
    """
    total_chunks = sum(item.get("chunks_count", 0) for item in results)
    logger.info(f"Ingestion finished for doc {doc_id}. Total chunks: {total_chunks}")

    # Update database status to READY and broadcast notification
    return {
        "doc_id": doc_id,
        "total_chunks": total_chunks,
        "status": "READY"
    }
```

### Dispatching from FastAPI (`main.py`)

```python
from fastapi import FastAPI
from celery import chord
import fitz
import httpx
from tasks import celery_app, process_pdf_slice, document_ingestion_complete

app = FastAPI()

PAGES_PER_TASK = 100

@app.post("/documents/ingest")
async def trigger_distributed_ingestion(file_url: str, doc_id: str):
    # Quickly inspect page count without downloading full content into local memory
    async with httpx.AsyncClient() as client:
        head_resp = await client.get(file_url)
        with fitz.open(stream=head_resp.content, filetype="pdf") as doc:
            total_pages = doc.page_count

    # Construct page ranges
    page_slices = [
        (start, min(start + PAGES_PER_TASK - 1, total_pages))
        for start in range(1, total_pages + 1, PAGES_PER_TASK)
    ]

    # Create task headers for the chord
    header = [
        process_pdf_slice.s(file_url, start, end, doc_id)
        for start, end in page_slices
    ]

    callback = document_ingestion_complete.s(doc_id=doc_id)

    # Launch distributed chord
    workflow = chord(header)(callback)

    return {
        "job_id": workflow.id,
        "doc_id": doc_id,
        "total_pages": total_pages,
        "total_slices": len(page_slices),
        "status": "QUEUED"
    }
```

---

## 5. Architectural Summary

* **Do not extract text before pushing to the queue:** Pass file references and page ranges so workers extract in parallel without choking the message broker with text blobs.
* **Celery `chord` is the right primitive:** It offers built-in distributed synchronization, firing the acknowledgment callback only when all batch tasks return.
* **Infrastructure trade-off:** This pattern eliminates in-process async session bugs and memory leaks at the cost of requiring Redis and worker fleet management.