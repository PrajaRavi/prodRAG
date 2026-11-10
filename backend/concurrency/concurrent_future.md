# Mastering Python's `concurrent.futures` Package

```text

Practical Rule of Thumb for Your Architecture
If your task is I/O-bound or calls C/C++ compiled libraries that release the GIL (like NumPy, OpenCV, or parts of PyCryptodome

Use ThreadPoolExecutor. It is lightweight, shares memory, and starts instantly.

If your task does heavy, raw Python CPU processing (like reading/parsing a 1,000-page PDF document via pure Python loops, regex parsing, and token counting):

A ThreadPoolExecutor will prevent the FastAPI event loop from freezing, which solves your immediate issue.

However, if you want maximum processing speed across multiple CPU cores, you should use ProcessPoolExecutor (or a dedicated background queue like Celery/ARQ running separate worker processes).
```
## 1. What is `concurrent.futures` and Why Does It Exist?

Python provides several concurrency primitives:
* Low-level threading: `threading.Thread`, `_thread`
* Low-level multiprocessing: `multiprocessing.Process`, `multiprocessing.Queue`
* Cooperative multitasking: `asyncio`

Before Python 3.2, coordinating worker pools, tracking job status, catching thread exceptions, and collecting return values required extensive boilerplate (manual queues, locks, join loops, and event flags).

The `concurrent.futures` package was introduced to provide a **clean, high-level, unified interface** for executing callables asynchronously using pools of threads or processes.

### Core Philosophy
* **Executor Pattern:** Abstract away worker lifecycle management. You submit tasks to an executor and don't care which specific thread or process executes them.
* **The `Future` Abstraction:** Represents the eventual result of an asynchronous operation (equivalent to a `Promise` in JavaScript).

---

## 2. Real-World Analogy: The Restaurant Kitchen

To understand how `concurrent.futures` coordinates tasks, consider a busy restaurant:

| Concept | Real-World Equivalent | Explanation |
| :--- | :--- | :--- |
| **`Executor`** | **The Kitchen Manager** | Receives orders from waiters and dispatches them to available workers. |
| **`ThreadPoolExecutor`** | **Line Cooks sharing one counter** | Quick, collaborative tasks (I/O, network requests, reading files). They share the same workspace (memory), but can get in each other's way if everyone needs the same cutting board (Python GIL). |
| **`ProcessPoolExecutor`** | **Separate Independent Kitchens** | Heavy, isolated cooking (CPU-heavy text chunking, hashing, matrix math). Each kitchen has its own staff, equipment, and storage (isolated memory and independent Python interpreters). |
| **`Future`** | **Order Buzzer / Ticket** | When you place an order, you get a buzzer. The food isn't ready immediately, but the buzzer guarantees you can check status, cancel, or pick up the meal once it rings. |
| **`as_completed()`** | **Serving food as soon as dishes finish** | Waiters take whatever plate comes out of the kitchen first, regardless of the order the tickets were placed. |
| **`map()`** | **Assembly-line order delivery** | Serving Table 1, Table 2, and Table 3 strictly in sequence, even if Table 2's food finished before Table 1's. |

---

## 3. Core Classes

### A. `ThreadPoolExecutor`
* **Best For:** I/O-bound tasks (network requests, database calls, disk reads/writes, third-party API calls).
* **Under the Hood:** Uses Python's native OS threads. Subject to the Global Interpreter Lock (GIL), meaning multiple threads cannot execute Python bytecode simultaneously on multiple CPU cores. However, the GIL is released during I/O operations and C-extensions (like NumPy or OpenCV).

```python
from concurrent.futures import ThreadPoolExecutor

# Context manager handles automatic shutdown and cleanup
with ThreadPoolExecutor(max_workers=5) as executor:
    # tasks run here
    pass
```

### B. `ProcessPoolExecutor`
* **Best For:** CPU-bound tasks (tokenization, PDF parsing, regex matching, image transformation, machine learning inference).
* **Under the Hood:** Uses the `multiprocessing` module to bypass the GIL by spawning separate Python interpreter processes on multiple CPU cores. 
* **Trade-off:** Higher memory overhead and requires objects to be picklable (serialized) across process boundaries.

```python
from concurrent.futures import ProcessPoolExecutor

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=4) as executor:
        # tasks run here across 4 CPU cores
        pass
```

---

## 4. Key Functions and Methods

### 1. `executor.submit(fn, *args, **kwargs)`
Schedules a callable to be executed and returns a `Future` object immediately without blocking.

```python
import time
from concurrent.futures import ThreadPoolExecutor

def fetch_data(source_id: int):
    time.sleep(1)
    return f"Data from source {source_id}"

with ThreadPoolExecutor(max_workers=2) as executor:
    # submit() returns a Future instantly
    future = executor.submit(fetch_data, 42)
    
    print("Task submitted, doing other work...")
    
    # .result() blocks until the worker finishes
    result = future.result()
    print("Result:", result)
```

---

### 2. The `Future` Object Methods
The object returned by `executor.submit()` provides fine-grained inspection and control over individual tasks:

| Method | What It Does |
| :--- | :--- |
| `future.result(timeout=None)` | Returns the value returned by the function. If an exception occurred in the worker, it is re-raised here. |
| `future.exception(timeout=None)` | Returns the exception raised by the callable, or `None` if it succeeded. |
| `future.done()` | Returns `True` if the task was cancelled or finished running. Non-blocking. |
| `future.running()` | Returns `True` if the call is currently being executed. |
| `future.cancel()` | Attempts to cancel the call. Succeeds only if the task is still waiting in the queue; fails if already executing. |
| `future.add_done_callback(fn)` | Attaches a callback function that runs automatically as soon as the future completes or is cancelled. |

