from app.agents.Main_agent.state import AgentState
from langgraph.graph import StateGraph
from app.config import llms
from langgraph.prebuilt import ToolNode,tools_condition
from langgraph.graph import StateGraph,START,END
from app.agents.Main_agent.nodes.router import router
from app.agents.Main_agent.nodes.retriever import retriever_node
from app.agents.Main_agent.nodes.genrator import genrator
from app.agents.Main_agent.nodes.decision import rag_decision_node
graph=StateGraph(AgentState)
def create_graph():
  graph.add_node("decesion",rag_decision_node)
  graph.add_node("retriever",retriever_node)
  graph.add_node("genrator",genrator)

  graph.add_edge(START,"decesion")
  graph.add_conditional_edges("decesion",router)
  graph.add_edge("retriever","genrator")
  graph.add_edge("genrator",END)
  AGENTIC_RAG=graph.compile()
  return AGENTIC_RAG


