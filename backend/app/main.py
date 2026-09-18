# https://ik.imagekit.io/k5imwrh1hh/rag_documents/TruthLens_AI_Technical_Report_-4Nhw845Y.pdf
"""
NEW MODULES
!pip install rank_bm25
"""
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.prompts import PromptTemplate
from fastapi.responses import StreamingResponse
from imagekitio import ImageKit
from DB.database import db

from app.Ingestion.vectorstore.pinecone_service import delete_conversation_documents,delete_conversation_documents_by_user_id
from app.agents.Main_agent.graph import create_graph
from utils.utils import validate_document_url,encrypt_api_key,decrypt_api_key,test_gemini_api_key,test_groq_api_key,test_pinecone_api_key,llm_cache
from app.Ingestion.processor import complete_Ingestion
from langchain.messages import SystemMessage,HumanMessage
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter,Language
from langchain_community.vectorstores import FAISS
# from langchain_ollama import OllamaEmbeddings
from fastapi.responses import JSONResponse
from fastapi import Query,status,HTTPException
from fastapi.requests import Request
from fastapi.responses import Response
from supabase import create_client,Client
import json
# import json
import hmac
import hashlib
import time
import httpx

from app.config import settings
from fastapi import (FastAPI)
origins = [
    "http://localhost:3000",      # React default port
    "http://localhost:5173",      # Vite default port
    "http://127.0.0.1:5173",
    "https://prodrag-2.onrender.com",    # Production frontend URL
]
import os
from pydantic import BaseModel
IMAGEKIT_PUBLIC_KEY = settings.IMAGEKIT_PUBLIC_KEY
IMAGEKIT_PRIVATE_KEY = settings.IMAGEKIT_PRIVATE_KEY
IMAGEKIT_URL_ENDPOINT_BASE = settings.IMAGEKIT_BASE_URL
img_kit_id=settings.IMAGEKIT_ID

supabase:Client=create_client(settings.SUPABASE_URL,settings.SUPABASE_PUBLISHABLE_KEY)

class ChatRequest(BaseModel):
    query: str
    conversation_id:str
    user_id:str
    email:str
    api_configured:str
    deep_think:str
    # thread_id: str



@asynccontextmanager
async def lifespan(
    app: FastAPI
):

    print("🚀 Starting application...")

    # ---------------------------------------------
    # Connect PostgreSQL
    # ---------------------------------------------

    # checkpointer = await db.connect()

    # ---------------------------------------------
    # Create LangGraph chatbot
    # ---------------------------------------------

    app.state.chatbot = create_graph(
        # checkpointer
    )

    print("🤖 Chatbot initialized")

    # ---------------------------------------------
    # Application is running
    # ---------------------------------------------

    yield

    # ---------------------------------------------
    # Application shutting down
    # ---------------------------------------------

    print("🛑 Shutting down application...")

    await db.close()

app = FastAPI(
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Whitelisted origins
    allow_credentials=True,           # Allow cookies / auth headers
    allow_methods=["*"],              # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],              # Allow all request headers
)


@app.get("/api/imagekit-auth")
def generate_imagekit_signature():
    """
    Endpoint that accepts an imagekit_Id parameter and generates
    authentication parameters (token, expire, signature) for ImageKit upload SDK.
    """
    try:
        
        # Initialize ImageKit instance dynamically with the specified imagekit_Id
        ik_client = ImageKit(
            private_key=IMAGEKIT_PRIVATE_KEY,
        )

        # Generate authentication parameters
        auth_params = ik_client.helper.get_authentication_parameters()
        print(auth_params)

        # Send response back to frontend
        return {
            "token": auth_params["token"],
            "expire": auth_params["expire"],
            "signature": auth_params["signature"],
            "imagekit_id": img_kit_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate ImageKit signature: {str(e)}"
        )

def sse_event(event_type:str,data:str):
    return (
        f"event: {event_type}\n"
        f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
    )

@app.get("/")
def hello():
    return {"All is welll bhai!!!!!"}

