# Celery PDF Ingestion and Task Optimization Guide

---

## Question 1: How can I download a PDF file for a specific page range without downloading the full PDF at once using PyMuPDF?

**PyMuPDF (fitz) itself cannot perform partial downloads over HTTP.** It is an in-memory/on-disk parsing library, not an HTTP streaming client. 

Furthermore, because of the internal binary architecture of standard PDF files, **true byte-range slicing without an indexed server is almost impossible**.

---

### The Underlying Problem: How PDFs Are Structured

A PDF is not an append-only stream of pages like a video or MP3 file:
1. **The Cross-Reference (`xref`) Table:** The index mapping page numbers to their byte offsets is located at the **very end of the PDF file**.
2. **Scattered Objects:** Page 10 might reference font dictionaries, images, or shared vector objects located at byte offset 200 (near the beginning) or byte offset 5,000,000 (near the end).
3. If you simply use an HTTP `Range: bytes=X-Y` header to fetch the middle 500 KB, PyMuPDF will fail with:
   ```text
   fitz.FileDataError: cannot find startxref
   ```

---

### The Two Practical Solutions

Depending on whether you control the file storage or your backend server, here are the two standard production patterns:

---

### Pattern 1: Cache Locally Once, Slice Instantly in Memory (Recommended)

Instead of downloading the entire file over and over across multiple Celery workers, download the PDF **once** to disk, then use PyMuPDF to extract only the target pages into an in-memory document.

Extracting 50–100 pages from a local PDF into memory takes **less than 10 milliseconds**:

```python
import fitz  # PyMuPDF
import io

def extract_pdf_page_range(local_pdf_path: str, start_page: int, end_page: int) -> bytes:
    """
    Extracts pages [start_page, end_page] from a cached local PDF 
    and returns a clean, standalone PDF as raw bytes.
    (Pages are 1-indexed for the caller).
    """
    with fitz.open(local_pdf_path) as src_doc:
        total_pages = len(src_doc)
        
        # Convert to 0-indexed bounds
        from_page = max(0, start_page - 1)
        to_page = min(total_pages - 1, end_page - 1)
        
        # Create a blank in-memory document
        sub_doc = fitz.open()
        
        # Fast pointer copy: copies page definitions and their referenced assets only
        sub_doc.insert_pdf(src_doc, from_page=from_page, to_page=to_page)
        
        # Save directly to bytes in memory (garbage=3 cleans unneeded fonts/images)
        pdf_bytes = sub_doc.tobytes(garbage=3, deflate=True)
        sub_doc.close()
        
    return pdf_bytes
```

#### Why this works best in Celery:
* The original 6MB file is downloaded **once** by the dispatcher into `/tmp/{doc_id}.pdf`.
* Worker tasks do not touch ImageKit or network sockets.
* PyMuPDF opens the local file descriptor directly without saturating network buffers.

---

### Pattern 2: Byte-Range Request via "Linearized" (Web-Optimized) PDFs

If you **must** download only specific pages from an external HTTP server without downloading the full file, the PDF **must be linearized** (also known as *"Fast Web View"*).

A linearized PDF reorders the binary tree:
* The first ~1 KB contains a `Linearization Parameter Dictionary` and a `Hint Stream`.
* The hint stream contains the exact byte offsets for every individual page and its associated fonts/images.

#### How to consume a linearized PDF over HTTP using `httpx` + PyMuPDF:

```python
import httpx
import fitz

def fetch_linearized_header(url: str) -> bytes:
    # 1. Fetch the first 32 KB containing the linearization table and hint stream
    headers = {"Range": "bytes=0-32768"}
    response = httpx.get(url, headers=headers)
    return response.content

# Note:
# PyMuPDF expects a complete xref tree to reconstruct document objects.
# To parse arbitrary page ranges via pure range requests over HTTP, 
# you typically pass a custom stream handler (or mount via HTTP VFS).
```

> **Important Caveat for ImageKit / Cloud Storage:** Standard uploaded PDFs from Word or export tools are **not linearized by default**. Without running a linearization tool (`qpdf --linearize` or `mutool clean -l`) on the PDF before uploading it to ImageKit, HTTP Range requests cannot know which byte ranges correspond to pages 50–100.

