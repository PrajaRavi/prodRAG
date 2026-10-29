# eval_rag_pipeline.py
from dotenv import load_dotenv

from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualRelevancyMetric,
)
from LLMs.portkey import PortkeyGatewayJudge
from app.config import llms
from app.Isolation.pipeline_iso import RAGPipeline
from evals.harness import load_goldens, summarize_by_metric, print_summary
from langchain_classic.retrievers.document_compressors import LLMChainExtractor
from langchain_core.documents import Document

load_dotenv()

GOLDEN_PATH = "goldens/faithfulness_dataset.json"   # reuse the queries
JUDGE_MODEL = PortkeyGatewayJudge()
THRESHOLD = 0.7


def compress_retrieved_answers(query: str, ans: list[str]) -> list[str]:
    print(query)
    print(ans)
    """
    Compresses a list of retrieved answer chunks using LLMChainExtractor.
    
    Args:
        query (str): The user query or evaluation question.
        ans (list[str]): A list of raw retrieved text chunks/answers.
        llm (object): A LangChain-compatible LLM object (e.g., initialized via Portkey).
        
    Returns:
        list[str]: The contextually compressed version of the chunks.
    """
    # 1. Convert raw text chunks into LangChain Document objects
    documents = [Document(page_content=text) for text in ans]
    
    # 2. Initialize the LLM chain compressor with your LLM object
    compressor = LLMChainExtractor.from_llm(llms.GEMINI_FALLBACK_LLM)
    print('helllo')
    # 3. Compress the documents relative to the query
    compressed_docs = compressor.compress_documents(documents, query)
    
    # 4. Extract the compressed text contents back into a list of strings
    # Note: If a chunk contains zero relevant information, the extractor may omit it or return empty.
    compressed_ans = [doc.page_content for doc in compressed_docs if doc.page_content.strip()]
    
    return compressed_ans
def run(rag):
    # 1. LOAD queries (we only need the queries --- context comes from the pipeline now)
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED PIPELINE per query, build a test case from LIVE output
    test_cases = []
    for g in goldens:
        result = rag.invoke(g["query"])          # retrieve -> rerank -> generate
        # print("--------------context---------------------")
        # print(result['context'])
        ctx=compress_retrieved_answers(g["query"],result['context'])
        test_cases.append(
            LLMTestCase(
                input=g["query"],
                actual_output=result["answer"],       # what the generator produced
                retrieval_context=ctx,  # what the RETRIEVER returned
            )
        )

    # 3. THE THREE TRIAD METRICS
    metrics = [
        ContextualRelevancyMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        # FaithfulnessMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        # AnswerRelevancyMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
    ]

    # 4. EVALUATE
    result = evaluate(test_cases=test_cases, metrics=metrics)
    return summarize_by_metric(result)


def run_local():
    """Standalone convenience: build the pipeline, then run."""
    return run(RAGPipeline(5))


if __name__ == "__main__":
    print_summary("rag_pipeline", run_local())
    