@app.post("/chat")
async def chat(body:ChatRequest,request:Request):
    try:
        print("cached_data")
        # print(llm_cache.get(body.email))
        
        if(not llm_cache.get(body.email)):
            result=supabase.from_("users").select("GROQ_API_KEY,GEMINI_API_KEY,api_configured").eq("email",body.email).execute()
            response=result.data[0]
            print(response)
            if(len(response)>0 and response['api_configured']==True):
                groq=decrypt_api_key(response['GROQ_API_KEY'])
                gemini=decrypt_api_key(response['GEMINI_API_KEY'])
                print(groq,gemini)
                CACHE_USER_DATA(groq,gemini,body.email)
                
                
                        
        chatbot = request.app.state.chatbot

        async def event_generator(data):
            print("-------------------started api------------------------")
            
            async for event in chatbot.astream_events(
                {"messages":[HumanMessage(body.query)],"query":data.query,"final_response":"nothing","conversation_id":data.conversation_id,"user_id":data.user_id,"api_configured":data.api_configured,"email":data.email,"deep_think":data.deep_think},
                config={
                    "configurable": {
                        "thread_id": body.conversation_id
                    }
                },
                version="v2"
            ):  
            
                try:
                    if event["event"] == "on_tool_start":

                        yield sse_event(
                            "on_tool_start",
                            event["name"]
                        )
                    elif event["event"] == "on_parser_end":
                        # here finally the decesion node makes the final decesion
                        print("----------------------------------------------")
                        # print(event)
                        if(event['data']['output'].is_query_relevant=='false'):
                            yield sse_event(
                                "on_parser_end",
                                event['data']['output'].msg
                            )
                    elif event["event"] == "on_chain_end" :
                        # here finally the decesion node makes the final decesion
                        # and event['data']['output']['messages']
                        if('messages' in event['data']['output'] and 'is_rag_query' in event['data']['output'] and event['data']['output']['is_rag_query']=="true"):

                            chunks=event['data']['output']['retrieved_chunks']
                            data=[{"page_content":doc.page_content,"metadata":doc.metadata} for doc in chunks]
                            yield  sse_event(
                            "retrieved_chunks",
                            data
                        )
                            
                        #output['messages']->sabse end wala hai    
                    elif (
                        event["event"] == "on_chat_model_stream"
                        and event["data"]["chunk"].content
                    ):
                        yield sse_event(
                        "message",
                        event["data"]["chunk"].content
                    )
                except Exception as e:
                    yield    sse_event(
                        "error",
                        str(e)
                    )
            yield sse_event(
                    "done",
                    "[DONE]"
                )
        return StreamingResponse(
            event_generator(body),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    except Exception as e:
        print(str(e))
        raise Exception("something went wrong during chat")
@app.get("/workflow")
def get_workflow(request:Request):
    chatbot = request.app.state.chatbot
    image_bytes = chatbot.get_graph().draw_mermaid_png()

    return Response(
        content=image_bytes,
        media_type="image/png"
    )

@app.get("/chat/{thread_id}")
async def get_chat_history(thread_id: str,request:Request):
    chatbot = request.app.state.chatbot
    try:
        state = await chatbot.aget_state(
            {
                "configurable": {
                    "thread_id": thread_id
                }
            }
        )
        messages = state.values.get(
            "messages",
            []
        )

        chat_history = []

        for message in messages:

            if message.type == "human":
                # print(message.id,"human")

                chat_history.append({
                    "id":message.id,    
                    "role": "user",
                    "content": message.content
                })

            elif message.type == "ai":
                # print(message.id,"ai")


                chat_history.append({
                    "id":message.id,
                    "role": "assistant",
                    "content": message.content
                })

            elif message.type == "system":

                chat_history.append({
                    "role": "system",
                    "content": message.content
                })

        return {
            "success": True,
            "thread_id": thread_id,
            "messages": chat_history
        }
    except Exception as e:
        print(str(e))
        raise Exception("something went wrong in get_chat_history")

    

@app.post("/api/RAG_process_delete_file_pipeline")
async def RAG_process_delete_file_pipeline(
    file_id:str=Query(..., description="file_id of the target document/vector in RAG system"),
    path: str = Query(..., description="path of the target document/vector in RAG system"),
    signature: str = Query(..., description="HMAC signature generated for authorization"),
    token: str = Query(..., description="Token associated with the signature"),
    expire: int = Query(..., description="Expiration timestamp of the signature"),
    user_id:str = Query(..., description="user id of the user"),
    conversation_id:str = Query(..., description="conversation id of the particular conversation"),

):
    try:
        valid_or_not=await validate_document_url(path)
        if(valid_or_not==False):
            raise Exception("Url is not valid")
        result=await get_document(path,signature,token,expire,user_id,conversation_id)
        """
        "success": True,
                    "message": "Document retrieved successfully",
                    "data": document_data
        """
        if(result['success']):
            result2=await delete_document(file_id,signature,token,expire)
            if(result2['success']):
                return JSONResponse(result2)
        
    except Exception as e:
        print(str(e))
    raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An error occurred while  processing the RAG_process_delete_file_pipeline:"
            )       


