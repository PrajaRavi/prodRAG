import io
import logging
from typing import Dict, Any, List
import httpx
import fitz  # PyMuPDF
from celery import shared_task
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.Ingestion.vectorstore.pinecone_service import update_vector_store_celery
# Import your existing batch upsert function
# from src.celery_exp.vector_store import update_vector_store_celery
from Experiment.celery.rag.celery_app import app
import json
import redis
client = redis.Redis(host="localhost", port=6379, decode_responses=True)
    
logger = logging.getLogger(__name__)


def process_pdf_slice_sync(
    file_url: str,
    start_page: int,
    end_page: int,
    doc_id: str,
) -> int:
    """
    Synchronous worker pipeline:
    1. Downloads PDF into memory via httpx.
    2. Extracts text for pages [start_page, end_page] via PyMuPDF.
    3. Chunks text using RecursiveCharacterTextSplitter.
    4. Delegates upsert to `update_vector_store_celery`.
    """
    # ------------------------------------------------------------------
    # Step 1: Download PDF bytes in-memory (No temp files on disk)
    # ------------------------------------------------------------------
    logger.info(f"[{doc_id}] Downloading PDF slice from: {file_url}")
    with httpx.Client(timeout=30.0) as client:
        response = client.get(file_url)
        response.raise_for_status()
        pdf_bytes = response.content

    # ------------------------------------------------------------------
    # Step 2: Extract text strictly for [start_page, end_page]
    # ------------------------------------------------------------------
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
                            "page_number": page_idx + 1,
                            "source_url": file_url,
                        }
                    )
                )

    if not raw_documents:
        logger.warning(f"[{doc_id}] No text found across pages {start_page}-{end_page}.")
        return 0

    # ------------------------------------------------------------------
    # Step 3: Chunk text using RecursiveCharacterTextSplitter
    # ------------------------------------------------------------------
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", " ", ""]
    )
    chunks = splitter.split_documents(raw_documents)
    total_chunks = len(chunks)
    logger.info(f"[{doc_id}] Created {total_chunks} chunks from pages {start_page}-{end_page}")

    # ------------------------------------------------------------------
    # Step 4: Batch upsert using your existing synchronous function
    # ------------------------------------------------------------------
    # update_vector_store_celery handles batching chunks into 100-chunk slices
    # and upserting them to Pinecone synchronously.
    inserted_ids = update_vector_store_celery(chunks)

    return len(inserted_ids)


@app.task
def document_ready_callback(results: list, doc_id: str):
    """
    Executed ONLY after all process_pdf_slice tasks finish.
    results = [
        {"doc_id": "doc_999", "pages": [1, 100], "chunks_upserted": 200, ...},
        {"doc_id": "doc_999", "pages": [101, 200], "chunks_upserted": 200, ...},
        ...
    ]
    """
    total_chunks = sum(item["chunks_upserted"] for item in results)
    
    # Notify database, send WebSocket message to user, etc.
    channel_name = doc_id
    
    print("[*] Simulating background ingestion...")
    
        
    event_payload={
        "doc_id": doc_id,
        "total_chunks_stored": total_chunks,
        "status": "SUCCESS"
    }
    # Publish message to channel
    # The return value is the count of active subscribers that received the message
    receivers_count = client.publish(channel_name, json.dumps(event_payload))
    
    print(f"[+] Published event to '{channel_name}'.")
    print(f"    Active listeners reached: {receivers_count}")
    
    

# ----------------------------------------------------------------------
# Celery Task (Called inside the chord header)
# ----------------------------------------------------------------------
@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def process_pdf_slice_task(
    self,
    file_url: str,
    start_page: int,
    end_page: int,
    doc_id: str
) -> Dict[str, Any]:
    """
    Celery task entrypoint executed by workers in parallel within the chord header.
    """
    try:
        inserted_count = process_pdf_slice_sync(
            file_url=file_url,
            start_page=start_page,
            end_page=end_page,
            doc_id=doc_id
        )

        return {
            "status": "SUCCESS",
            "doc_id": doc_id,
            "page_range": [start_page, end_page],
            "chunks_upserted": inserted_count
        }

    except Exception as exc:
        logger.error(
            f"[{doc_id}] Task failed for pages {start_page}-{end_page}: {exc}",
            exc_info=True
        )
        # Automatically retries if download or Pinecone upsert hits a transient error
        raise self.retry(exc=exc)