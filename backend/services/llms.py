from langchain_ollama import ChatOllama,OllamaEmbeddings
from langchain_groq import ChatGroq
from langchain_nomic import NomicEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
groq_llm = ChatGroq(
    model="openai/gpt-oss-120b",
    temperature=0.3, #->it is between 0 to 2  and it is creativity parameter if it is 0 then for same question it will give same ans alway but as we increase this number then our model gives diffrent ans on each time on asking the  same question
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

embeddings = NomicEmbeddings(
    model="nomic-embed-text-v1.5", 
    inference_mode="remote"  # This tells LangChain to use the API, not your CPU
)
gemini_llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    # model="gemini-3.1-flash-lite-image",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

phi_llm=ChatOllama(
    model="phi4-mini:3.8b",
    temperature=0.4
)


llama=ChatOllama(
    model="llama3.2:1b",
    temperature=0.4
)
