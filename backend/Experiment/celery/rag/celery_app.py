import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# broker is used for queues (DB 0); backend stores return values (DB 1)
app = Celery(
    "rag_pipeline",
    broker=f"{REDIS_URL}/0",
    backend=f"{REDIS_URL}/1",
    include=["Experiment.celery.rag.tasks"]
)

# Optional recommended production configurations

app.conf.update(
    # Serialization & Network
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    result_compression="gzip",
    timezone="UTC",

    # Backend & Chords (DO NOT set task_ignore_result=True globally with chords)
    result_backend="redis://localhost:6379/1",
    task_ignore_result=False,
    result_expires=1800,  # 30 minutes TTL on Redis result keys

    # Flower / Event Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,

    # Worker Concurrency & Memory Safeguards
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,
)
    


