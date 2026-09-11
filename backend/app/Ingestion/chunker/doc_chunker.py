from langchain_classic.text_splitter import RecursiveCharacterTextSplitter
# from langchain_classic.vectorstores import FAISS
# chunks
def doc_chunking(chunk_size=200,docs=[],user_id="ravi",conversation_id="ravi_praj"):
  try:
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size,chunk_overlap=30)
    chunks=splitter.split_documents(docs)
    # user_id="ravi_praj"
    # conversation_id="ravi"
    for chunk in chunks:
      chunk.metadata.update({"user_id":user_id,"conversation_id":conversation_id})
    return chunks
  except Exception as e:
    print(str(e))
    raise Exception("error in doc chunking")

  
  