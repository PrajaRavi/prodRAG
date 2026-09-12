import os
from typing import Sequence

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone

from app.config import llms, settings


load_dotenv()


# ============================================================
# Custom Exceptions
# ============================================================


class VectorStoreError(Exception):
    """Base exception for vector store errors."""

    pass


class VectorStoreInitializationError(VectorStoreError):
    """Raised when Pinecone/vector store initialization fails."""

    pass


class VectorStoreUpsertError(VectorStoreError):
    """Raised when documents cannot be added to Pinecone."""

    pass


class VectorStoreSearchError(VectorStoreError):
    """Raised when similarity search fails."""

    pass


class VectorStoreValidationError(VectorStoreError):
    """Raised when invalid input is provided."""

    pass


# ============================================================
# Configuration
# ============================================================

PINECONE_API_KEY = settings.PINECONE_API_KEY

PINECONE_INDEX_NAME = settings.PINECONE_INDEX

PINECONE_NAMESPACE = os.getenv(
    "PINECONE_NAMESPACE",
    "prodRAG",
)


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
        raise ValueError(
            "Embedding model is not configured."
        )

except Exception as exc:
    raise VectorStoreInitializationError(
        "Failed to initialize embedding model."
    ) from exc


# ============================================================
# Pinecone Client
# ============================================================

try:

    pinecone_client = Pinecone(
        api_key=PINECONE_API_KEY
    )

except Exception as exc:

    raise VectorStoreInitializationError(
        "Failed to initialize Pinecone client."
    ) from exc


# ============================================================
# Pinecone Index
# ============================================================

try:

    pinecone_index = pinecone_client.Index(
        PINECONE_INDEX_NAME
    )

except Exception as exc:

    raise VectorStoreInitializationError(
        f"Failed to connect to Pinecone index "
        f"'{PINECONE_INDEX_NAME}'."
    ) from exc


# ============================================================
# Vector Store
# ============================================================

try:

    vector_store = PineconeVectorStore(
        index=pinecone_index,

        embedding=embeddings,
        namespace=PINECONE_NAMESPACE,
    )

except Exception as exc:

    raise VectorStoreInitializationError(
        "Failed to initialize Pinecone vector store."
    ) from exc


# ============================================================
# Get Vector Store
# ============================================================


def get_vector_store() -> PineconeVectorStore:
    """
    Return the Pinecone-backed vector store.
    """

    try:

        if vector_store is None:
            raise VectorStoreInitializationError(
                "Vector store is not initialized."
            )

        return vector_store

    except VectorStoreError:
        raise

    except Exception as exc:
        raise VectorStoreInitializationError(
            "Failed to retrieve vector store."
        ) from exc


# ============================================================
# Add Documents
# ============================================================


async def update_vector_store(
    chunks: Sequence[Document],
) -> list[str]:
    """
    Add document chunks to Pinecone asynchronously.

    Args:
        chunks:
            Sequence of LangChain Document objects.

    Returns:
        List of inserted vector IDs.

    Raises:
        VectorStoreValidationError:
            Invalid input.

        VectorStoreUpsertError:
            Pinecone/upsert failure.
    """

    try:

        # ----------------------------------------------------
        # Validate chunks
        # ----------------------------------------------------

        if not chunks:
            raise VectorStoreValidationError(
                "Cannot add an empty list of chunks."
            )

        if not isinstance(chunks, Sequence):
            raise VectorStoreValidationError(
                "chunks must be a sequence of Documents."
            )

        # ----------------------------------------------------
        # Validate individual documents
        # ----------------------------------------------------

        for index, chunk in enumerate(chunks):

            if not isinstance(chunk, Document):
                raise VectorStoreValidationError(
                    f"Invalid chunk at index {index}. "
                    f"Expected Document, got "
                    f"{type(chunk).__name__}."
                )

            if not chunk.page_content.strip():
                raise VectorStoreValidationError(
                    f"Chunk at index {index} contains "
                    "empty content."
                )

        # ----------------------------------------------------
        # Get vector store
        # ----------------------------------------------------

        store = get_vector_store()

        # ----------------------------------------------------
        # Insert documents
        # ----------------------------------------------------
        # print("printing chunks")
        # print(chunks)
        ids = await store.aadd_documents(
            documents=list(chunks)
        )

        # ----------------------------------------------------
        # Validate response
        # ----------------------------------------------------

        if not ids:
            raise VectorStoreUpsertError(
                "Pinecone did not return any vector IDs "
                "after document insertion."
            )

        return ids

    except VectorStoreError:
        raise

    except Exception as exc:
        print(exc)
        raise VectorStoreUpsertError(
            "Failed to add documents to Pinecone."
        ) from exc


