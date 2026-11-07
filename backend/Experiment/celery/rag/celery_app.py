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
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    result_backend="redis://localhost:6379/1",

    
)

