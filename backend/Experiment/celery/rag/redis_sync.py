# Experiment/celery/rag/redis_sync.py
import redis
import os
from app.config import settings
REDIS_URL = settings.REDIS_URL

# Create a synchronous connection pool shared across tasks within this worker process
sync_pool = redis.ConnectionPool.from_url(
    f"{REDIS_URL}",
    max_connections=20,
    # decode_responses=True,
    socket_timeout=15.0,
    socket_connect_timeout=15.0,
    retry_on_timeout=True,
    decode_responses=True
)

def get_sync_redis() -> redis.Redis:
    """Returns a client reusing the module-level sync pool."""
    return redis.Redis(connection_pool=sync_pool)