---

### Summary Recommendation for Your Pipeline

For your RAG pipeline with 6MB documents:
1. **Download the PDF once** when the upload API route is hit, writing it to `/tmp/{doc_id}.pdf`.
2. Pass `file_path = f"/tmp/{doc_id}.pdf"` to each slice task.
3. In each Celery worker, use PyMuPDF's `fitz.open(file_path)` and iterate directly over `doc[start_page : end_page]`.
4. Delete `/tmp/{doc_id}.pdf` in the chord callback once all workers finish.

---

## Question 2: Explain `worker_prefetch_multiplier=1` and `task_acks_late=True`

These two settings form the core of **fair task distribution** and **crash resiliency** in Celery. Together, they stop a single heavy user from monopolizing your worker fleet and prevent tasks from being lost if a worker dies.

---

### 1. `worker_prefetch_multiplier = 1`

#### What It Controls
Prefetching determines **how many tasks a worker process pulls from Redis into its local memory buffer in advance**, before it has finished its current task.

The formula Celery uses to calculate total buffer capacity is:
$$\text{Prefetched Tasks} = \text{Worker Concurrency} \times \text{worker\_prefetch\_multiplier}$$

#### Default Behavior (`multiplier = 4`)
If you run a Celery worker with `--concurrency=3` and the default multiplier of `4`:
* The worker immediately grabs $3 \times 4 = 12$ tasks from Redis into local RAM.
* **The Starvation Problem:** When User 1 uploads a 700-page document splitting into 8 slices, your worker immediately pulls all 8 slices into its private queue. When User 2 uploads a document 1 second later, User 2’s tasks are stuck in Redis because your worker has already reserved and hoarded all 8 of User 1's tasks—even though it can only process 3 at a time.

#### With `worker_prefetch_multiplier = 1`
* Each worker process only grabs **1 task at a time**.
* A worker will execute Task A, and only when Task A is practically finished will it pull Task B from Redis.
* **The Result:** User 1's slices remain in Redis. As workers become free, they pull from the front of the queue. If User 2 submits tasks, they enter the queue and get picked up round-robin/interleaved with User 1's remaining tasks instead of waiting for all 8 slices of User 1 to finish.

---

### 2. `task_acks_late = True`

#### What It Controls
This setting defines **when** the worker sends the acknowledgment (`ACK`) message back to the Redis broker.

#### Default Behavior (`task_acks_late = False`, Early Ack)
* As soon as a worker grabs a task off the queue (even before it starts running Python code), it sends an `ACK` to Redis.
* Redis immediately deletes the task message from the queue.
* **The Failure Mode:** If the worker runs out of memory (OOM), crashes, gets terminated by Docker, or loses power midway through chunking page 50, **the task is gone forever**. The chord counter will never hit zero, the callback will never run, and your SSE stream will hang waiting indefinitely.

#### With `task_acks_late = True` (Late Ack)
* The worker keeps the message unacknowledged in Redis while it executes.
* It only sends the `ACK` to Redis **after the task function successfully returns or raises an handled exception**.
* **The Result:** If the worker crashes mid-execution (e.g., killed by OS due to memory pressure or container reboot), Redis recognizes that the worker disconnected without acknowledging the task. The task is preserved and automatically re-queued for another worker to pick up and finish.

---

### Why They Must Be Used Together

| Configuration | What Happens Under Concurrency |
| :--- | :--- |
| **Defaults** (`multiplier=4`, `acks_late=False`) | Worker hoards tasks into RAM upfront, locking out other users. If the process crashes mid-task, the document fails silently and permanently. |
| **`multiplier=1` alone** | Prevents hoarding, but a crash during embedding still permanently drops the slice. |
| **Both Enabled** (`multiplier=1` + `acks_late=True`) | **Fair dispatching across multiple users** (idle workers pull 1 task at a time) + **Zero data loss** (crashed tasks return to the queue for a retry). |