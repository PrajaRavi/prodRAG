
from typing import TypedDict

from langchain_core.messages import BaseMessage
from app.agents.Main_agent.state import AgentState
from utils.prompts import RAG_SYSTEM_PROMPT
from app.config import llms
from app.Ingestion.vectorstore.pinecone_service import similarity_search_with_score
from utils.utils import format_docs



async def genrator(state: AgentState) -> AgentState:

    context = state.get("context", "")
    query = state["query"]

    if not context:
        print("I could not find relevant information in the provided documents. inside genrator node")
        return {
            "final_response": "I could not find relevant information in the provided documents."
        }

    prompt = RAG_SYSTEM_PROMPT.format(context=context)

    response = await llms.GROQ_FALLBACK_LLM.ainvoke([
        ("system", prompt),
        ("human", query),
    ])

    return {
      "final_response":response.content,
      "messages":response
            }