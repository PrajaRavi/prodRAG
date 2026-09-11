import os
import mimetypes
from typing import List, Callable, Dict
from langchain_core.documents import Document
from app.Ingestion.chunker.doc_chunker import doc_chunking
from app.Ingestion.txtloader.loader import text_loader
from app.Ingestion.pdfloder.loader import safe_server_pdf_loader
from app.Ingestion.vectorstore.pinecone_service import update_vector_store
import asyncio
# Import specialized LangChain loaders
from langchain_community.document_loaders import (
    TextLoader,
    PyPDFLoader,
    CSVLoader,
    JSONLoader,
    UnstructuredMarkdownLoader,
    UnstructuredFileLoader,
)

def _load_txt(file_path: str) -> List[Document]:
    docs = text_loader(file_path=file_path)
    return docs

def _load_pdf(file_path: str) -> List[Document]:
    docs = safe_server_pdf_loader(file_path)
    return list(docs)

def _load_csv(file_path: str) -> List[Document]:
    loader = CSVLoader(file_path, encoding="utf-8")
    return list(loader)

def _load_json(file_path: str) -> List[Document]:
    # jq_schema="." extracts all json fields; adjust schema as needed
    loader = JSONLoader(file_path, jq_schema=".", text_content=False)
    return list(loader)

def _load_markdown(file_path: str) -> List[Document]:
    loader = UnstructuredMarkdownLoader(file_path)
    return loader.load()

def _load_fallback(file_path: str) -> List[Document]:
    """Fallback loader for non-standard formats (docx, pptx, html, etc.)."""
    loader = UnstructuredFileLoader(file_path)
    return loader.load()


# Extension-to-Loader Routing Registry
LOADER_REGISTRY: Dict[str, Callable[[str], List[Document]]] = {
    ".txt": _load_txt,
    ".log": _load_txt,
    ".pdf": _load_pdf,
    ".csv": _load_csv,
    ".json": _load_json,
    ".md": _load_markdown,
}


async def complete_Ingestion(file_path: str, max_size_mb: int = 10,user_id="ravi",conversation_id="ravi_praj") -> List[Document]:
    """
    Global dispatcher function to inspect a file's extension and execute
    the appropriate loader while enforcing size and security safety checks.
    """
    # 1. Path & Existence Checks
    if not os.path.exists(file_path):
        print(f"[Error] File does not exist: {file_path}")
        return []

    if not os.path.isfile(file_path):
        print(f"[Error] Provided path is a directory, not a file: {file_path}")
        return []

    # 2. File Size Validation (OOM Protection)
    max_bytes = max_size_mb * 1024 * 1024
    file_size = os.path.getsize(file_path)
    if file_size > max_bytes:
        print(f"[Error] File size ({file_size} bytes) exceeds limit ({max_size_mb} MB): {file_path}")
        return []

    # 3. Extract File Extension
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    # 4. Resolve Loader Strategy
    loader_func = LOADER_REGISTRY.get(ext, _load_fallback)

    # 5. Execute Loading Strategy
    try:
        raw_docs = loader_func(file_path)
        
        # 6. Post-processing: Remove NUL bytes and discard empty documents
        # cleaned_docs = []
        # for doc in raw_docs:
        #     text = doc.page_content.replace("\x00", "").strip()
        #     if text:
        #         doc.page_content = text
        #         # Enrich metadata with auto-detected loader metadata
        #         doc.metadata["file_extension"] = ext
        #         cleaned_docs.append(doc)

        # return cleaned_docs
        #! now first chunk this data using RecursiveTextSplitting
        chunks=doc_chunking(600,raw_docs,user_id,conversation_id)

        #! now store in PINECONE DB
        result=await update_vector_store(chunks)
        return result


    

    except PermissionError:
        print(f"[Error] Permission denied reading file: {file_path}")
    except Exception as e:
        print(f"[Error] Failed to load {file_path} using loader for '{ext}': {str(e)}")

    return []

# data=asyncio.run(complete_Ingestion(r"D:\ProductionRAGFromScratch\backend\assets\DBMS_Full_Notes.pdf"))
# print(data)