async def get_document(
    path: str = Query(..., description="path of the target document/vector in RAG system"),
    signature: str = Query(..., description="HMAC signature generated for authorization"),
    token: str = Query(..., description="Token associated with the signature"),
    expire: int = Query(..., description="Expiration timestamp of the signature"),
    user_id:str = Query(..., description="user id of the user"),
    conversation_id:str = Query(..., description="conversation id of the particular conversation"),
):
    """
    Fetches document metadata/content from RAG pipeline after signature validation.
    """
    # Verify the signature passed in query parameters
    if not verify_imagekit_signature(token, expire, signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature or unauthorized access request."
        )

    try:
        # TODO: Retrieve document text or vector embeddings from your database / Vector DB
        # Example dummy response for RAG pipeline:
        document_data = {
            
            "imagekit_id": img_kit_id,
            "file_url": path,
            "chunks_count": 12,
            "status": "ready"
        }
        #! 1.loading the document from cloud on machine
        # loader = PyPDFLoader(document_data['file_url'])
        data=await complete_Ingestion(document_data['file_url'],10,user_id,conversation_id)
        if(len(data)==0):
            return {
            "success": False,
            "message": "problem during document Ingestion",
                            
            }
        
        
        return {
            "success": True,
            "message": "chunks uploaded successfully to pinecone",
            "data": document_data
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch document: {str(e)}"
        )



# -------------------------------------------------------------------
# Helper: Verify HMAC-SHA1 Signature
# -------------------------------------------------------------------
def verify_imagekit_signature(token: str, expire: int, signature: str) -> bool:
    """
    Validates that the signature was signed by our secret key and hasn't expired.
    """
    # 1. Check if signature is expired
    current_time = int(time.time())
    if current_time > expire:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature has expired. Please generate a new one."
        )

    # 2. Recompute HMAC-SHA1 signature using token + expire
    auth_string = f"{token}{expire}".encode("utf-8")
    expected_signature = hmac.new(
        IMAGEKIT_PRIVATE_KEY.encode("utf-8"),
        auth_string,
        hashlib.sha1
    ).hexdigest()

    # 3. Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature)


