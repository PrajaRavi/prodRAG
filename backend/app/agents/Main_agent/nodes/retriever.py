from typing import TypedDict

from langchain_core.messages import BaseMessage
from app.agents.Main_agent.state import AgentState
from app.Ingestion.vectorstore.pinecone_service import similarity_search_by_filter_metadata
from utils.utils import format_docs




async def retriever_node(state: AgentState) -> AgentState:
    """
    Retrieve relevant documents for queries that require RAG.

    Retrieval is skipped when is_rag_query == "true".
    """
    print('running retriever')
    # ---------------------------------------------------------
    # 1. Check whether retrieval is required
    # ---------------------------------------------------------
    if state.get("is_rag_query") == "false":
        return {
            "context": ""
        }

    # ---------------------------------------------------------
    # 2. Validate query
    # ---------------------------------------------------------
    query = state.get("query", "").strip()
    user_id=state.get("user_id","ravi_praj")
    conversation_id=state.get("conversation_id","ravi")
        
    if not query:
        raise ValueError("Cannot perform retrieval: query is empty.")

    # ---------------------------------------------------------
    # 3. Retrieve documents
    # ---------------------------------------------------------
    try:
        data = await similarity_search_by_filter_metadata(query,user_id,conversation_id)

    except Exception as exc:
        raise RuntimeError(
            f"Failed to retrieve documents for query: {query}"
        ) from exc

    # ---------------------------------------------------------
    # 4. Format retrieved documents
    # ---------------------------------------------------------
    try:
        context = format_docs(data)

    except Exception as exc:
        raise RuntimeError(
            "Failed to format retrieved documents."
        ) from exc

    # ---------------------------------------------------------
    # 5. Return context
    # ---------------------------------------------------------
    return {
        "context": context
        
    }