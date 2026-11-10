# Experiment/celery/rag/redis_sync.py
import redis
import os
from app.config import settings

REDIS_URL = settings.REDIS_URL

# Synchronous connection pool for text/JSON operations (Pub/Sub, state tracking)
sync_pool = redis.ConnectionPool.from_url(
    f"{REDIS_URL}",
    max_connections=20,
    socket_timeout=15.0,
    socket_connect_timeout=15.0,
    retry_on_timeout=True,
    decode_responses=True,
)

# Synchronous connection pool for binary blobs (raw PDF/text bytes)
binary_pool = redis.ConnectionPool.from_url(
    f"{REDIS_URL}",
    max_connections=20,
    socket_timeout=15.0,
    socket_connect_timeout=15.0,
    retry_on_timeout=True,
    decode_responses=False,
)


def get_sync_redis() -> redis.Redis:
    """Returns a client reusing the module-level sync pool for UTF-8/JSON."""
    return redis.Redis(connection_pool=sync_pool)


def get_binary_redis() -> redis.Redis:
    """Returns a client for raw binary operations (e.g. in-memory document blob storage)."""
    return redis.Redis(connection_pool=binary_pool)
