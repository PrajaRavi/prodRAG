# eval_retriever.py
from dotenv import load_dotenv
import os
import asyncio
from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import ContextualRecallMetric, ContextualPrecisionMetric
from app.agents.Main_agent.nodes.retriever import retriever_node
from app.Ingestion.vectorstore.pinecone_service import similarity_search

# from src.reranker import RerankingRetriever
from LLMs.portkey import PortkeyGatewayJudge
from services.reranker import RerankingRetriever
from LLMs.NomicEmbed import NomicEmbeddingJudge
from evals.harness import load_goldens, summarize_by_metric, print_summary

load_dotenv()
groq_api_key=os.getenv("GROQ_FALLBACK_API_KEY")

GOLDEN_PATH = r"D:\ProductionRAGFromScratch\backend\Golden_data\retriever_golden.json"

JUDGE_MODEL =  PortkeyGatewayJudge()  # NOTE: differs from the other evals (gpt-4o-mini)
THRESHOLD = 0.7
embeddings=NomicEmbeddingJudge(os.getenv("NOMIC_API_KEY"))

retriever=RerankingRetriever()
def run():
    # 1. LOAD the golden set --- the fixed, human-authored truth
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED RETRIEVER on each question to fill retrieval_context,
    #    then build one test case per golden.
    test_cases = []
    for g in goldens:
        retrieved = retriever.invoke(g["query"])
        retrieval_context = [doc.page_content for doc in retrieved]

        test_cases.append(
            LLMTestCase(
                input=g["query"],
                expected_output=g["ideal_answer"],
                retrieval_context=retrieval_context,
                actual_output="(generator not evaluated in this run)",
            )
        )

    # 3. THE METRICS --- recall (did we miss?) and precision (ranked well?)
    metrics = [
        ContextualRecallMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        ContextualPrecisionMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
    ]

    # 4. EVALUATE --- every metric on every case, batched + parallel, printed report.
    #    hyperparameters travel with the run so the report is tagged with the config.
    result = evaluate(
        test_cases=test_cases,
        metrics=metrics,
        hyperparameters={
            "retriever": "SimpleVectorStore",          # vs "reranked" when you swap it in
            "embedding_model": "NomicEmbed",
            "chunk_size": 1000,
            "chunk_overlap": 160,
            "top_k": 3,
            "judge_model": "PortkeyGateway",
            "golden_set": GOLDEN_PATH,
        },
    )
    return summarize_by_metric(result)


def run_local():
    """Standalone convenience: build the retriever, then run."""
    return run()
    
    


if __name__ == "__main__":
    print_summary("retriever", run_local())