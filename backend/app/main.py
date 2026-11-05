"""
Production RAG Backend Service
==============================
FastAPI service orchestrating document ingestion, ImageKit asset processing,
Pinecone vector indexing, LangGraph multi-agent RAG workflow, and SSE streaming.
"""

import hmac
import hashlib
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from imagekitio import ImageKit
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field
from supabase import Client, create_client

import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings
from app.Ingestion.processor import complete_Ingestion
from app.Ingestion.vectorstore.pinecone_service import (
    delete_conversation_documents,
    delete_conversation_documents_by_user_id,
)

ingestion_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="rag_worker")
from app.agents.Main_agent.graph import create_graph
from DB.database import db
from utils.utils import (
    decrypt_api_key,
    encrypt_api_key,
    llm_cache,
    test_gemini_api_key,
    test_groq_api_key,
    validate_document_url,
)

# ---------------------------------------------------------------------------
# Logging Setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("production_rag")

# ---------------------------------------------------------------------------
# Configuration & External Clients
# ---------------------------------------------------------------------------
IMAGEKIT_PUBLIC_KEY = settings.IMAGEKIT_PUBLIC_KEY
IMAGEKIT_PRIVATE_KEY = settings.IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT_BASE = settings.IMAGEKIT_BASE_URL
IMAGEKIT_ID = settings.IMAGEKIT_ID

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_PUBLISHABLE_KEY,
)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://prodrag-2.onrender.com",
]

# ---------------------------------------------------------------------------
# Pydantic Request / Response Models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    query: str = Field(..., description="User question or input prompt")
    conversation_id: str = Field(..., description="Unique conversation UUID")
    user_id: str = Field(..., description="Unique user identifier")
    email: str = Field(..., description="Email of the authenticated user")
    api_configured: Union[bool, str] = Field(
        default="false",
        description="Whether the user has configured custom API keys",
    )
    deep_think: Union[bool, str] = Field(
        default="false",
        description="Flag indicating if deep thinking mode is enabled",
    )


class ConfigureApiKeyRequest(BaseModel):
    GROQ_API_KEY: str = Field(..., description="User Groq API key")
    GEMINI_API_KEY: str = Field(..., description="User Gemini API key")
    PINECONE_API_KEY: Optional[str] = Field(
        default="",
        description="Optional Pinecone API key",
    )
    email: str = Field(..., description="Email of the user configuring keys")


