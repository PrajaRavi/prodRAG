"""
Pinecone + LangChain vector-store integration.

The Pinecone client and Index are initialized once per process and shared.
A lightweight PineconeVectorStore wrapper is created when needed, while
LangChain continues to handle embeddings, retrieval and compression pipelines.
"""

import asyncio
import os
from typing import Sequence

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from pinecone.exceptions import PineconeException

from langchain_community.document_compressors import FlashrankRerank
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_community.document_transformers import (
    EmbeddingsRedundantFilter,
    LongContextReorder,
)
from langchain_classic.retrievers.document_compressors import (
    DocumentCompressorPipeline,
)

from app.config import llms, settings


load_dotenv()


# ============================================================
# Custom Exceptions
# ============================================================

class VectorStoreError(Exception):
    """Base exception for vector-store errors."""


class VectorStoreInitializationError(VectorStoreError):
    """Raised when Pinecone/vector-store initialization fails."""


class VectorStoreUpsertError(VectorStoreError):
    """Raised when documents cannot be added to Pinecone."""


class VectorStoreSearchError(VectorStoreError):
    """Raised when similarity search fails."""


class VectorStoreValidationError(VectorStoreError):
    """Raised when invalid input is provided."""


# ============================================================
# Configuration
# ============================================================

PINECONE_API_KEY = settings.PINECONE_API_KEY
PINECONE_INDEX_NAME = settings.PINECONE_INDEX
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "prodRAG")

if not PINECONE_API_KEY:
    raise VectorStoreInitializationError(
        "PINECONE_API_KEY is not configured."
    )

if not PINECONE_INDEX_NAME:
    raise VectorStoreInitializationError(
        "PINECONE_INDEX is not configured."
    )


# ============================================================
# Embeddings
# ============================================================

try:
    embeddings = llms.embeddings

    if embeddings is None:
        raise ValueError("Embedding model is not configured.")

except Exception as exc:
    raise VectorStoreInitializationError(
        "Failed to initialize embedding model."
    ) from exc


# ============================================================
# Shared Pinecone Client and Index
# ============================================================

try:
    # One client per application process.
    # pool_threads configures the SDK's underlying worker pool.
    pinecone_client = Pinecone(
        api_key=PINECONE_API_KEY,
        pool_threads=20,
    )
    

    # The same Index object is reused by all vector-store wrappers.
    pinecone_index = pinecone_client.Index(PINECONE_INDEX_NAME)

except Exception as exc:
    raise VectorStoreInitializationError(
        f"Failed to initialize Pinecone index '{PINECONE_INDEX_NAME}'."
    ) from exc


# ============================================================
# Concurrency Control
# ============================================================

# Limits concurrent document-ingestion operations in this process.
# This is separate from Pinecone's pool_threads setting.
concurrency_semaphore = asyncio.Semaphore(10)


# ============================================================
# LangChain Vector Store Factory
# ============================================================

def get_vector_store() -> PineconeVectorStore:
    """
    Return a LangChain wrapper around the shared Pinecone Index.

    Creating this wrapper does NOT create another Pinecone client or index
    connection. Every wrapper receives the same global pinecone_index.
    """
    try:
        return PineconeVectorStore(
            index=pinecone_index,
            embedding=embeddings,
            namespace=PINECONE_NAMESPACE,
        )

    except Exception as exc:
        raise VectorStoreInitializationError(
            "Failed to create PineconeVectorStore wrapper."
        ) from exc


# ============================================================
# Shared Validation Helpers
# ============================================================

def _validate_chunks(chunks: Sequence[Document]) -> None:
    if not isinstance(chunks, Sequence) or isinstance(chunks, (str, bytes)):
        raise VectorStoreValidationError(
            "chunks must be a sequence of Documents."
        )

    if not chunks:
        raise VectorStoreValidationError(
            "Cannot add an empty list of chunks."
        )

    for index, chunk in enumerate(chunks):
        if not isinstance(chunk, Document):
            raise VectorStoreValidationError(
                f"Invalid chunk at index {index}. Expected Document, "
                f"got {type(chunk).__name__}."
            )

        if not isinstance(chunk.page_content, str) or not chunk.page_content.strip():
            raise VectorStoreValidationError(
                f"Chunk at index {index} contains empty content."
            )


