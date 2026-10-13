from deepeval.models.base_model import DeepEvalBaseLLM
from langchain_openai import ChatOpenAI
from portkey_ai import PORTKEY_GATEWAY_URL, createHeaders
from dotenv import load_dotenv
import os
from deepeval.metrics import AnswerRelevancyMetric

load_dotenv()

# Setup Portkey client headers referencing your saved config slug
portkey_headers = createHeaders(
    api_key=os.getenv("PORTKEY_API_KEY"),
    config="pc-my-por-8880c3"
)

"openai/gpt-oss-20b"
# Initialize LangChain's ChatOpenAI pointing to Portkey Gateway URL 
# Portkey handles all 6 models, load balancing, and exponential backoff on the server-side.
portkey_llm = ChatOpenAI(
    base_url=PORTKEY_GATEWAY_URL,
    api_key="not-needed-handled-by-portkey-header",
    default_headers=portkey_headers,
    temperature=0.3
)

class PortkeyGatewayJudge(DeepEvalBaseLLM):
    def __init__(self):
        self.model = portkey_llm

    def load_model(self):
        return self.model

    def generate(self, prompt: str) -> str:
        return self.model.invoke(prompt).content

    async def a_generate(self, prompt: str) -> str:
        res = await self.model.ainvoke(prompt)
        return res.content

    def get_model_name(self):
        return "Portkey Multi-Model Gateway (Groq + Gemini)"

# Initialize the custom DeepEval model wrapper
gateway_model = PortkeyGatewayJudge()

# Use your gateway-backed model inside DeepEval metrics
metric = AnswerRelevancyMetric(threshold=0.7, model=gateway_model)