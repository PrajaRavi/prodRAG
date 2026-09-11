from langchain_community.document_loaders import TextLoader


import os
import mimetypes
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document

def text_loader(file_path: str) -> list[Document]:
    # 1. Validate File Existence & Type
    if not os.path.exists(file_path):
        print(f"Error: File not found -> {file_path}")
        return []
    
    if not os.path.isfile(file_path):
        print(f"Error: Path is a directory, not a file -> {file_path}")
        return []

    # 2. Prevent OOM by Checking File Size (e.g., Limit to 50MB)
    MAX_SIZE_BYTES = 10 * 1024 * 1024
    if os.path.getsize(file_path) > MAX_SIZE_BYTES:
        print(f"Error: File exceeds size limit ({os.path.getsize(file_path)} bytes) -> {file_path}")
        return []

    # 3. Handle Text Loading with Auto Encoding Detection
    try:
        loader = TextLoader(file_path, autodetect_encoding=True)
        docs = loader.load()

        # Clean empty content or leftover NUL bytes
        valid_docs = []
        for doc in docs:
            cleaned_text = doc.page_content.replace("\x00", "").strip()
            if cleaned_text:
                doc.page_content = cleaned_text
                valid_docs.append(doc)

        return valid_docs

    except PermissionError:
        print(f"Permission denied accessing -> {file_path}")
    except UnicodeDecodeError:
        print(f"Encoding issue could not be resolved -> {file_path}")
    except Exception as e:
        print(f"Failed to load file {file_path}: {str(e)}")

    return []

