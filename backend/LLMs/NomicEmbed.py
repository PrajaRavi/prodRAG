from deepeval.models.base_model import DeepEvalBaseEmbeddingModel
from langchain_nomic import NomicEmbeddings


class NomicEmbeddingJudge(DeepEvalBaseEmbeddingModel):
    def __init__(self, nomic_api_key: str):
        # Initialize your NomicEmbeddings instance using your parameters
        self.model = NomicEmbeddings(
            nomic_api_key=nomic_api_key,
            model="nomic-embed-text-v1.5",
            inference_mode="remote"
        )

    def load_model(self):
        """Returns the underlying embedding model."""
        return self.model

    def embed_text(self, text: str) -> list[float]:
        """Embeds a single string of text and returns a vector."""
        return self.model.embed_query(text)

    async def a_embed_text(self, text: str) -> list[float]:
        """Asynchronously embeds a single string of text."""
        # LangChain's embed_query is synchronous, but we wrap it for async compliance
        return self.model.embed_query(text)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embeds a batch of texts and returns a list of vectors."""
        return self.model.embed_documents(texts)

    async def a_embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Asynchronously embeds a batch of texts."""
        return self.model.embed_documents(texts)

    def get_model_name(self) -> str:
        return "nomic-embed-text-v1.5 (Remote)"

# --- Example Usage ---
# nomic_embeddings_model = NomicEmbeddingJudge(nomic_api_key=os.getenv("NOMIC_API_KEY"))