def _validate_search_query(query: str, k: int) -> str:
    if not isinstance(query, str) or not query.strip():
        raise VectorStoreValidationError("Query must be a non-empty string.")

    if isinstance(k, bool) or not isinstance(k, int):
        raise VectorStoreValidationError("k must be an integer.")

    if k <= 0:
        raise VectorStoreValidationError("k must be greater than 0.")

    if k > 100:
        raise VectorStoreValidationError("k cannot be greater than 100.")

    return query.strip()


def _validate_user_conversation(user_id: str, conversation_id: str) -> None:
    if not isinstance(user_id, str) or not user_id.strip():
        raise VectorStoreValidationError("user_id cannot be empty.")

    if not isinstance(conversation_id, str) or not conversation_id.strip():
        raise VectorStoreValidationError("conversation_id cannot be empty.")


# ============================================================
# Add Documents
# ============================================================

# import asyncio
import logging
from typing import Sequence, List
# from langchain_core.documents import Document

logger = logging.getLogger(__name__)

# Maximum documents per individual network request
# 50 to 100 is optimal for staying well within 2MB payload and 30s timeout limits
BATCH_SIZE = 100

"""
concurrency_semaphor=10
socket 1-> doc1->2 page->200 chunks==>2 batch=>1 semaphore
socket 2-> doc2->800 page->1200 chunks=>10 batch=>1 semaphore

remaining 18 sockets are idle and still 8 new documents can be processed 
"""
async def update_vector_store(
    chunks: Sequence[Document],
) -> List[str]:
    """
    Adds LangChain Documents to Pinecone in bounded batches to prevent ReadTimeoutError.
    """
    try:
        _validate_chunks(chunks)
        store = get_vector_store()
        
        chunk_list = list(chunks) # 1200 chunks
        total_chunks = len(chunk_list)
        all_inserted_ids: List[str] = []

        # Split into smaller slices of 50-100 chunks
        batches = [
            chunk_list[i : i + BATCH_SIZE] # 0-100 chunks
            for i in range(0, total_chunks, BATCH_SIZE)
        ]

        logger.info(
            f"Ingesting {total_chunks} chunks across {len(batches)} batches (Batch size: {BATCH_SIZE})..."
        )
        

        async with concurrency_semaphore:
            # This is the shared[critical section]
            for batch_idx, batch in enumerate(batches, start=1):
                # Each mini-batch finishes in ~1-3s, completely avoiding timeout thresholds
                batch_ids = await store.aadd_documents(documents=batch)
                
                if not batch_ids:
                    raise VectorStoreUpsertError(
                        f"Pinecone returned no IDs for batch {batch_idx}/{len(batches)}."
                    )
                
                all_inserted_ids.extend(batch_ids)
                logger.info(f"Successfully upserted batch {batch_idx}/{len(batches)}")

        return all_inserted_ids

    except VectorStoreError:
        raise
    except Exception as exc:
        logger.error(f"Failed to upsert documents to Pinecone: {exc}", exc_info=True)
        raise VectorStoreUpsertError("Failed to add documents to Pinecone.") from exc


# 50-100 chunks keeps individual HTTP request payloads well below Pinecone's
# 2MB limit and completes well within the default socket timeout.
BATCH_SIZE = 100


