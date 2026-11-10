import json
import logging
import os
from typing import List, Optional, Tuple
import pymupdf  # PyMuPDF
import httpx
from celery import chord
from celery.canvas import Signature
from Experiment.celery.rag.celery_app import app

from app.config import settings
from Experiment.celery.rag.tasks import (
    document_ready_callback,
    process_pdf_slice_task,
    process_text_file_task,
)
from Experiment.celery.rag.redis_sync import get_sync_redis, get_binary_redis

logger = logging.getLogger(__name__)

PAGES_PER_SLICE = 50

redis_client = get_sync_redis()
redis_binary_client = get_binary_redis()


def fetch_document_bytes(file_url: str) -> bytes:
    """
    Downloads or reads document bytes once into memory.
    Supports local paths, file:// URIs, and remote HTTPS URLs.
    """
    if os.path.exists(file_url) or file_url.startswith("file://"):
        local_path = file_url.replace("file://", "")
        with open(local_path, "rb") as f:
            return f.read()

    if file_url.startswith("http://") or file_url.startswith("https://"):
        with httpx.Client(timeout=30.0) as client:
            response = client.get(file_url)
            response.raise_for_status()
            return response.content

    raise ValueError(f"Invalid or unreachable file path/URL: {file_url}")


def dispatch_document_ingestion_chord(
    file_url: str,
    doc_id: str,
    user_id: str,
    conversation_id: str,
    file_id: Optional[str] = None,
    pages_per_slice: int = PAGES_PER_SLICE,
) -> str:
    """
    Orchestrates distributed ingestion:
    1. Downloads document bytes ONCE and caches in Redis in-memory RAM with a 10-minute safety TTL.
    2. Sets initial 'PENDING' status in Redis for Rehydration Guard.
    3. Slices PDF into parallel task signatures reading from the in-memory cache.
    4. Chains with document_ready_callback via Celery chord.
    5. Returns chord task ID.
    """
    # 1. Set initial PENDING state in Redis
    redis_client.set(
        f"doc_status_state:{doc_id}",
        json.dumps({
            "status": "PENDING",
            "doc_id": doc_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
        }),
        ex=3600,
    )

    # 2. Download document ONCE into memory and cache in Redis RAM
    logger.info(f"[{doc_id}] Downloading document once into memory from: {file_url}")
    doc_bytes = fetch_document_bytes(file_url)
    redis_binary_client.set(f"doc_blob:{doc_id}", doc_bytes, ex=600)  # 10-min safety TTL
    logger.info(f"[{doc_id}] Cached document blob ({len(doc_bytes)} bytes) in Redis in-memory storage.")

    clean_url = file_url.lower().split("?")[0]
    is_pdf = clean_url.endswith(".pdf") or "pdf" in clean_url

    header_signatures: List[Signature] = []
    if is_pdf:
        with pymupdf.open(stream=doc_bytes, filetype="pdf") as doc:
            total_pages = len(doc)
        logger.info(f"[{doc_id}] Total PDF pages detected: {total_pages}")

        for start_page in range(1, total_pages + 1, pages_per_slice):
            end_page = min(start_page + pages_per_slice - 1, total_pages)
            task_sig = process_pdf_slice_task.s(
                file_url=file_url,
                start_page=start_page,
                end_page=end_page,
                doc_id=doc_id,
                user_id=user_id,
                conversation_id=conversation_id,
            )
            header_signatures.append(task_sig)
    else:
        logger.info(f"[{doc_id}] Scheduling single text ingestion task.")
        task_sig = process_text_file_task.s(
            file_url=file_url,
            doc_id=doc_id,
            user_id=user_id,
            conversation_id=conversation_id,
        )
        header_signatures.append(task_sig)

    callback = document_ready_callback.s(
        doc_id=doc_id,
        file_id=file_id,
        user_id=user_id,
        conversation_id=conversation_id,
    )

    chord_async_result = chord(header_signatures, app=app)(callback)
    logger.info(f"[{doc_id}] Dispatched Celery chord with job ID: {chord_async_result.id}")
    return str(chord_async_result.id)
