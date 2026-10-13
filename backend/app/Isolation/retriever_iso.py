import os
import re
import glob

from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.Ingestion.vectorstore.pinecone_service import update_vector_store,get_vector_store,similarity_search,Contextual_compression_reorder_filter_metadata_flashRank
from langchain_nomic import NomicEmbeddings
import asyncio
load_dotenv()  # loads OPENAI_API_KEY from .env
groq_api_key=os.getenv("GROQ_API_KEY")
nomic_api_key=os.getenv("NOMIC_API_KEY")
DATA_DIR = "data"
DB_DIR = "chroma_store"


embeddings = NomicEmbeddings(
    nomic_api_key=nomic_api_key,
    model="nomic-embed-text-v1.5", 
    inference_mode="remote"  # This tells LangChain to use the API, not your CPU
)
# 1. LOAD ---- read each transcript, throw away the VTT timestamps
def load_transcripts():

    docs = []
    for path in glob.glob(f"{DATA_DIR}/*.vtt"):
        lines = []
        for line in open(path):
            line = line.strip()
            if not line or line == "WEBVTT" or "-->" in line:
                continue
            lines.append(line)
        text = " ".join(lines)

        session = re.search(r"Session[ _]*(\d+)", path).group(1)

        docs.append(Document(page_content=text, metadata={"session": session}))

    return docs


# 2. BUILD ---- chunk, embed once, and keep it on disk so we don't re-embed
def load_store():
    

    
    docs = load_transcripts()

    chunks = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
    ).split_documents(docs)

    asyncio.run(update_vector_store(chunks=chunks))



# 3. TRY IT ---- python src/retriever.py
if __name__ == "__main__":

    load_store()

    # results = retriever.invoke("what is regression testing?")
    results = asyncio.run(similarity_search("what is regression testing?"))
    
    for r in results:
        print(f"[Session {r.metadata['session']}] {r.page_content[:150]}...\n")