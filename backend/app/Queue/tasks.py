import logging
from celery import Celery
import pymupdf  # PyMuPDF
import httpx
from app.Ingestion.vectorstore.pinecone_service import update_vector_store_celery
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

celery_app = Celery(
    "rag_ingestion",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1"
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_pdf_slice(self, file_url: str, start_page: int, end_page: int, doc_id: str):
    """
    Extracts text for assigned pages, chunks, embeds, and upserts to Pinecone.

    """
    try:
        logger.info(f"Processing pages {start_page}-{end_page} for doc: {doc_id}")
        
        # 1. Fetch file bytes
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(file_url)
            resp.raise_for_status()
            pdf_bytes = resp.content

        # 2. Extract slice text using PyMuPDF
        extracted_chunks = []
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page_num in range(start_page - 1, min(end_page, doc.page_count)):
                page_text = doc[page_num].get_text()
                if page_text.strip():
                    # extracted_chunks.append({
                    #     "page": page_num + 1,
                    #     "content": page_text
                    # })
                    extracted_chunks.append(Document(
                        page_content=page_text,
                        metadata={"page":page_num+1}
                    ))

        # 3. Chunk text, generate embeddings via Nomic, and upsert to Pinecone
        # ... (Embed & Upsert logic here) ...
        result =  update_vector_store_celery(extracted_chunks)
                
        if(len(result)>0):
            return {
                "doc_id": doc_id,
                "range": [start_page, end_page],
                "chunks_count": len(extracted_chunks),
                "status": "SUCCESS"
            }
        else:
            raise Exception("Documents are not inserted in Pinecone")

    except Exception as exc:
        logger.error(f"Error processing slice {start_page}-{end_page}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task
def document_ingestion_complete(results, doc_id: str):
    """
    Final callback executed when all parallel tasks in the chord complete.
    """
    total_chunks = sum(item.get("chunks_count", 0) for item in results)
    logger.info(f"Ingestion finished for doc {doc_id}. Total chunks: {total_chunks}")

    # Update database status to READY and broadcast notification
    return {
        "doc_id": doc_id,
        "total_chunks": total_chunks,
        "status": "READY"
    }
