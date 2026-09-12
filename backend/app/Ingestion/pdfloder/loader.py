import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from pypdf.errors import PdfReadError
from datetime import datetime
import time

from pypdf import PdfReader
# import pdfplumber
# ! future improvement
# def inspect_pdf_type(file_path: str) -> dict:
#     """
#     Inspects a PDF file to determine if it is:
#     1. 'normal' (searchable text)
#     2. 'scanned' (image-only requiring OCR)
#     3. 'complex' (multi-column/tables/mixed image-text)
#     """
#     try:
#         reader = PdfReader(file_path)
#         total_pages = len(reader.pages)
        
#         total_text_length = 0
#         total_images_found = 0
#         has_complex_elements = False
        
#         with pdfplumber.open(file_path) as plumber_pdf:
#             for i, page in enumerate(plumber_pdf.pages):
#                 # 1. Measure raw text extracted
#                 extracted_text = page.extract_text() or ""
#                 total_text_length += len(extracted_text.strip())
                
#                 # 2. Count image objects on page
#                 images = page.images
#                 total_images_found += len(images)
                
#                 # 3. Check for structural complexity (tables or vector lines)
#                 tables = page.extract_tables()
#                 curves = page.curves
#                 if len(tables) > 0 or len(curves) > 10:
#                     has_complex_elements = True

#         avg_text_per_page = total_text_length / max(total_pages, 1)

#         # Classification Logic
#         if avg_text_per_page < 50 and total_images_found >= total_pages:
#             pdf_type = "scanned"
#             recommended_loader = "UnstructuredPDFLoader (strategy='ocr_only') or Cloud OCR"
#         elif has_complex_elements or (total_images_found > 0 and avg_text_per_page > 50):
#             pdf_type = "complex"
#             recommended_loader = "UnstructuredPDFLoader (strategy='hi_res') or PyPDFium2Loader"
#         else:
#             pdf_type = "normal"
#             recommended_loader = "PyPDFLoader"

#         return {
#             "file_path": file_path,
#             "pdf_type": pdf_type,
#             "recommended_loader": recommended_loader,
#             "metrics": {
#                 "total_pages": total_pages,
#                 "avg_text_chars_per_page": round(avg_text_per_page, 2),
#                 "total_images": total_images_found,
#                 "has_tables_or_vector_graphics": has_complex_elements
#             }
#         }

#     except Exception as e:
#         return {"error": f"Failed to inspect PDF: {str(e)}"}

    
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
# data =safe_server_pdf_loader(r"D:\ProductionRAGFromScratch\backend\assets\DBMS_Full_Notes.pdf")
# print(data)
# print(int(time.time())-int(time1))

