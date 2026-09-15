import httpx
import os
from cryptography.fernet import Fernet
from app.config import llms
from pydantic import BaseModel,Field
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
import asyncio
from cachetools import TTLCache

def format_docs(retrieved_docs):
  context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
  print(context_text)
  return context_text



async def validate_document_url(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.head(url, follow_redirects=True)

        if response.status_code != 200:
            return False

        content_type = response.headers.get("content-type", "").lower()

        return (
            "application/pdf" in content_type
            or "text/plain" in content_type
        )

    except httpx.HTTPError:
        return False


# 1. Generate a key once, store it securely (e.g., in your .env file)
# Execute `Fernet.generate_key().decode()` in your terminal to create one.
SECRET_KEY = os.getenv("FERNET_KEY", "helloiamraviifjdifj384738")
cipher = Fernet(SECRET_KEY)


def encrypt_api_key(api_key: str) -> str:
    """Takes a raw string API key, encrypts it, and returns the encrypted string."""
    return cipher.encrypt(api_key.encode('utf-8')).decode('utf-8')


def decrypt_api_key(encrypted_api_key: str) -> str:
    """Takes an encrypted API key string, decrypts it, and returns the original string."""
    return cipher.decrypt(encrypted_api_key.encode('utf-8')).decode('utf-8')


# --- Example Usage ---
# raw_key = "sk_live_12345abcdef67890"

# Step 1: Encrypt
# encrypted_key = encrypt_api_key(raw_key)
# print("Encrypted:", encrypted_key)

# # Step 2: Decrypt back to original
# decrypted_key = decrypt_api_key(encrypted_key)
# print("Decrypted:", decrypted_key)




async def test_groq_api_key(groq_api_key: str) -> bool:
    """Tests a Groq API key asynchronously by sending a prompt to an LLM."""
    try:
        if not groq_api_key or not isinstance(groq_api_key, str):
            raise ValueError("API key must be a non-empty string.")

        groq_llm=ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=groq_api_key,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )   
        result=await groq_llm.ainvoke("hello how are you??")
        return bool(result.content and len(result.content.split())>0)
    except Exception as e:
        print(f"[Groq Test Failed]: {e}")
        return False

class Gemini_Ans(BaseModel):
    ans:str=Field(...,description="ans")

async def test_gemini_api_key(gemini_api_key: str) -> bool:
    """Tests a Gemini API key asynchronously using the official Google GenAI AsyncClient."""
    try:
        if not gemini_api_key or not isinstance(gemini_api_key, str):
            raise ValueError("API key must be a non-empty string.")

        # Using the non-blocking async client
        gemini_llm=ChatGoogleGenerativeAI(
            model="gemini-3.5-flash-lite",
            api_key=gemini_api_key,
            # model="gemini-3.1-flash-lite-image",
            max_tokens=None,
            timeout=None,
            max_retries=2,
        )
        struct_op=gemini_llm.with_structured_output(Gemini_Ans,method="function_calling")
        result=await struct_op.ainvoke("hello how are you??")
        print(result)
        return bool(result.ans and len(result.ans.split())>0)

    except Exception as e:
        print(f"[Gemini Test Failed]: {e}")
        return False


# import asyncio


import asyncio
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore


async def test_pinecone_api_key(
    pinecone_api_key: str, index_name: str = "temp-test-index"
) -> bool:
    """Tests a Pinecone API key asynchronously.

    Checks if index exists, creates it if missing, inserts test texts via VectorStore,
    and cleans up created test vectors.
    """
    try:
        if not pinecone_api_key or not isinstance(pinecone_api_key, str):
            raise ValueError("API key must be a non-empty string.")

        pinecone_client = Pinecone(api_key=pinecone_api_key.strip())
        loop = asyncio.get_running_loop()

        # 1. Check if index exists using the built-in method
        has_idx = await loop.run_in_executor(
            None, lambda: pinecone_client.has_index(index_name)
        )

        # 2. If index doesn't exist, create it with required parameters
        if not has_idx:
            print(f"'{index_name}' doesn't exist. Creating serverless index...")
            
            # Fetch dimension from your embeddings model (e.g., 1536 for OpenAI / HuggingFace)
            embedding_dim = len(llms.embeddings.embed_query("test"))

            await loop.run_in_executor(
                None,
                lambda: pinecone_client.create_index(
                    name=index_name,
                    dimension=embedding_dim,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                ),
            )

            # Poll until index is active and ready to accept data
            while True:
                desc = await loop.run_in_executor(
                    None, lambda: pinecone_client.describe_index(index_name)
                )
                if desc.status.get("ready", False):
                    break
                await asyncio.sleep(2)

            print(f"'{index_name}' created successfully!!!")

        # 3. Instantiate the Index instance and LangChain VectorStore
        pinecone_index = pinecone_client.Index(index_name)
        
        vector_store = PineconeVectorStore(
            index=pinecone_index,
            embedding=llms.embeddings,
            namespace="just",
        )

        # 4. Insert test data
        data = ["hello", "i am", "ravi", "prajapati"]
        ids = await vector_store.aadd_texts(data)

        # 5. Clean up vectors directly (ids is already a list)
        if ids and len(ids) > 0:
            await loop.run_in_executor(
                None, lambda: pinecone_index.delete(ids=ids, namespace="just")
            )
        print(len(ids))
        return bool(ids and len(ids) > 0)

    except Exception as e:
        print(f"[Pinecone Error]: {e}")
        return False

    
def get_groq_llm(
    api_key: str, model_name: str = "openai/gpt-oss-120b"
) -> ChatGroq:
    """Configures and returns a ChatGroq instance using the provided API key."""
    return ChatGroq(
        model=model_name,
        groq_api_key=api_key,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )


def get_gemini_llm(
    api_key: str, model_name: str = "gemini-3.5-flash-lite"
) -> ChatGoogleGenerativeAI:
    """Configures and returns a ChatGoogleGenerativeAI instance using the provided API key."""
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )

llm_cache = TTLCache(
    maxsize=100,
    ttl=3600,  # 1 hour
)


