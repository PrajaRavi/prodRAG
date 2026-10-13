from deepeval.models.base_model import DeepEvalBaseLLM
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
from groq import RateLimitError as GroqRateLimitError,APIConnectionError,InternalServerError

from deepeval.metrics import AnswerRelevancyMetric
load_dotenv()
groq_api_key=os.getenv("new_groq_api_key")
PRIMARY_GROQ_LLM=ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=os.getenv("GROQ_FALLBACK_API_KEY"),
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
GROQ_FALLBACK_LLM=ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=groq_api_key,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)
GROQ_LLM=PRIMARY_GROQ_LLM.with_fallbacks(
        fallbacks=[GROQ_FALLBACK_LLM],
        exceptions_to_handle=(GroqRateLimitError,APIConnectionError,InternalServerError)
    )
class GroqJudge(DeepEvalBaseLLM):
    def __init__(self, groq_api_key: str):
        self.model = GROQ_LLM

    def load_model(self):
        return self.model

    def generate(self, prompt: str) -> str:
        return self.model.invoke(prompt).content

    async def a_generate(self, prompt: str) -> str:
        res = await self.model.ainvoke(prompt)
        return res.content

    def get_model_name(self):
        return "ChatGroq gpt-oss-120b"