# ============================================================
# Similarity Search
# ============================================================


async def similarity_search(
    query: str,
    k: int = 5,
) -> list[Document]:
    """
    Search Pinecone for the most relevant documents.

    Args:
        query:
            User search query.

        k:
            Number of documents to retrieve.

    Returns:
        List of relevant LangChain Documents.
    """

    try:

        # ----------------------------------------------------
        # Validate query
        # ----------------------------------------------------

        if not isinstance(query, str):
            raise VectorStoreValidationError(
                "Query must be a string."
            )

        query = query.strip()

        if not query:
            raise VectorStoreValidationError(
                "Query cannot be empty."
            )

        # ----------------------------------------------------
        # Validate k
        # ----------------------------------------------------

        if not isinstance(k, int):
            raise VectorStoreValidationError(
                "k must be an integer."
            )

        if k <= 0:
            raise VectorStoreValidationError(
                "k must be greater than 0."
            )

        # Optional safety limit
        if k > 100:
            raise VectorStoreValidationError(
                "k cannot be greater than 100."
            )

        # ----------------------------------------------------
        # Get vector store
        # ----------------------------------------------------

        store = get_vector_store()

        # ----------------------------------------------------
        # Search Pinecone
        # ----------------------------------------------------

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
    """
    Search Pinecone and return documents with similarity scores.

    Returns:
        [
            (Document, score),
            (Document, score),
            ...
        ]
    """

    try:

        # ----------------------------------------------------
        # Validate query
        # ----------------------------------------------------

        if not isinstance(query, str):
            raise VectorStoreValidationError(
                "Query must be a string."
            )

        query = query.strip()

        if not query:
            raise VectorStoreValidationError(
                "Query cannot be empty."
            )

        # ----------------------------------------------------
        # Validate k
        # ----------------------------------------------------

        if not isinstance(k, int):
            raise VectorStoreValidationError(
                "k must be an integer."
            )

        if k <= 0:
            raise VectorStoreValidationError(
                "k must be greater than 0."
            )

        if k > 100:
            raise VectorStoreValidationError(
                "k cannot be greater than 100."
            )

        # ----------------------------------------------------
        # Get vector store
        # ----------------------------------------------------

        store = get_vector_store()

        # ----------------------------------------------------
        # Search
        # ----------------------------------------------------

        results = await (
            store.asimilarity_search_with_score(
                query=query,
                k=k,
            )
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


from langchain_core.documents import Document


async def similarity_search_by_filter_metadata(
    query: str,
    user_id: str,
    conversation_id: str,
    k: int = 5,
) -> list[Document]:
    """
    Search Pinecone for documents belonging only to the
    specified user and conversation.
    """

    if not query or not query.strip():
        raise ValueError("Query cannot be empty.")

    if not user_id or not user_id.strip():
        raise ValueError("user_id cannot be empty.")

    if not conversation_id or not conversation_id.strip():
        raise ValueError("conversation_id cannot be empty.")

    if k <= 0:
        raise ValueError("k must be greater than 0.")

    try:
        results = await vector_store.asimilarity_search(
            query=query.strip(),
            k=k,
            filter={
                "user_id": {"$eq": user_id},
                "conversation_id": {"$eq": conversation_id},
            },
        )

        return results

    except Exception as exc:
        raise RuntimeError(
            "Failed to perform filtered similarity search."
        ) from exc


from pinecone.exceptions import PineconeException


def delete_conversation_documents(
    user_id: str,
    conversation_id: str,
) -> None:
    if not user_id or not user_id.strip():
        raise ValueError("user_id cannot be empty.")

    if not conversation_id or not conversation_id.strip():
        raise ValueError("conversation_id cannot be empty.")

    try:
        pinecone_index.delete(
            filter={
                "user_id": {"$eq": user_id.strip()},
                "conversation_id": {"$eq": conversation_id.strip()},
            },
            namespace=PINECONE_NAMESPACE,
        )

    except PineconeException as exc:
        raise RuntimeError(
            "Failed to delete conversation documents from Pinecone."
        ) from exc

    except Exception as exc:
        print(exc)
        raise RuntimeError(
            "Unexpected error while deleting conversation documents."
        ) from exc