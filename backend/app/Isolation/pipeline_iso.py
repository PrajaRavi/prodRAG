from services.reranker import RerankingRetriever
from .generator_iso import generate_stream,generate
class RAGPipeline:
  def __init__(self,top_k):
    self.top_k=top_k

  def invoke(self,query):
    # retriever 
    retriever=RerankingRetriever(self.top_k,5)
    data=retriever.invoke(query)
    context=[text.page_content for text in data]

    # generator
    ans=generate({"query":query,"context":context})

    return {"query":query,"context":context,"answer":ans}

    
  

# rag=RAGPipeline(5)
# ans=rag.invoke("what is online eval?")
# print(ans)