import httpx
def format_docs(retrieved_docs):
  context_text = "\n\n".join(doc.page_content for doc in retrieved_docs)
  print(context_text)
  return context_text



async def validate_document_url(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.head(url, follow_redirects=True)

        if response.status_code != 200:
            return False

        content_type = response.headers.get("content-type", "").lower()

        return (
            "application/pdf" in content_type
            or "text/plain" in content_type
        )

    except httpx.HTTPError:
        return False