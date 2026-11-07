import os
import math
import logging
from typing import List, Tuple
import httpx
import fitz  # PyMuPDF
from celery import chord
import time
from celery.canvas import Signature
from Experiment.celery.rag.tasks import process_pdf_slice_task,document_ready_callback
from Experiment.Redis.pubsub.subs import run_subscriber
logger = logging.getLogger(__name__)

PAGES_PER_SLICE = 100


def get_pdf_page_count(file_url: str) -> int:
    """
    Reads only the PDF header/trailer to extract total page count instantly
    without loading full document text into memory.
    Supports local paths, file:// URIs, and remote HTTPS URLs.
    """
    # 1. Handle local file paths
    if os.path.exists(file_url) or file_url.startswith("file://"):
        local_path = file_url.replace("file://", "")
        with fitz.open(local_path) as doc:
            return len(doc)

    # 2. Handle remote URLs (ImageKit, S3, Cloudinary)
    if file_url.startswith("http://") or file_url.startswith("https://"):
        with httpx.Client(timeout=20.0) as client:
            response = client.get(file_url)
            response.raise_for_status()
            with fitz.open(stream=response.content, filetype="pdf") as doc:
                return len(doc)

    raise ValueError(f"Invalid or unreachable file path/URL: {file_url}")


def create_slice_signatures(
    file_url: str,
    doc_id: str,
    pages_per_slice: int = PAGES_PER_SLICE,
) -> Tuple[List[Signature], int]:
    callback = document_ready_callback.s(doc_id=doc_id)

    """
    Calculates 100-page slices and generates Celery task signatures (.s())
    ready to be passed as the header to Celery's chord primitive.

    Returns:
        tuple: (header_signatures, total_pages)
    """
    total_pages = get_pdf_page_count(file_url)
    logger.info(f"[{doc_id}] Total pages detected: {total_pages}")

    header_signatures: List[Signature] = []

    # 1-based page slicing: (1, 100), (101, 200), (201, 300), etc.
    for start_page in range(1, total_pages + 1, pages_per_slice):
        end_page = min(start_page + pages_per_slice - 1, total_pages)

        # Create signature using .s()
        task_sig = process_pdf_slice_task.s(
            file_url=file_url,
            start_page=start_page,
            end_page=end_page,
            doc_id=doc_id,
        )
        header_signatures.append(task_sig)

    logger.info(
        f"[{doc_id}] Created {len(header_signatures)} task signatures for chord header."
    )
    return header_signatures,callback

# 126->8s
# 713->26s
if __name__=="__main__":
    t1=time.time()
    doc_id="ravipraj"
    data=create_slice_signatures("https://ik.imagekit.io/k5imwrh1hh/rag_documents/dracula-126_py7jVx9SS.pdf?updatedAt=1793936565539",doc_id)
    data=chord(data[0])(data[1])
    run_subscriber(doc_id)
    # print(time.time()-t1)
    # print(data[0])
    # final_result = data.get(timeout=240) #! if we not do this then this script ends and chord ends later so this runner file can accept the chord result that's why we are using timeout now this script will wait for final chord result
    # print(time.time()-t1)
    # print(f"Chord Completed: {final_result}")

