import io
import json
import logging
import os
from typing import Any, Dict, List, Optional
import httpx
import fitz  # PyMuPDF
import redis
from celery import shared_task
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings
from app.Ingestion.vectorstore.pinecone_service import update_vector_store_celery

logger = logging.getLogger(__name__)

# Redis client initialized from application configuration
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def process_pdf_slice_sync(
    file_url: str,
    start_page: int,
    end_page: int,
    doc_id: str,
    user_id: str = "",
    conversation_id: str = "",
) -> int:
    """
    Synchronous worker pipeline:
    1. Downloads PDF into memory via httpx.
    2. Extracts text for pages [start_page, end_page] via PyMuPDF.
    3. Chunks text using RecursiveCharacterTextSplitter.
    4. Delegates upsert to `update_vector_store_celery`.
    """
    logger.info(f"[{doc_id}] Downloading PDF slice from: {file_url}")
    with httpx.Client(timeout=30.0) as http_client:
        response = http_client.get(file_url)
        response.raise_for_status()
        pdf_bytes = response.content

    raw_documents: List[Document] = []
    slice_start_idx = max(0, start_page - 1)  # fitz uses 0-based page index

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        total_doc_pages = len(doc)
        slice_end_idx = min(end_page, total_doc_pages)

        logger.info(
            f"[{doc_id}] Extracting pages {start_page} to {slice_end_idx} "
            f"(Total doc pages: {total_doc_pages})"
        )

        for page_idx in range(slice_start_idx, slice_end_idx):
            page = doc[page_idx]
            page_text = page.get_text("text").strip()

            if page_text:
                raw_documents.append(
                    Document(
                        page_content=page_text,
                        metadata={
                            "doc_id": doc_id,
                            "user_id": user_id,
                            "conversation_id": conversation_id,
                            "page_number": page_idx + 1,
                            "source_url": file_url,
                        },
                    )
                )

    if not raw_documents:
        logger.warning(f"[{doc_id}] No text found across pages {start_page}-{end_page}.")
        return 0

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_documents(raw_documents)

    for chunk in chunks:
        chunk.metadata.update({
            "doc_id": doc_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
        })

    total_chunks = len(chunks)
    logger.info(f"[{doc_id}] Created {total_chunks} chunks from pages {start_page}-{end_page}")

    inserted_ids = update_vector_store_celery(chunks)
    return len(inserted_ids)


def process_text_file_sync(
    file_url: str,
    doc_id: str,
    user_id: str = "",
    conversation_id: str = "",
) -> int:
    """Synchronous pipeline for raw text files."""
    logger.info(f"[{doc_id}] Downloading text file from: {file_url}")
    with httpx.Client(timeout=30.0) as http_client:
        response = http_client.get(file_url)
        response.raise_for_status()
        text_content = response.text

    if not text_content.strip():
        return 0

    raw_doc = Document(
        page_content=text_content,
        metadata={
            "doc_id": doc_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
            "source_url": file_url,
        },
    )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", " ", ""],
    )
    chunks = splitter.split_documents([raw_doc])
    for chunk in chunks:
        chunk.metadata.update({
            "doc_id": doc_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
        })

    inserted_ids = update_vector_store_celery(chunks)
    return len(inserted_ids)


# ----------------------------------------------------------------------
# Celery Tasks (Executed within the chord header)
# ----------------------------------------------------------------------
@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_pdf_slice_task(
    self,
    file_url: str,
    start_page: int,
    end_page: int,
    doc_id: str,
    user_id: str = "",
    conversation_id: str = "",
) -> Dict[str, Any]:
    """Celery task entrypoint executed by workers in parallel within the chord header."""
    try:
        inserted_count = process_pdf_slice_sync(
            file_url=file_url,
            start_page=start_page,
            end_page=end_page,
            doc_id=doc_id,
            user_id=user_id,
            conversation_id=conversation_id,
        )

        return {
            "status": "SUCCESS",
            "doc_id": doc_id,
            "page_range": [start_page, end_page],
            "chunks_upserted": inserted_count,
        }

    except Exception as exc:
        logger.error(
            f"[{doc_id}] Task failed for pages {start_page}-{end_page}: {exc}",
            exc_info=True,
        )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_text_file_task(
    self,
    file_url: str,
    doc_id: str,
    user_id: str = "",
    conversation_id: str = "",
) -> Dict[str, Any]:
    """Celery task for single text file ingestion."""
    try:
        inserted_count = process_text_file_sync(
            file_url=file_url,
            doc_id=doc_id,
            user_id=user_id,
            conversation_id=conversation_id,
        )
        return {
            "status": "SUCCESS",
            "doc_id": doc_id,
            "chunks_upserted": inserted_count,
        }
    except Exception as exc:
        logger.error(f"[{doc_id}] Text file task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)


# ----------------------------------------------------------------------
# Celery Chord Callback (Fires when all slice tasks finish)
# ----------------------------------------------------------------------
@shared_task
def document_ready_callback(
    results: list,
    doc_id: str,
    file_id: Optional[str] = None,
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executed ONLY after all process slice tasks finish.
    1. Sums total chunks across all slices.
    2. Deletes temporary file from ImageKit.
    3. Persists READY status in Redis for Rehydration Guard.
    4. Publishes event on Redis channel doc_status:{doc_id}.
    """
    try:
        total_chunks = sum(
            item.get("chunks_upserted", 0) for item in results if isinstance(item, dict)
        )
        logger.info(f"[{doc_id}] All slices processed. Total chunks upserted: {total_chunks}")

        # 1. Clean up temporary uploaded file from ImageKit
        if file_id and settings.IMAGEKIT_PRIVATE_KEY:
            try:
                with httpx.Client(timeout=15.0) as http_client:
                    ik_res = http_client.delete(
                        f"https://api.imagekit.io/v1/files/{file_id}",
                        auth=(settings.IMAGEKIT_PRIVATE_KEY, ""),
                    )
                    logger.info(
                        f"[{doc_id}] ImageKit cleanup for {file_id}: status {ik_res.status_code}"
                    )
            except Exception as ik_err:
                logger.warning(f"[{doc_id}] Failed to delete ImageKit file {file_id}: {ik_err}")

        # 2. Persist READY status in Redis for Rehydration Guard
        state_payload = {
            "status": "READY",
            "doc_id": doc_id,
            "total_chunks": total_chunks,
            "conversation_id": conversation_id,
            "user_id": user_id,
        }
        redis_client.set(f"doc_status_state:{doc_id}", json.dumps(state_payload), ex=3600)

        # 3. Publish message to channel doc_status:{doc_id}
        channel_name = f"doc_status:{doc_id}"
        event_payload = {
            "event": "DOCUMENT_INGESTION_COMPLETED",
            "doc_id": doc_id,
            "total_chunks_stored": total_chunks,
            "status": "READY",
        }
        receivers_count = redis_client.publish(channel_name, json.dumps(event_payload))
        logger.info(f"[{doc_id}] Published event to '{channel_name}'. Active listeners: {receivers_count}")

        return state_payload

    except Exception as exc:
        logger.error(f"[{doc_id}] Error in document_ready_callback: {exc}", exc_info=True)
        error_payload = {
            "status": "FAILED",
            "doc_id": doc_id,
            "error": str(exc),
        }
        redis_client.set(f"doc_status_state:{doc_id}", json.dumps(error_payload), ex=3600)
        redis_client.publish(f"doc_status:{doc_id}", json.dumps(error_payload))
        raise