class DeleteConversationRequest(BaseModel):
    user_id: str = Field(..., description="Target user identifier")
    conversation_id: Optional[str] = Field(
        default=None,
        description="Target conversation UUID (optional for user-wide delete)",
    )


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
def sse_event(event_type: str, data: Any) -> str:
    """Formats an Server-Sent Event (SSE) payload."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def cache_user_data(groq: str, gemini: str, email: str) -> bool:
    """Caches decrypted API keys in TTL in-memory cache for quick retrieval."""
    llm_cache[email] = {"GROQ": groq, "GEMINI": gemini}
    return True


def verify_imagekit_signature(token: str, expire: int, signature: str) -> bool:
    """
    Validates that the ImageKit signature was signed by our secret key and hasn't expired.
    Raises HTTPException(401/403) on validation failure.
    """
    if not IMAGEKIT_PRIVATE_KEY:
        logger.error("IMAGEKIT_PRIVATE_KEY is missing from environment settings.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: ImageKit secret key missing.",
        )

    current_time = int(time.time())
    if current_time > expire:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature has expired. Please request a new upload signature.",
        )

    auth_string = f"{token}{expire}".encode("utf-8")
    expected_signature = hmac.new(
        IMAGEKIT_PRIVATE_KEY.encode("utf-8"),
        auth_string,
        hashlib.sha1,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature or unauthorized request.",
        )

    return True


async def delete_imagekit_file(file_id: str) -> bool:
    """Deletes temporary uploaded document from ImageKit storage."""
    if not IMAGEKIT_PRIVATE_KEY:
        logger.warning("IMAGEKIT_PRIVATE_KEY is not configured; skipping ImageKit deletion.")
        return False

    url = f"https://api.imagekit.io/v1/files/{file_id}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.delete(
                url,
                auth=(IMAGEKIT_PRIVATE_KEY, ""),
            )

        if response.status_code in (200, 204, 404):
            logger.info(f"File '{file_id}' successfully removed from ImageKit storage.")
            return True

        logger.warning(
            f"ImageKit file deletion responded with status {response.status_code}: {response.text}"
        )
        return False

    except Exception as exc:
        logger.warning(f"Error during ImageKit file deletion for '{file_id}': {exc}")
        return False


# ---------------------------------------------------------------------------
# Application Lifespan & Initialization
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting Production RAG application...")

    # Initialize LangGraph Chatbot
    try:
        app.state.chatbot = create_graph()
        logger.info("🤖 LangGraph Chatbot graph compiled successfully.")
    except Exception as exc:
        logger.error(f"Failed to initialize chatbot graph: {exc}", exc_info=True)
        raise exc

    yield

    logger.info("🛑 Shutting down application...")
    try:
        if hasattr(db, "close"):
            await db.close()
    except Exception as exc:
        logger.warning(f"Error while closing database connection pool: {exc}")


app = FastAPI(
    title="Production RAG Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Route: System & Health
# ---------------------------------------------------------------------------
@app.get("/")
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Production RAG Backend",
        "version": "1.0.0",
    }


@app.get("/workflow")
def get_workflow(request: Request) -> Response:
    """Generates and returns a PNG diagram of the LangGraph workflow."""
    chatbot = getattr(request.app.state, "chatbot", None)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chatbot engine is not initialized.",
        )

    try:
        image_bytes = chatbot.get_graph().draw_mermaid_png()
        return Response(content=image_bytes, media_type="image/png")
    except Exception as exc:
        logger.error(f"Failed to render mermaid workflow diagram: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not render workflow diagram: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Route: ImageKit Authentication
# ---------------------------------------------------------------------------
@app.get("/api/imagekit-auth")
def generate_imagekit_signature() -> Dict[str, Any]:
    """
    Generates authentication parameters (token, expire, signature)
    required for the client-side ImageKit upload SDK.
    """
    if not IMAGEKIT_PRIVATE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: ImageKit private key is missing.",
        )

    try:
        ik_client = ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)
        auth_params = ik_client.helper.get_authentication_parameters()

        return {
            "token": auth_params["token"],
            "expire": auth_params["expire"],
            "signature": auth_params["signature"],
            "imagekit_id": IMAGEKIT_ID,
        }
    except Exception as exc:
        logger.error(f"Error generating ImageKit signature: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate ImageKit signature: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Route: API Keys Configuration
# ---------------------------------------------------------------------------
@app.post("/api/configure_api_keys")
async def configure_api_keys(payload: ConfigureApiKeyRequest) -> JSONResponse:
    """
    Tests user-supplied Groq and Gemini API keys.
    If valid, encrypts and stores them in Supabase, and populates the local cache.
    """
    try:
        groq_valid = await test_groq_api_key(payload.GROQ_API_KEY)
        gemini_valid = await test_gemini_api_key(payload.GEMINI_API_KEY)

        if not (groq_valid and gemini_valid):
            # Invalidate any stale cache entry
            llm_cache.pop(payload.email, None)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"success": False, "msg": "API keys are wrong"},
            )

        # Encrypt keys for storage
        groq_encrypted = encrypt_api_key(payload.GROQ_API_KEY)
        gemini_encrypted = encrypt_api_key(payload.GEMINI_API_KEY)

        # Cache active keys in memory
        cache_user_data(payload.GROQ_API_KEY, payload.GEMINI_API_KEY, payload.email)

        # Persist to Supabase
        supabase.from_("users").update({
            "GROQ_API_KEY": groq_encrypted,
            "GEMINI_API_KEY": gemini_encrypted,
            "api_configured": True,
        }).eq("email", payload.email).execute()

        logger.info(f"API keys configured successfully for {payload.email}")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"success": True, "msg": "done"},
        )

    except Exception as exc:
        logger.error(f"Error configuring API keys for {payload.email}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure API keys: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Route: RAG Document Processing & Cleanup Pipeline
# ---------------------------------------------------------------------------
@app.post("/api/RAG_process_delete_file_pipeline")
async def rag_process_delete_file_pipeline(
    file_id: str = Query(..., description="file_id of target document in ImageKit"),
    path: str = Query(..., description="Public URL of the uploaded document"),
    signature: str = Query(..., description="HMAC signature for authorization"),
    token: str = Query(..., description="Token associated with signature"),
    expire: int = Query(..., description="Expiration timestamp of signature"),
    user_id: str = Query(..., description="User ID"),
    conversation_id: str = Query(..., description="Conversation ID"),
) -> JSONResponse:
    """
    Validates HMAC signature, checks document URL, ingests chunks into Pinecone,
    and removes the temporary document from ImageKit.
    """
    # 1. Authorize ImageKit signature
    verify_imagekit_signature(token, expire, signature)

    # 2. Validate document URL accessibility & mime type
    is_valid_url = await validate_document_url(path)
    if not is_valid_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provided document URL is invalid, inaccessible, or unsupported.",
        )
    loop = asyncio.get_running_loop()
    # 3. Ingest document chunks into Pinecone vector store
    try:
        ingestion_result = await complete_Ingestion(path, 10, user_id, conversation_id)
        if not ingestion_result or len(ingestion_result) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Problem during document Ingestion into vector store.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error during document ingestion: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing document ingestion: {str(exc)}",
        )

    # 4. Clean up temporary uploaded file from ImageKit
    await delete_imagekit_file(file_id)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "message": f"File '{file_id}' successfully ingested and removed from temporary storage.",
            "file_id": file_id,
            "conversation_id": conversation_id,
            "chunks_count": len(ingestion_result),
        },
    )


# ---------------------------------------------------------------------------
# Route: Chat Streaming (SSE)
# ---------------------------------------------------------------------------
@app.post("/chat")
async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    """
    Handles conversational user queries via Server-Sent Events (SSE).
    Orchestrates agentic routing, vector retrieval, and response streaming.
    """
    chatbot = getattr(request.app.state, "chatbot", None)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chatbot engine is not initialized.",
        )

    # Check and preload user API keys into cache if available
    user_email = body.email.strip() if body.email else ""
    if user_email and not llm_cache.get(user_email):
        try:
            result = (
                supabase.from_("users")
                .select("GROQ_API_KEY,GEMINI_API_KEY,api_configured")
                .eq("email", user_email)
                .execute()
            )
            if result.data and len(result.data) > 0:
                user_row = result.data[0]
                if user_row.get("api_configured") is True:
                    groq_enc = user_row.get("GROQ_API_KEY")
                    gemini_enc = user_row.get("GEMINI_API_KEY")
                    if groq_enc and gemini_enc:
                        groq_dec = decrypt_api_key(groq_enc)
                        gemini_dec = decrypt_api_key(gemini_enc)
                        cache_user_data(groq_dec, gemini_dec, user_email)
                        logger.info(f"Loaded and cached credentials for {user_email}")
        except Exception as exc:
            logger.warning(f"Could not load custom API keys for {user_email}: {exc}")

    # Normalize string/bool parameters for agent state
    api_configured_str = "true" if str(body.api_configured).lower() in ("true", "1") else "false"
    deep_think_str = "true" if str(body.deep_think).lower() in ("true", "1") else "false"

    async def event_generator():
        logger.info(
            f"Starting chat stream: conversation_id={body.conversation_id}, user_id={body.user_id}"
        )
        try:
            async for event in chatbot.astream_events(
                {
                    "messages": [HumanMessage(content=body.query)],
                    "query": body.query,
                    "final_response": "nothing",
                    "conversation_id": body.conversation_id,
                    "user_id": body.user_id,
                    "api_configured": api_configured_str,
                    "email": body.email,
                    "deep_think": deep_think_str,
                },
                config={"configurable": {"thread_id": body.conversation_id}},
                version="v2",
            ):
                event_name = event.get("event")
                event_data = event.get("data", {})

                try:
                    if event_name == "on_tool_start":
                        yield sse_event("on_tool_start", event.get("name", "tool"))

                    elif event_name == "on_parser_end":
                        output = event_data.get("output")
                        if output is not None:
                            is_relevant = getattr(output, "is_query_relevant", None)
                            if is_relevant is None and isinstance(output, dict):
                                is_relevant = output.get("is_query_relevant")

                            if str(is_relevant).lower() == "false":
                                refusal_msg = getattr(output, "msg", None)
                                if refusal_msg is None and isinstance(output, dict):
                                    refusal_msg = output.get("msg", "")
                                yield sse_event("on_parser_end", refusal_msg or "")

                    elif event_name == "on_chain_end":
                        output = event_data.get("output")
                        if isinstance(output, dict):
                            if (
                                "messages" in output
                                and output.get("is_rag_query") == "true"
                            ):
                                chunks = output.get("retrieved_chunks", [])
                                serialized_chunks = [
                                    {
                                        "page_content": getattr(doc, "page_content", "")
                                        if not isinstance(doc, dict)
                                        else doc.get("page_content", ""),
                                        "metadata": getattr(doc, "metadata", {})
                                        if not isinstance(doc, dict)
                                        else doc.get("metadata", {}),
                                    }
                                    for doc in chunks
                                ]
                                yield sse_event("retrieved_chunks", serialized_chunks)

                    elif event_name == "on_chat_model_stream":
                        chunk = event_data.get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            yield sse_event("message", chunk.content)

                except Exception as inner_exc:
                    logger.warning(f"Error handling event '{event_name}': {inner_exc}")
                    yield sse_event("error", str(inner_exc))

        except Exception as stream_exc:
            logger.error(f"Stream generation error: {stream_exc}", exc_info=True)
            yield sse_event("error", str(stream_exc))

        yield sse_event("done", "[DONE]")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Route: Chat Thread History
# ---------------------------------------------------------------------------
@app.get("/chat/{thread_id}")
async def get_chat_history(thread_id: str, request: Request) -> Dict[str, Any]:
    """Retrieves conversation history for a given thread_id from LangGraph state."""
    chatbot = getattr(request.app.state, "chatbot", None)
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chatbot engine is not initialized.",
        )

    try:
        state = await chatbot.aget_state({"configurable": {"thread_id": thread_id}})
        raw_messages = (state.values or {}).get("messages", []) if state else []

        chat_history = []
        for message in raw_messages:
            msg_type = getattr(message, "type", "")
            msg_id = getattr(message, "id", None)
            msg_content = getattr(message, "content", "")

            if msg_type == "human":
                chat_history.append({
                    "id": msg_id,
                    "role": "user",
                    "content": msg_content,
                })
            elif msg_type == "ai":
                chat_history.append({
                    "id": msg_id,
                    "role": "assistant",
                    "content": msg_content,
                })
            elif msg_type == "system":
                chat_history.append({
                    "id": msg_id,
                    "role": "system",
                    "content": msg_content,
                })

        return {
            "success": True,
            "thread_id": thread_id,
            "messages": chat_history,
        }

    except Exception as exc:
        logger.error(f"Error retrieving history for thread '{thread_id}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chat history: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# Route: Vector Store Cleanups (Pinecone)
# ---------------------------------------------------------------------------
@app.delete("/api/delete_pinecone_index_with_user_id")
async def delete_by_user_id(request: DeleteConversationRequest) -> Dict[str, Any]:
    """Deletes all vectorized document chunks associated with a user ID from Pinecone."""
    if not request.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required.",
        )

    try:
        delete_conversation_documents_by_user_id(user_id=request.user_id)
        return {
            "success": True,
            "message": "Conversation documents deleted successfully.",
            "user_id": request.user_id,
            "conversation_id": request.conversation_id,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(f"Error deleting vectors for user '{request.user_id}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc


@app.delete("/api/delete_pinecone_index_with_user_id_and_conversation_id")
async def delete_by_user_and_conversation(
    request: DeleteConversationRequest,
) -> Dict[str, Any]:
    """Deletes document vectors for a specific conversation ID and user ID from Pinecone."""
    if not request.user_id or not request.conversation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both user_id and conversation_id are required.",
        )

    try:
        delete_conversation_documents(
            user_id=request.user_id,
            conversation_id=request.conversation_id,
        )
        return {
            "success": True,
            "message": "Conversation documents deleted successfully.",
            "user_id": request.user_id,
            "conversation_id": request.conversation_id,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error(
            f"Error deleting vectors for conversation '{request.conversation_id}': {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