def update_vector_store_celery(
    chunks: Sequence[Document],
) -> List[str]:
    """
    Synchronously upserts LangChain Documents into Pinecone in bounded batches.
    Designed for execution inside a standard prefork Celery worker process.
    """
    try:
        _validate_chunks(chunks)
        store = get_vector_store()

        chunk_list = list(chunks)
        total_chunks = len(chunk_list)
        all_inserted_ids: List[str] = []

        # Partition chunks into batches of BATCH_SIZE (100)
        batches = [
            chunk_list[i : i + BATCH_SIZE]
            for i in range(0, total_chunks, BATCH_SIZE)
        ]
        total_batches = len(batches)

        logger.info(
            f"Ingesting {total_chunks} chunks across {total_batches} batches "
            f"synchronously (Batch size: {BATCH_SIZE})..."
        )

        # Sequential batch processing inside the worker process
        for batch_idx, batch in enumerate(batches, start=1):
            # Synchronous Pinecone add_documents call
            batch_ids = store.add_documents(documents=batch)

            if not batch_ids:
                raise VectorStoreUpsertError(
                    f"Pinecone returned no IDs for batch {batch_idx}/{total_batches}."
                )

            all_inserted_ids.extend(batch_ids)
            logger.info(f"Successfully upserted batch {batch_idx}/{total_batches}")

        return all_inserted_ids

    except VectorStoreError:
        raise
    except Exception as exc:
        logger.error(f"Failed to upsert documents to Pinecone: {exc}", exc_info=True)
        raise VectorStoreUpsertError("Failed to add documents to Pinecone.") from exc
# ============================================================
# Similarity Search
# ============================================================

async def similarity_search(
    query: str,
    k: int = 5,
) -> list[Document]:
    """Search Pinecone and return the top-k LangChain Documents."""
    query = _validate_search_query(query, k)

    try:
        store = get_vector_store()

        results = await store.asimilarity_search(
            query=query,
            k=k,
        )

        if results is None:
            raise VectorStoreSearchError(
                "Pinecone returned no response."
            )

        return results

    except VectorStoreError:
        raise

    except Exception as exc:
        raise VectorStoreSearchError(
            "Failed to perform similarity search."
        ) from exc


# ============================================================
# Similarity Search With Score
# ============================================================

async def similarity_search_with_score(
    query: str,
    k: int = 5,
) -> list[tuple[Document, float]]:
    """Search Pinecone and return Documents with similarity scores."""
    query = _validate_search_query(query, k)

    try:
        store = get_vector_store()

        results = await store.asimilarity_search_with_score(
            query=query,
            k=k,
        )

        if results is None:
            raise VectorStoreSearchError(
                "Pinecone returned no response."
            )

        return results

    except VectorStoreError:
        raise

    except Exception as exc:
        raise VectorStoreSearchError(
            "Failed to perform similarity search with score."
        ) from exc


# ============================================================
# Contextual Compression: User + Conversation Scoped
# ============================================================

async def Contextual_compression_reorder_filter_metadata_flashRank(
    query: str,
    user_id: str,
    conversation_id: str,
    k: int = 5,
) -> list[Document]:
    """
    Retrieve documents for one user/conversation and apply:
    1. Pinecone similarity retrieval with metadata filter
    2. EmbeddingsRedundantFilter
    3. LongContextReorder
    4. FlashRank reranking
    """
    query = _validate_search_query(query, k)
    _validate_user_conversation(user_id, conversation_id)

    try:
        metadata_filter = {
            "user_id": {"$eq": user_id.strip()},
            "conversation_id": {"$eq": conversation_id.strip()},
        }

        store = get_vector_store()

        base_retriever = store.as_retriever(
            search_kwargs={
                "k": k,
                "filter": metadata_filter,
            }
        )

        compressor = FlashrankRerank(
            model="ms-marco-TinyBERT-L-2-v2"
        )

        redundant_filter = EmbeddingsRedundantFilter(
            embeddings=embeddings
        )

        reordering = LongContextReorder()

        pipeline = DocumentCompressorPipeline(
            transformers=[
                redundant_filter,
                reordering,
            ]
        )

        compression_retriever = ContextualCompressionRetriever(
            base_compressor=pipeline,
            base_retriever=base_retriever,
        )

        # Use the async retriever API inside this async function.
        docs = await compression_retriever.ainvoke(query)

        reranked_docs = await asyncio.to_thread(
            compressor.compress_documents,
            documents=docs,
            query=query,
        )

        return reranked_docs[:k]

    except Exception as exc:
        raise VectorStoreSearchError(
            "Failed in Contextual_compression_reorder_filter_metadata_flashRank."
        ) from exc