```python
from concurrent.futures import ThreadPoolExecutor

def calculate_square(n):
    if n < 0:
        raise ValueError("Only positive numbers allowed")
    return n * n

def on_complete(fut):
    print(f"[Callback] Task finished! Result/Status: {fut.done()}")

with ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(calculate_square, 12)
    future.add_done_callback(on_complete)
    
    # Checking status
    print("Is done?", future.done())
    value = future.result()
    print("Calculated value:", value)
```

---

### 3. `executor.map(func, *iterables, timeout=None, chunksize=1)`
Similar to Python's built-in `map()`, but executes calls concurrently across workers.

* **Key Behavior:** Results are yielded strictly in the order of the input iterable, **not** in order of completion.
* If any call raises an exception, that exception is raised when its corresponding iterator item is accessed.

```python
import time
from concurrent.futures import ThreadPoolExecutor

def process_item(item_id: int):
    time.sleep(0.5)
    return f"Processed item {item_id}"

items = [1, 2, 3, 4, 5]

with ThreadPoolExecutor(max_workers=3) as executor:
    # Returns an iterator over results in the same order as `items`
    for result in executor.map(process_item, items):
        print(result)
```

---

### 4. `concurrent.futures.as_completed(fs, timeout=None)`
Takes an iterable of `Future` objects and yields them **as soon as each task completes**, regardless of submission order.

* **Best For:** Independent jobs where you want to process and display completed results as fast as possible without waiting on slower tasks.

```python
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

def simulate_download(doc_name: str):
    duration = random.uniform(0.5, 2.5)
    time.sleep(duration)
    return doc_name, duration

documents = ["doc_A.pdf", "doc_B.pdf", "doc_C.pdf", "doc_D.pdf"]

with ThreadPoolExecutor(max_workers=4) as executor:
    # Map future -> document name for reference
    future_to_doc = {
        executor.submit(simulate_download, doc): doc 
        for doc in documents
    }
    
    # Iterate as each document finishes
    for future in as_completed(future_to_doc):
        doc = future_to_doc[future]
        try:
            name, duration = future.result()
            print(f"Finished: {name} (took {duration:.2f}s)")
        except Exception as exc:
            print(f"Document {doc} failed with: {exc}")
```

---

### 5. `concurrent.futures.wait(fs, timeout=None, return_when=ALL_COMPLETED)`
Blocks execution until a specified condition is met on a collection of futures.

`return_when` options:
* `FIRST_COMPLETED`: Unblocks as soon as any single future finishes or is cancelled.
* `FIRST_EXCEPTION`: Unblocks as soon as any future raises an exception, or when all finish.
* `ALL_COMPLETED`: Unblocks when all futures are done (default).

```python
import time
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED

def task(n):
    time.sleep(n)
    return n

with ThreadPoolExecutor(max_workers=3) as executor:
    futures = [executor.submit(task, i) for i in [3, 1, 2]]
    
    # Wait only until the fastest task completes
    done, not_done = wait(futures, return_when=FIRST_COMPLETED)
    
    print(f"Done tasks: {len(done)}")         # 1
    print(f"Remaining tasks: {len(not_done)}") # 2
    
    for finished in done:
        print("Fastest result:", finished.result())
```

---

## 5. Bridging `concurrent.futures` with `asyncio`

In modern asynchronous web frameworks (FastAPI, Starlette, Sanic), you frequently need to run synchronous CPU-bound operations (PDF parsing, text chunking, image encoding) without stalling the main `asyncio` event loop.

You can bridge a `ThreadPoolExecutor` or `ProcessPoolExecutor` with `asyncio` using `loop.run_in_executor()`:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Create a shared pool dedicated to heavy operations
shared_pool = ThreadPoolExecutor(max_workers=5)

def sync_cpu_heavy_task(document_text: str) -> int:
    """Heavy synchronous parsing or chunking logic."""
    word_count = len(document_text.split())
    return word_count

async def handle_document_upload(text: str):
    loop = asyncio.get_running_loop()
    
    print("Delegating heavy task to worker thread...")
    # Offload without blocking the asyncio loop:
    total_words = await loop.run_in_executor(
        shared_pool, 
        sync_cpu_heavy_task, 
        text
    )
    
    print(f"Completed! Total words: {total_words}")
    return {"words": total_words}

# Execution
if __name__ == "__main__":
    asyncio.run(handle_document_upload("Sample text for processing with concurrent workers"))
```

---

## 6. Decision Matrix: When to Use What?

```
                                Is the task synchronous or asynchronous?
                                                │
                       ┌────────────────────────┴────────────────────────┐
                  Synchronous                                        Asynchronous
                       │                                                 │
            Is it I/O or CPU bound?                                  Use `asyncio`
            ┌──────────┴──────────┐                          (TaskGroup, gather, Semaphore)
        I/O Bound             CPU Bound
            │                     │
`ThreadPoolExecutor`      `ProcessPoolExecutor`
 (Network, APIs, Files)  (Parsing, OCR, Math)
```

| Feature | `ThreadPoolExecutor` | `ProcessPoolExecutor` | `asyncio` |
| :--- | :--- | :--- | :--- |
| **Worker Unit** | OS Thread | OS Process | Coroutines (Cooperative Tasks) |
| **Memory Space** | Shared | Isolated (via IPC / Pickling) | Single Thread / Single Loop |
| **GIL Sensitive?** | Yes | No (bypasses GIL) | Yes (single thread) |
| **Overhead** | Low | Higher (process initialization) | Minimal |
| **Best Used For** | Web scraping, disk I/O, parallel API calls | Text chunking, tokenization, image processing | Highly concurrent network I/O, WebSockets, microservices |