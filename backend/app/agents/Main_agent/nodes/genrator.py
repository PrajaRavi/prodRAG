
from typing import TypedDict

from langchain_core.messages import BaseMessage
from app.agents.Main_agent.state import AgentState
from utils.prompts import RAG_SYSTEM_PROMPT
from app.config import llms
from app.Ingestion.vectorstore.pinecone_service import similarity_search_with_score
from utils.utils import format_docs
from utils.utils import get_gemini_llm,get_groq_llm,llm_cache




GEMINI_LLM_genrator=None
async def genrator(state: AgentState) -> AgentState:

    context = state.get("context", "")
    query = state["query"]

    # if not context:
    #     print("I could not find relevant information in the provided documents. inside genrator node")
    #     return {
    #         "final_response": "I could not find relevant information in the provided documents."
    #     }
    global GEMINI_LLM_genrator
    
    if(state['api_configured']=="true"):
        print("🚀🚀🚀🎯🎯🎯using users groq llm")
        print(f"GEMINI_API_KEY {llm_cache[state['email']]['GEMINI']}")
        GEMINI_LLM_genrator=get_groq_llm(llm_cache[state['email']]['GROQ'])
    
    else:
        # global GEMINI_LLM_genrator
        GEMINI_LLM_genrator = llms.PRIMARY_GROQ_LLM
    
    prompt = RAG_SYSTEM_PROMPT.format(context=context)

    response = await GEMINI_LLM_genrator.ainvoke([
        ("system", prompt),
        ("human", query),
    ])

    return {
      "final_response":response.content,
      "messages":response}