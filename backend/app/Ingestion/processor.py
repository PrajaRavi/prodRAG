import os
import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
from typing import List, Callable, Dict, Any

from langchain_core.documents import Document
from langchain_community.document_loaders import (
    CSVLoader,
    JSONLoader,
    UnstructuredMarkdownLoader,
    UnstructuredFileLoader,
)

# Custom modular loaders & chunkers
from app.Ingestion.chunker.doc_chunker import doc_chunking
from app.Ingestion.txtloader.loader import text_loader
from app.Ingestion.pdfloder.loader import safe_server_pdf_loader
from app.Ingestion.vectorstore.pinecone_service import update_vector_store

logger = logging.getLogger(__name__)

# Shared worker pool for CPU-bound document loading and chunking
cpu_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="rag_ingest_cpu")


# --- Loader Strategies ---

def _load_txt(file_path: str) -> List[Document]:
    return text_loader(file_path=file_path)

def _load_pdf(file_path: str) -> List[Document]:
    docs = safe_server_pdf_loader(file_path)
    return list(docs)

def _load_csv(file_path: str) -> List[Document]:
    loader = CSVLoader(file_path, encoding="utf-8")
    return list(loader.load())

def _load_json(file_path: str) -> List[Document]:
    loader = JSONLoader(file_path, jq_schema=".", text_content=False)
    return list(loader.load())

def _load_markdown(file_path: str) -> List[Document]:
    loader = UnstructuredMarkdownLoader(file_path)
    return loader.load()

def _load_fallback(file_path: str) -> List[Document]:
    loader = UnstructuredFileLoader(file_path)
    return loader.load()


LOADER_REGISTRY: Dict[str, Callable[[str], List[Document]]] = {
    "txt": _load_txt,
    "log": _load_txt,
    "pdf": _load_pdf,
    "csv": _load_csv,
    "json": _load_json,
    "md": _load_markdown,
}


# --- Helpers ---

def _extract_extension(file_path_or_url: str) -> str:
    """Robustly extract file extension from either local paths or remote URLs."""
    parsed = urlparse(file_path_or_url)
    clean_path = parsed.path if parsed.scheme else file_path_or_url
    suffix = Path(clean_path).suffix.lower()
    return suffix.lstrip(".")


def _validate_local_file(file_path: str, max_size_mb: int) -> None:
    """Validate file existence and enforce maximum file size limit."""
    path_obj = Path(file_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    file_size_mb = path_obj.stat().st_size / (1024 * 1024)
    if file_size_mb > max_size_mb:
        raise ValueError(
            f"File size ({file_size_mb:.2f} MB) exceeds maximum allowed limit of {max_size_mb} MB"
        )


def _sync_extract_and_chunk(
    file_path: str,
    loader_func: Callable[[str], List[Document]],
    user_id: str,
    conversation_id: str,
    chunk_size: int = 600,
) -> List[Document]:
    """
    Synchronous CPU-bound pipeline stage.
    Executes loader parsing and text chunking in a background thread.
    """
    logger.info(f"Starting extraction for: {file_path}")
    raw_docs = loader_func(file_path)
    
    if not raw_docs:
        logger.warning(f"No text content could be extracted from: {file_path}")
        return []

    logger.info(f"Chunking {len(raw_docs)} document sections for: {file_path}")
    chunks = doc_chunking(chunk_size, raw_docs, user_id, conversation_id)
    return chunks


# --- Main Ingestion Entry Point ---

async def complete_Ingestion(
    file_path: str,
    max_size_mb: int = 10,
    user_id: str = "ravi",
    conversation_id: str = "ravi_praj",
) -> Any:
    """
    Global dispatcher:
    1. Validates file path and extension.
    2. Offloads synchronous parsing and chunking to ThreadPoolExecutor.
    3. Asynchronously upserts embeddings into Pinecone vector store.
    """
    loop = asyncio.get_running_loop()

    # 1. Enforce local file constraints (skip if it's an HTTP URL)
    if not urlparse(file_path).scheme:
        _validate_local_file(file_path, max_size_mb)

    # 2. Resolve loader strategy
    ext = _extract_extension(file_path)
    loader_func = LOADER_REGISTRY.get(ext, _load_fallback)

    try:
        # 3. Offload CPU-heavy parsing & chunking to worker thread
        chunks = await loop.run_in_executor(
            cpu_pool,
            _sync_extract_and_chunk,
            file_path,
            loader_func,
            user_id,
            conversation_id,
            600,
        )

        if not chunks:
            logger.warning(f"Ingestion aborted: No chunks created for {file_path}")
            return []

        # 4. Async vector upsert (runs directly on the event loop as network I/O)
        logger.info(f"Upserting {len(chunks)} chunks to Pinecone for conversation: {conversation_id}")
        result = await update_vector_store(chunks)
        return result

    except PermissionError as pe:
        logger.error(f"Permission denied reading file {file_path}: {pe}")
        raise
    except Exception as exc:
        logger.error(f"Failed to ingest file {file_path}: {exc}", exc_info=True)
        raise