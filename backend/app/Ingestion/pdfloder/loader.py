import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from pypdf.errors import PdfReadError
from datetime import datetime
import time

from pypdf import PdfReader
# import pdfplumber
# ! future improvement

    
def safe_server_pdf_loader(file_path: str, max_size_mb: int = 10, password: str = None) -> list[Document]:
    """
    Safely loads a PDF file from a server path into LangChain Documents.
    Handles missing files, size constraints, encryption, and empty/scanned pages.
    """
    # 1. Validate File Path & Type
    # if not os.path.exists(file_path):
    #     print(f"Error: File not found -> {file_path}")
    #     return []

    # if not os.path.isfile(file_path):
    #     print(f"Error: Path is a directory, not a file -> {file_path}")
    #     return []

    if not file_path.lower().endswith(".pdf"):
        print(f"Error: Target file is not a PDF -> {file_path}")
        return []

    # 2. Check File Size Limit to Prevent Memory Exhaustion
    # max_size_bytes = max_size_mb * 1024 * 1024
    # if os.path.getsize(file_path) > max_size_bytes:
    #     print(f"Error: PDF size ({os.path.getsize(file_path)} bytes) exceeds limit of {max_size_mb} MB -> {file_path}")
    #     return []

    # 3. Load PDF
    try:
        # Load PDF pages
        loader = PyPDFLoader(file_path, password=password)
        
        # Use lazy_load to process page-by-page safely
        valid_docs = []
        for doc in loader.lazy_load():
            # Clean content and remove embedded NUL bytes
            cleaned_text = doc.page_content.replace("\x00", "").strip()
            
            # Keep pages that contain extracted text
            if cleaned_text:
                doc.page_content = cleaned_text
                valid_docs.append(doc)

        if not valid_docs:
            print(f"Warning: No extractable text found in PDF (may be a scanned image/OCR required) -> {file_path}")

        return valid_docs

    except PermissionError:
        print(f"Error: Permission denied accessing -> {file_path}")
    except PdfReadError as e:
        print(f"Error: Failed to parse PDF (Corrupted or Encrypted) -> {file_path} ({e})")
    except Exception as e:
        print(f"Error: Unexpected failure while processing PDF {file_path} -> {str(e)}")

    return []

# time1=time.time()
# data =safe_server_pdf_loader(r"D:\ProductionRAGFromScratch\backend\assets\basel-framework-full.pdf")
# print(data)
# print(int(time.time())-int(time1))

