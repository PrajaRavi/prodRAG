from typing import TypedDict,Annotated,List,Literal
from pydantic import Field
from langgraph.graph.message import add_messages
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage,SystemMessage,AIMessage,BaseMessage


class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    is_rag_query:str=Field(description="return true or false",default="true")
    retrieved_chunks:List[Document]
    api_configured:str=Field(description="true or false")
    rag_reason:str
    query:str
    context:str
    final_response:str
    user_id:str
    deep_think:str
    email:str
    conversation_id:str