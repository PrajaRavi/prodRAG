from app.agents.Main_agent.state import AgentState
from typing import Literal
from langgraph.graph import END
def router(state:AgentState)->Literal['retriever',"__end__"]:
  print("router started")
  print(state['is_rag_query'])
  if(str(state['is_rag_query']).lower()=="true"):
    return "retriever"
  else:
    return "__end__"