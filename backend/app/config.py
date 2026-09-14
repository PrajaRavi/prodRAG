import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from groq import RateLimitError as GroqRateLimitError,APIConnectionError,InternalServerError
from langchain_google_genai import ChatGoogleGenerativeAI
from google.genai.errors import APIError,ServerError
# from google.genai.
from langchain_nomic import NomicEmbeddings
# from langchain_ollama import ChatOllama
# Load environment variables
load_dotenv()
# import logfire
# logfire.configure()


class Settings:
    # --- GEMINI Models ---
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    GEMINI_FALLBACK_API_KEY = os.getenv("GEMINI_FALLBACK_API_KEY")
    FANTASTIC_FOUR_GEMINI_KEY=os.getenv("FANTASTIC_FOUR_GEMINI_KEY") #!used in fallback

    # --- NOMIC EMBEDDINGS Models ---
    NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")


    # --- VECTOR DB (QDRANT)[NOt working] ---
    QDRANT_URL = os.getenv("QDRANT_CLUSTER_ENDPOINT")
    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    QDRANT_COLLECTION = "enterprise_rag"

    # --- VECTOR DB (PINECONE) ---
    # QDRANT_URL = os.getenv("QDRANT_CLUSTER_ENDPOINT")
    PINECONE_API_KEY = os.getenv("PINE_CONE_API_KEY")
    PINECONE_INDEX = "prodrag"

    # --- REASONING ENGINE (GROQ) ---
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = "openai/gpt-oss-120b",
    GROQ_FALLBACK_API_KEY = os.getenv("GROQ_FALLBACK_API_KEY")
    
    # --- GOOGLE FACT API ---
    GOOGLE_FACT_API=os.getenv("GOOGLE_FACT_API_KEY")
    GOOGLE_FALLBACK_FACT_API_KEY=os.getenv("GOOGLE_FALLBACK_FACT_API_KEY")

    # --- TAVILY API ---
    TAVILY_API_KEY=os.getenv("TAVILY_API_KEY")
    TAVILY_FALLBACK_API_KEY=os.getenv("TAVILY_FALLBACK_API_KEY")

    # --- NEWS API ---
    NEWS_API_KEY=os.getenv("NEWS_API_KEY")
    # TAVILY_FALLBACK_API_KEY=os.getenv("TAVILY_FALLBACK_API_KEY")

    # --- HIVE API ---
    HIVE_API_KEY=os.getenv("HIVE_API_KEY")

    # --- SUPABASE API ---
    SUPABASE_URL=os.getenv("SUPABASE_URL")
    SUPABASE_PUBLISHABLE_KEY=os.getenv("SUPABASE_PUBLISHABLE_KEY")

    # --- IMAGEKIT API ---
    IMAGEKIT_ID=os.getenv("IMAGEKIT_ID")
    IMAGEKIT_BASE_URL=os.getenv("IMAGEKIT_BASE_URL")
    IMAGEKIT_PUBLIC_KEY=os.getenv("IMAGEKIT_PUBLIC_KEY")
    IMAGEKIT_PRIVATE_KEY=os.getenv("IMAGEKIT_PRIVATE_KEY")


    # --- LLM GATEWAY (PORTKEY) ---
    PORTKEY_API_KEY = os.getenv("PORTKEY_API_KEY")
    GROQ_SLUG =  "groqSlug"     # primary: @groqSlug/openai/gpt-oss-120b
    GROQ_SLUG_2 = "groqSlugFallback"  # fallback: @groqSlugFallback/openai/gpt-oss-120b
    GEMINI_SLUG="geminiSlug"
    GEMINI_SLUG_2="geminiSlugfallback"
    
    # --- OBSERVABILITY ---
    LANGSMITH_TRACING = os.getenv("LANGSMITH_TRACING", "true")
    LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
    LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "production_rag_project")
    LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
    LOGFIRE_API=os.getenv("LOGFIRE_API_KEY")
    NVIDIA_API_KEY=os.getenv("NVIDIA_API_KEY")

# Apply LangChain environment variables for automatic tracing
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGSMITH_TRACING", "true")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGSMITH_API_KEY", "")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGSMITH_PROJECT", "PROD_RAG_RAVI")
os.environ["LANGCHAIN_ENDPOINT"] = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")



settings = Settings()

class LLMs:

    
    PRIMARY_GROQ_LLM=ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=settings.GROQ_API_KEY,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
    GROQ_FALLBACK_LLM=ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=settings.GROQ_FALLBACK_API_KEY,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
    GROQ_LLM=PRIMARY_GROQ_LLM.with_fallbacks(
        fallbacks=[GROQ_FALLBACK_LLM],
        exceptions_to_handle=(GroqRateLimitError,APIConnectionError,InternalServerError)
    )
    PRIMARY_GEMINI_LLM=ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    api_key=settings.GEMINI_API_KEY,
    # model="gemini-3.1-flash-lite-image",
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
    GEMINI_LLM_1=ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    api_key=settings.FANTASTIC_FOUR_GEMINI_KEY,
    # model="gemini-3.1-flash-lite-image",
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
    GEMINI_FALLBACK_LLM=ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    api_key=settings.GEMINI_FALLBACK_API_KEY,
    # model="gemini-3.1-flash-lite-image",
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
    GEMINI_LLM=PRIMARY_GEMINI_LLM.with_fallbacks(
        fallbacks=[GEMINI_LLM_1,GEMINI_FALLBACK_LLM],
        exceptions_to_handle=(APIError,ServerError)

    )
    # phi_llm=ChatOllama(
    #     model="phi4-mini:3.8b",
    #     temperature=0.4
    # )
    


    # llama=ChatOllama(
    #     model="llama3.2:1b",
    #     temperature=0.4
    # )

    embeddings = NomicEmbeddings(
        nomic_api_key=settings.NOMIC_API_KEY,
        dimensionality=512,
        model="nomic-embed-text-v1.5", 
        inference_mode="remote"  # This tells LangChain to use the API, not your CPU
    )

llms=LLMs()