# ============================================================
# Contextual Compression: Evaluation / MMR
# ============================================================

async def Contextual_compression_reorder_filter_metadata_flashRank_eval(
    query: str,
    k: int = 5,
) -> list[Document]:
    """
    Retrieve using LangChain's MMR search strategy, then apply:
    1. EmbeddingsRedundantFilter
    2. LongContextReorder
    3. FlashRank reranking
    """
    query = _validate_search_query(query, k)

    try:
        store = get_vector_store()

        base_retriever = store.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": k,
                "fetch_k": max(k * 4, 20),
            },
        )

        compressor = FlashrankRerank(
            model="ms-marco-TinyBERT-L-2-v2"
        )

        redundant_filter = EmbeddingsRedundantFilter(
            embeddings=embeddings
        )

        reordering = LongContextReorder()

        pipeline = DocumentCompressorPipeline(
            transformers=[
                redundant_filter,
                reordering,
            ]
        )

        compression_retriever = ContextualCompressionRetriever(
            base_compressor=pipeline,
            base_retriever=base_retriever,
        )

        docs = await compression_retriever.ainvoke(query)

        reranked_docs = await asyncio.to_thread(
            compressor.compress_documents,
            documents=docs,
            query=query,
        )

        return reranked_docs[:k]

    except Exception as exc:
        raise VectorStoreSearchError(
            "Failed in Contextual_compression_reorder_filter_metadata_flashRank_eval."
        ) from exc


# ============================================================
# Similarity Search With Metadata Filter
# ============================================================

async def similarity_search_by_filter_metadata(
    query: str,
    user_id: str,
    conversation_id: str,
    k: int = 5,
) -> list[Document]:
    """Search only documents belonging to the specified user/conversation."""
    query = _validate_search_query(query, k)
    _validate_user_conversation(user_id, conversation_id)

    try:
        store = get_vector_store()

        results = await store.asimilarity_search(
            query=query,
            k=k,
            filter={
                "user_id": {"$eq": user_id.strip()},
                "conversation_id": {"$eq": conversation_id.strip()},
            },
        )

        return results

    except VectorStoreError:
        raise

    except Exception as exc:
        raise VectorStoreSearchError(
            "Failed to perform filtered similarity search."
        ) from exc


# ============================================================
# Delete Documents
# ============================================================

def delete_conversation_documents(
    user_id: str,
    conversation_id: str,
) -> None:
    """Delete all vectors for a specific user and conversation."""
    _validate_user_conversation(user_id, conversation_id)

    try:
        pinecone_index.delete(
            filter={
                "user_id": {"$eq": user_id.strip()},
                "conversation_id": {"$eq": conversation_id.strip()},
            },
            namespace=PINECONE_NAMESPACE,
        )

    except PineconeException as exc:
        raise VectorStoreError(
            "Failed to delete conversation documents from Pinecone."
        ) from exc

    except Exception as exc:
        raise VectorStoreError(
            "Unexpected error while deleting conversation documents."
        ) from exc


def delete_conversation_documents_by_user_id(
    user_id: str,
) -> None:
    """Delete all vectors belonging to a user in the configured namespace."""
    if not isinstance(user_id, str) or not user_id.strip():
        raise VectorStoreValidationError("user_id cannot be empty.")

    try:
        pinecone_index.delete(
            filter={
                "user_id": {"$eq": user_id.strip()},
            },
            namespace=PINECONE_NAMESPACE,
        )

    except PineconeException as exc:
        raise VectorStoreError(
            "Failed to delete user documents from Pinecone."
        ) from exc

    except Exception as exc:
        raise VectorStoreError(
            "Unexpected error while deleting user documents."
        ) from exc