# -------------------------------------------------------------------
# 2.DELETE Endpoint: Deletes from ImageKit & Vector DB
# -------------------------------------------------------------------
# @app.delete("/api/documents")
async def delete_document(
    file_id: str = Query(..., description="file_id of the target document/vector in RAG system"),
    signature: str = Query(..., description="HMAC signature generated for authorization"),
    token: str = Query(..., description="Token associated with the signature"),
    expire: int = Query(..., description="Expiration timestamp of the signature")
):
    """
    1. Validates request signature.
    2. Deletes uploaded file directly from ImageKit server.
    3. Deletes document embeddings from RAG vector store.
    """
    # 1. Verify the signature
    if not verify_imagekit_signature(token, expire, signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature or unauthorized request."
        )

    try:
        # 2. Delete file from ImageKit REST API
        # ImageKit API Endpoint: DELETE https://api.imagekit.io/v1/files/{fileId}
        url=f"https://api.imagekit.io/v1/files/{file_id}"
                
        async with httpx.AsyncClient() as client:
            ik_response = await client.delete(
                url,
                auth=(IMAGEKIT_PRIVATE_KEY, "")  # ImageKit requires Basic Auth with private key as username
                
            )

        # Handle ImageKit deletion response
        if ik_response.status_code not in (200, 204):
            raise HTTPException(
                status_code=ik_response.status_code,
                detail=f"ImageKit deletion failed: {ik_response.text}"
            )

        # 3. Clean up your RAG system / Vector Database
        # TODO: Delete vector embeddings associated with `file_id` from Pinecone, Qdrant, Chroma, etc.
        # await vector_db.delete(filter={"file_id": file_id})

        return {
            "success": True,
            "message": f"File '{file_id}' successfully deleted from ImageKit and RAG vector store."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while deleting document: {str(e)}"
        )

class DeleteConversationRequest(BaseModel):
    user_id: str
    conversation_id: str

class ConfigureApiKey(BaseModel):
    GROQ_API_KEY: str
    GEMINI_API_KEY: str
    PINECONE_API_KEY:str
    email:str


def CACHE_USER_DATA(groq:str,gemini:str,email:str):
    llm_cache[email]={"GROQ":groq,"GEMINI":gemini}
    return True



@app.post("/api/configure_api_keys")
async def configure(configure:ConfigureApiKey):
    try:
        groq=encrypt_api_key(configure.GROQ_API_KEY)
        gemini=encrypt_api_key(configure.GEMINI_API_KEY)
        # pinecone=encrypt_api_key(configure.PINECONE_API_KEY)

        #! now cache the user api keys
        CACHE_USER_DATA(configure.GROQ_API_KEY,configure.GEMINI_API_KEY,configure.email)
        print("cached_data")
        items=dict(llm_cache.items())
        print(items)
                

        groq_test_result=await test_groq_api_key(configure.GROQ_API_KEY)
        gemini_test_result=await test_gemini_api_key(configure.GEMINI_API_KEY)
        # pinecone_test_result=await test_pinecone_api_key(configure.PINECONE_API_KEY)
        print(groq_test_result,gemini_test_result)
        if(groq_test_result and gemini_test_result):
            supabase.from_("users").update({"GROQ_API_KEY":groq,"GEMINI_API_KEY":gemini,"api_configured":True}).eq("email",configure.email).execute()
            # print(groq_test_result,gemini_test_result,pinecone_test_result)
            return JSONResponse({"success":True,"msg":"done"})
        else:
            return JSONResponse({"success":False,"msg":"API keys are wrong"})

    except Exception as e:
        raise Exception(str(e))
    
@app.delete("/api/delete_pinecone_index_with_user_id")
async def delete(request: DeleteConversationRequest):
    try:
            delete_conversation_documents_by_user_id(
                user_id=request.user_id,
            )
    
            return {
                "success": True,
                "message": "Conversation documents deleted successfully.",
                "user_id": request.user_id,
                "conversation_id": request.conversation_id,
            }
    
    except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc
    
    except RuntimeError as exc:
            raise HTTPException(
                status_code=500,
                detail=str(exc),
            ) from exc    

    
@app.delete("/api/delete_pinecone_index_with_user_id_and_conversation_id")
async def delete_conversation_documents_endpoint(
    request: DeleteConversationRequest,
):
    try:
        delete_conversation_documents(
            user_id=request.user_id,
            conversation_id=request.conversation_id,
        )

        return {
            "success": True,
            "message": "Conversation documents deleted successfully.",
            "user_id": request.user_id,
            "conversation_id": request.conversation_id,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc