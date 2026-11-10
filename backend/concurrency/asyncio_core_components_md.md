# Master Class: Core `asyncio` Components for Concurrency Control

Python’s `asyncio` module provides powerful primitives for managing concurrency, rate limiting, task coordination, and message passing. This guide explores the essential components for asynchronous job processing.

---

## Quick Reference Summary

| Primitive | Primary Use Case | Key Methods |
| :--- | :--- | :--- |
| **`asyncio.Semaphore`** | Bounded concurrency (rate-limiting requests, database connection pools) | `acquire()`, `release()`, `async with` |
| **`asyncio.as_completed`** | Yielding results as soon as individual tasks complete | `as_completed(aws)` (returns iterator) |
| **`asyncio.gather`** | Aggregate completion with preserved input order | `gather(*aws, return_exceptions=False)` |
| **`asyncio.Queue`** | Producer-Consumer pipelines, task queues, decoupled architectures | `put()`, `get()`, `task_done()`, `join()` |
| **`asyncio.Event`** | State signaling / One-to-Many broadcast triggers | `set()`, `clear()`, `wait()`, `is_set()` |
| **`asyncio.TaskGroup`** *(3.11+)* | Structured concurrency, auto-cleanup, exception group handling | `create_task()`, `async with` |

---

## 1. `asyncio.Semaphore` (Concurrency Limiter)

A **Semaphore** limits access to a shared resource by managing an internal counter. Every call to `acquire()` decrements the counter, and every `release()` increments it. If the counter hits zero, subsequent callers pause until a slot becomes available.

### Visualizing Semaphore

```
              +------------------------------------------+
              |           Semaphore (Capacity = 2)       |
              |   [ Slot 1: Active ] [ Slot 2: Active ]  |
              +------------------------------------------+
                                    ^
                                    |
   Task 1 [Running] ----------------+
   Task 2 [Running] ----------------+
   Task 3 [WAITING] -------------> [ QUEUE ] (Blocks on acquire)
   Task 4 [WAITING] -------------> [ QUEUE ] (Blocks on acquire)
```

### Python Implementation

```python
import asyncio
import random

async def fetch_url(url: str, semaphore: asyncio.Semaphore):
    # Context manager automatically handles acquire() and release()
    async with semaphore:
        print(f"--> [START] Fetching: {url}")
        await asyncio.sleep(random.uniform(1.0, 3.0)) # Simulate HTTP request
        print(f"<-- [DONE]  Fetched: {url}")

async def main():
    urls = [f"https://api.example.com/item/{i}" for i in range(1, 10)]
    
    # Allow a maximum of 3 concurrent requests
    sem = asyncio.Semaphore(3)
    
    tasks = [fetch_url(url, sem) for url in urls]
    await asyncio.gather(*tasks)

asyncio.run(main())
```

---

## 2. Processing Results with `as_completed` vs. `gather`

When firing off dozens of async tasks, you often need to process their results. `asyncio` offers two distinct paradigms:

1. **`asyncio.gather`**: Waits for *all* tasks to finish and returns results ordered by the original task input sequence.
2. **`asyncio.as_completed`**: Yields completed futures immediately as they finish, regardless of input order.

### Visual Comparison

```
Task Execution Timeline:
Task A (Takes 3s): [====================] -> Output A
Task B (Takes 1s): [======]               -> Output B
Task C (Takes 2s): [============]         -> Output C

--- asyncio.gather ---
Output Order:  [Output A, Output B, Output C]  (Waits until 3s for all to complete)

--- asyncio.as_completed ---
Output Order:  Output B (at 1s)  ==> Output C (at 2s) ==> Output A (at 3s)
```

### Python Implementation: `as_completed`

```python
import asyncio
import random

async def process_job(job_id: int) -> str:
    delay = random.uniform(1.0, 4.0)
    await asyncio.sleep(delay)
    return f"Job {job_id} finished in {delay:.2f}s"

async def main():
    tasks = [process_job(i) for i in range(1, 6)]

    print("Starting jobs with as_completed...")
    # Iterate over tasks as soon as each one resolves
    for future in asyncio.as_completed(tasks):
        result = await future
        print(f"Received result: {result}")

asyncio.run(main())
```

---

## 3. `asyncio.Queue` (Producer-Consumer Pattern)

`asyncio.Queue` provides an asynchronous thread-safe/task-safe FIFO data structure. It is essential for building pipelines where workload generation (producers) is decoupled from workload execution (consumers).

### Producer-Consumer Flow Architecture

```
                  +-------------------+
  Producer 1 ---> |                   | ---> Consumer 1
  Producer 2 ---> |   asyncio.Queue   | ---> Consumer 2
  Producer 3 ---> | [Item 3|Item 2|1] | ---> Consumer 3
                  +-------------------+
                            ^
                            |
                     (Capacity Limit /
                      Backpressure)
```

### Python Implementation

```python
import asyncio
import random

async def producer(name: str, queue: asyncio.Queue, count: int):
    for i in range(count):
        item = f"WorkItem-{name}-{i}"
        await asyncio.sleep(random.uniform(0.1, 0.5))
        await queue.put(item)
        print(f"[{name}] Produced: {item}")

async def consumer(name: str, queue: asyncio.Queue):
    while True:
        # Wait for an item from the queue
        item = await queue.get()
        
        # Process the item
        print(f"  [{name}] Consuming: {item}")
        await asyncio.sleep(random.uniform(0.5, 1.0))
        
        # Signal that the item was successfully processed
        queue.task_done()

async def main():
    queue = asyncio.Queue(maxsize=5) # Max 5 items in memory at once

    # Start 3 consumer background tasks
    consumers = [
        asyncio.create_task(consumer(f"Worker-{i}", queue))
        for i in range(1, 4)
    ]

    # Run producers to completion
    await asyncio.gather(
        producer("Producer-A", queue, 4),
        producer("Producer-B", queue, 4)
    )

    # Wait for all queue items to be processed
    await queue.join()

    # Cancel persistent consumer loops
    for c in consumers:
        c.cancel()

asyncio.run(main())
```

---

## 4. `asyncio.Event` (Task Signaling & Broadcast)

An `Event` manages an internal boolean flag (`False` by default). Tasks call `await event.wait()` to block until another task calls `event.set()`. This is used for coordinated startup sequence triggers, pause/resume flags, or emergency shutdown signals.

### Broadcast Signal Flow

```
   State: Event.is_set() == False
   Worker 1 [BLOCKED on wait()] ---\
   Worker 2 [BLOCKED on wait()] ----+--> Waiting for Signal
   Worker 3 [BLOCKED on wait()] ---/

   --------------------------------------------------------
   Trigger Task calls event.set()
   --------------------------------------------------------

   State: Event.is_set() == True
   Worker 1 ===> [RESUMES]
   Worker 2 ===> [RESUMES]
   Worker 3 ===> [RESUMES]
```

### Python Implementation

```python
import asyncio

async def worker(worker_id: int, start_event: asyncio.Event):
    print(f"Worker {worker_id} ready and waiting for signal...")
    await start_event.wait() # Pause execution until event is set
    print(f"Worker {worker_id} received start signal! Executing task.")

async def main():
    start_event = asyncio.Event()

    workers = [asyncio.create_task(worker(i, start_event)) for i in range(1, 4)]

    print("Main task performing initialization...")
    await asyncio.sleep(2.0)
    print("Initialization complete! Broadcasting start signal.")
    
    # Unblock all waiting workers simultaneously
    start_event.set()

    await asyncio.gather(*workers)

asyncio.run(main())
```

---

## 5. Modern Concurrency: `asyncio.TaskGroup` (Python 3.11+)

Introduced in Python 3.11, `TaskGroup` offers **structured concurrency**. It ensures that if one task inside the group raises an unhandled exception, all other active tasks in the group are automatically canceled, and an `ExceptionGroup` is raised.

### Execution Scope Diagram

```
async with asyncio.TaskGroup() as tg:
    ├─► tg.create_task(Task 1)  ──┐
    ├─► tg.create_task(Task 2)  ──┼── Scope Blocks Here Until ALL Complete
    └─► tg.create_task(Task 3)  ──┘
    
[!] If Task 2 Fails:
    1. Task 1 & 3 are instantly CANCELED.
    2. Context manager exits by raising ExceptionGroup.
```

### Python Implementation

```python
import asyncio

async def task_a():
    await asyncio.sleep(1)
    print("Task A completed successfully")

async def task_b():
    await asyncio.sleep(0.5)
    raise ValueError("Task B failed unexpectedly!")

async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(task_a())
            tg.create_task(task_b())
    except* ValueError as eg:
        # Handles ExceptionGroups cleanly (Python 3.11+ syntax)
        print(f"Caught handled error within group: {eg.exceptions}")

asyncio.run(main())
```