import os
import pymupdf  # PyMuPDF: C-based, 10x-30x faster than pypdf
import httpx
import logging
from typing import List, Optional, Union
from urllib.parse import urlparse
from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class PDFProcessingError(Exception):
    """Custom exception raised when PDF loading or parsing fails."""
    pass


def _is_remote_url(path: str) -> bool:
    """Check if the provided path is a valid HTTP/HTTPS URL."""
    try:
        parsed = urlparse(path)
        return parsed.scheme.lower() in ("http", "https")
    except Exception:
        return False


def _fetch_remote_bytes(url: str, max_size_bytes: int, timeout_sec: float = 30.0) -> bytes:
    """
    Downloads remote file bytes with stream inspection to enforce max size 
    before loading the whole file into RAM.
    """
    try:
        with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()

                # Check Content-Length header if present
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > max_size_bytes:
                    raise PDFProcessingError(
                        f"Remote file size ({int(content_length)} bytes) exceeds limit of {max_size_bytes} bytes."
                    )

                # Download in chunks to protect against memory exhaustion
                downloaded_bytes = bytearray()
                for chunk in response.iter_bytes(chunk_size=128 * 1024):
                    downloaded_bytes.extend(chunk)
                    if len(downloaded_bytes) > max_size_bytes:
                        raise PDFProcessingError(
                            f"Downloaded content exceeded limit of {max_size_bytes} bytes."
                        )

                return bytes(downloaded_bytes)

    except httpx.HTTPStatusError as e:
        raise PDFProcessingError(f"HTTP error fetching remote PDF ({e.response.status_code}): {url}") from e
    except httpx.RequestError as e:
        raise PDFProcessingError(f"Network error connecting to remote PDF URL: {url} -> {str(e)}") from e


def _validate_and_read_local(file_path: str, max_size_bytes: int) -> bytes:
    """Validates local file existence, permissions, and size."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    if not os.path.isfile(file_path):
        raise ValueError(f"Target path is a directory, not a file: {file_path}")

    file_size = os.path.getsize(file_path)
    if file_size > max_size_bytes:
        raise PDFProcessingError(
            f"PDF file size ({file_size} bytes) exceeds limit of {max_size_bytes} bytes."
        )

    try:
        with open(file_path, "rb") as f:
            return f.read()
    except PermissionError as e:
        raise PermissionError(f"Permission denied reading file: {file_path}") from e


def safe_server_pdf_loader(
    file_source: str,
    max_size_mb: int = 10,
    password: Optional[str] = None,
    clean_null_bytes: bool = True
) -> List[Document]:
    """
    Scalable, high-performance PDF loader using PyMuPDF.
    
    Accepts:
        - Local file paths (e.g., '/data/sample.pdf' or 'C:\\docs\\notes.pdf')
        - Public remote URLs (e.g., ImageKit, S3, CloudFront)
        
    Features:
        - In-memory parsing via bytes (zero disk writes for remote files).
        - Hard memory bounds via streaming size validation.
        - Strips null characters (\x00) which break PostgreSQL/Vector DB insertions.
        - Detailed page-level metadata (page index, total pages, dimensions).
    """
    max_size_bytes = max_size_mb * 1024 * 1024
    is_url = _is_remote_url(file_source)

    # 1. Path extension sanity check
    clean_path = urlparse(file_source).path if is_url else file_source
    if not clean_path.lower().endswith(".pdf"):
        logger.error(f"Target is not a valid PDF source: {file_source}")
        return []

    # 2. Acquire raw binary stream safely
    try:
        if is_url:
            pdf_bytes = _fetch_remote_bytes(file_source, max_size_bytes)
        else:
            pdf_bytes = _validate_and_read_local(file_source, max_size_bytes)
    except (FileNotFoundError, PermissionError, PDFProcessingError) as err:
        logger.error(f"Validation failed for {file_source}: {err}")
        return []
    except Exception as exc:
        logger.error(f"Unexpected error acquiring {file_source}: {exc}", exc_info=True)
        return []

    # 3. Parse via PyMuPDF in memory
    doc: Optional[pymupdf.Document] = None
    valid_docs: List[Document] = []

    try:
        # Load directly from memory buffer
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

        # Handle Encrypted PDFs
        if doc.is_encrypted:
            if not password or not doc.authenticate(password):
                logger.error(f"PDF is encrypted and password verification failed: {file_source}")
                return []

        total_pages = len(doc)
        if total_pages == 0:
            logger.warning(f"PDF contains 0 pages: {file_source}")
            return []

        # Iterate page by page
        for page_idx in range(total_pages):
            page = doc[page_idx]
            
            # Extract plain text
            raw_text = page.get_text(sort=True) # sort=True preserves natural reading order
            
            if clean_null_bytes:
                raw_text = raw_text.replace("\x00", "")

            cleaned_text = raw_text.strip()
            
            # Only index pages with actual text content (filters blank pages)
            if cleaned_text:
                valid_docs.append(
                    Document(
                        page_content=cleaned_text,
                        metadata={
                            "source": file_source,
                            "page": page_idx + 1,
                            "total_pages": total_pages,
                            "is_remote": is_url,
                        }
                    )
                )

        if not valid_docs:
            logger.warning(
                f"No extractable text found in {file_source}. It might be a scanned image requiring OCR."
            )

        return valid_docs

    except pymupdf.FileDataError as exc:
        logger.error(f"Corrupted or invalid PDF structure for {file_source}: {exc}")
    except Exception as exc:
        logger.error(f"Unexpected parsing error for {file_source}: {exc}", exc_info=True)
    finally:
        # Always close document handle to release C memory immediately
        if doc is not None:
            doc.close()

    return []

# if __name__=="__main__":
#     data=safe_server_pdf_loader(r"D:\ProductionRAGFromScratch\backend\assets\dracula-713.pdf",10)
#     print(data)