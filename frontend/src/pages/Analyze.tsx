import { use, useEffect, useState } from "react";
// import { nanoid } from 'nanoid'
import { v4 as uuidv4 } from "uuid"
import Sidebar from "../components/analyze/sidebar";
import ChatWindow from "../components/analyze/ChatWindow";

// import {
//   dummyChatHistory,
//   dummyConversations,
// } from "../data/dummyData";

import type {
  ApiKeys,
  ChatHistory,
  Conversation,
  ImageKitAuthResponse,
  ImageKitUploadResponse,
} from "../types";

import { FASTAPI_BASE_URL, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_UPLOAD_ENDPOINT, LOCAL_CONVERSATION_HISTORY, localUsre } from "../utils/const";
import { useUser } from "../context/Global";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import axios, { AxiosError } from "axios"
import { supabase } from "../utils/supabase";

export default function Analyze() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {ConversationHistory,setConversationHistory,setActiveConversation}=useUser()
  let [VectorDeleteSignal,setVectorDeleteSignal]=useState<boolean>(false)

  const { user, setIsLogin, IsLogin,setAnalyzerPageVisible,ActiveConversation } = useUser();
  const navigate = useNavigate();

  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    pinecone: "",
    groq: "",
    gemini: "",
  });

  // const [conversations, setConversations] =
  //   useState<Conversation[]>(ConversationHistory);

  const [messages, setMessages] =
    useState<ChatHistory[]>([]);

  // --------------------------------------------------
  // Upload state
  // --------------------------------------------------

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  let [IsStreaming,setIsStreaming]=useState<boolean>(false)

  // --------------------------------------------------
  // API key
  // --------------------------------------------------

  const handleApiKeyChange = (
    key: keyof ApiKeys,
    value: string
  ) => {
    setApiKeys((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const Add_conversation_history_in_supabase=async (id:string,doc_name:string,user_id:number)=>{
    try {
      let {data,error}=await supabase.from("conversation_history").insert({id,doc_name,user_id})
      // let {data}=await axios.post(`http://localhost:4500/user/signup`,form)
      console.log(data)
      if(error){
        if(error.code=="23505"){
          toast.error("This document already exist in your daabase")
          return false

        }
        else{
          
          toast.error(error?.message)
        }
  
      }
      else{
        // toast.success("signup successfullly!!!")
        return true
        
    }
    } catch (error) {
     console.log(error) 
    }
  }

  const DeleteConversationFromSupabaseWithID=async (id:string,user_id:number)=>{
try {
    const { data, error } = await supabase
      .from("conversation_history")
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)
      .select();

    // Supabase returns API/Database errors inside the 'error' object instead of throwing
    if (error) {
      throw new Error(`Supabase Error: ${error.message} (Code: ${error.code})`);
    }

    // Optional safety check if no row matched the provided ID
    if (!data || data.length === 0) {
      console.warn(`No record found with ID: ${id}`);
    }

    return { success: true, deletedData: data };
  } catch (err: any) {
    // Catches both thrown Supabase API errors and network failure exceptions
    console.error("Failed to delete conversation document:", err.message || err);

    return {
      success: false,
      error: err.message || "An unexpected error occurred during deletion.",
    };
  }
  }

  const delete_vectors_in_pinecone= async (user_id:string,conversation_id:string)=>{
    try {
      setVectorDeleteSignal(true)
      let {data}=await axios.delete(`${FASTAPI_BASE_URL}/api/delete_pinecone_index_with_user_id_and_conversation_id`,{data:{user_id,conversation_id}})
      if(data?.success){
        return true
      }

    } catch (error) {
      console.log(error)
      throw  new Error("something went wrong in delete_vectors_in_pinecone")
    }finally{
      setVectorDeleteSignal(false)
    }
    // /api/delete_pinecone_index_with_user_id_and_conversation_id
  }
  // --------------------------------------------------
  // Delete conversation
  // --------------------------------------------------

  const handleDeleteConversation = async (id: string) => {
    console.log("Delete conversation:", id);
    let result=await DeleteConversationFromSupabaseWithID(id,Number(user.id))
    if(result.success==false){
      throw new Error(`Supabase Error: in handleDeleteConversation`);
    }

    let response=await delete_vectors_in_pinecone(String(user.id),id)
    console.log(response)
    setConversationHistory((previous) =>
      previous.filter(
        (conversation) =>
          conversation.id !== id
      )
    );

    
  };

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------

  const handleSendMessage =async  (content: string) => {
    const userMessage: ChatHistory = {
      id: String(Date.now()),
      content,
      role: "user",
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    let id=String(Date.now()+1);
    localStorage.setItem("curr_msg_id",id)
    const assistantMessage: ChatHistory = {
      id:id,
      role: "assistant",
      content:"",
    };
    setMessages((previous) => [
      ...previous,
      assistantMessage,
    ]);
    

    try{
      setIsStreaming(true)

const response = await fetch(
  `${FASTAPI_BASE_URL}/chat`,
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query: content,
      user_id: String(user.id),
      conversation_id:String(ActiveConversation.id)
      
    }),
  }
);

console.log(response)
if (!response.ok) {
  throw new Error(
    `HTTP error: ${response.status}`
  );
}

if (!response.body) {
  throw new Error("Streaming not supported");
}

const reader =
  response.body.getReader();

const decoder =
  new TextDecoder("utf-8");

let buffer = "";

while (true) {

  const {
    value,
    done,
  } = await reader.read();

  if (done) {
    break;
  }

  buffer += decoder.decode(
    value,
    {
      stream: true,
    }
  );

  const events =
    buffer.split(/\r?\n\r?\n/);

  // Keep incomplete event
  buffer =
    events.pop() || "";

  for (const rawEvent of events) {

    if (!rawEvent.trim()) {
      continue;
    }

    console.log(
      "RAW SSE EVENT:",
      rawEvent
    );

    const lines =
      rawEvent.split(/\r?\n/);

    let eventType =
      "message";

    let data = "";

    for (const line of lines) {
      console.log(line)
      console.log("line")

      if (line.startsWith("event:")) {

        eventType =
          line.slice(6).trim();
      }

      else if (line.startsWith("data:")) {

        // Don't trim the actual JSON
        data +=
          line.slice(5).trimStart();
      }
    }

    if (!data) {
      continue;
    }

    let parsedData;

    try {

      parsedData =
        JSON.parse(data);

    } catch (error) {

      console.error(
        "JSON parsing failed:",
        data
      );

      continue;
    }

    console.log(
      "EVENT:",
      eventType
    );

    console.log(
      "DATA:",
      parsedData
    );


    // -----------------------
    // TOOL START
    // -----------------------

    if (
      eventType ===
      "on_parser_end"
    ) {
      const token =
        parsedData;

      setMessages(prev => {

        const updated =
          [...prev];

        const last =
          updated.length - 1;

        if (last < 0) {
          return prev;
        }

        updated[last] = {

          ...updated[last],

          content:
            updated[last]
              .content + token,
        };

        return updated;
      })

      // dispatch(
      //   SetThinkingText(
      //     `Using ${parsedData}...`
      //   )
      // );

      continue;
    }


    // -----------------------
    // TOOL END
    // -----------------------

    if (
      eventType ===
      "on_tool_end"
    ) {

      // dispatch(
      //   SetThinkingText(
      //     "Orchestrating..."
      //   )
      // );

      continue;
    }

    
    // -----------------------
    // AI TOKEN
    // -----------------------

    if (
      eventType === "message"
    ) {

      const token =
        parsedData;

      setMessages(prev => {

        const updated =
          [...prev];

        const last =
          updated.length - 1;

        if (last < 0) {
          return prev;
        }

        updated[last] = {

          ...updated[last],

          content:
            updated[last]
              .content + token,
        };

        return updated;
      });

      continue;
    }


    // -----------------------
    // DONE
    // -----------------------

    if (
      eventType === "done"
    ) {

      console.log(
        "Generation completed"
      );
      setIsStreaming(false)
      // dispatch(
      //   SetIsStreaming(false)
      // );

      continue;
    }


    // -----------------------
    // ERROR
    // -----------------------

    if (
      eventType === "error"
    ) {
      toast.error("internal server error")
      console.error(
        "Streaming error:",
        parsedData
      );

      // dispatch(
        setIsStreaming(false)
      // );

      continue;
    }
  }
}
}
catch(error){
  console.log(error)
  toast.warn("Internet error")
  setIsStreaming(false)


}

  };

const UpdateUserCount=async (email:string,newCount:number)=>{
  try {
    let { data, error }:{data:any,error:any} = await supabase
  .from("users")
  .update({ count: newCount }) // Replace 'count' and 'newCount' with your column name and value
  .eq('email', email)
  .select(); // Optional: returns the updated user record
  if(error){
    toast.error("something went wrong during count increment")
    return false
  }
  return true
  } catch (error) {
    console.log(error)
    return false
  }
}

  // --------------------------------------------------
  // Document upload
  // --------------------------------------------------

    const handleDocumentUpload = async (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "text/plain",
    ];

    const allowedExtensions = [".pdf", ".txt"];

    const fileExtension =
      "." + file.name.split(".").pop()?.toLowerCase();

    // Validate extension
    if (!allowedExtensions.includes(fileExtension)) {
      alert("Only .pdf and .txt files are supported.");
      return;
    }

    // Validate MIME type if available
    if (
      file.type &&
      !allowedTypes.includes(file.type)
    ) {
      toast.warn("Only PDF and TXT files are supported.");
      return;
    }

    console.log("Selected file:", file);

    // -----------------------------------------------
    // Start upload
    // -----------------------------------------------

    setUploading(true);
    setUploadProgress(0);

    const sizeInMB = file.size / (1024 * 1024);
    
    if(sizeInMB>10)
      return toast.error("file size should be less than 1o mb")
    try {
      // Step A: Fetch authentication parameters from FastAPI backend
      const authResponse = await axios.get<ImageKitAuthResponse>(
        `${FASTAPI_BASE_URL}/api/imagekit-auth`
      );
      const { token, expire, signature } = authResponse.data;

      // Step B: Build FormData for ImageKit V1 API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      formData.append('signature', signature);
      formData.append('token', token);
      formData.append('expire', expire.toString());
      formData.append('useUniqueFileName', 'true'); // Optional: appends unique suffix
      formData.append('folder', '/rag_documents');  // Optional: folder inside ImageKit

      // Step C: Send POST request to ImageKit with upload progress tracking
      // console.log(IMAGEKIT_UPLOAD_ENDPOINT)
      // console.log(IMAGEKIT_PUBLIC_KEY)
      // return
      const uploadResponse = await axios.post<ImageKitUploadResponse>(
        IMAGEKIT_UPLOAD_ENDPOINT,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },
        }
      );
      setUploadProgress(0)
      // Step D: Successfully set uploaded file details
      // let uploadedData=uploadResponse.data
      let docid=uuidv4();

      let processing_RAG_pipeline=await axios.post(`${FASTAPI_BASE_URL}/api/RAG_process_delete_file_pipeline?file_id=${String(uploadResponse.data.fileId)}&path=${String(uploadResponse.data.url)}&signature=${String(signature)}&token=${token}&expire=${expire}&user_id=${String(user.id)}&conversation_id=${docid}`,{},{onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },})

    if(processing_RAG_pipeline?.data.success){
      toast.success("Document analysed successfully now you can chat from your document")
      setUploading(false)

      // ! 2.stored document name with an id in localstorage
      // setIsDocUpload(false)

      let conversation_obj:Conversation={id:docid,doc_name:uploadResponse.data.name}
      let conversation_history_supabase_result=await Add_conversation_history_in_supabase(docid,uploadResponse.data.name,user?.id)
      if(conversation_history_supabase_result==false)
        return toast.error("something went wrong")

        setConversationHistory([...ConversationHistory,conversation_obj])
        setActiveConversation(conversation_obj)
        
      
      // ! 1.updadte the count variable for the logedin user
      let result=await UpdateUserCount(user.email,Number(user?.count)+1)
      if(result==false) 
        return 


    }
    else{
      toast.error("error during document upload")
      console.log(processing_RAG_pipeline?.data)
    }

      
    } catch (err: unknown) {
      setUploadProgress(0)
      setUploading(false)
      console.error('Upload Error:', err);
      if (axios.isAxiosError(err)) {
        const serverError = err as AxiosError<{ message?: string }>;
        toast.error(
          serverError.response?.data?.message ||
            serverError.message ||
            'An error occurred during file upload.'
        );
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      // setIsUploading(false);
    }
    
    /*
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 5;

      if (progress >= 100) {
        progress = 100;

        setUploadProgress(progress);

        clearInterval(interval);

        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);

        return;
      }

      setUploadProgress(progress);
    }, 250);

    */
  };


    
  

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem(localUsre);
    // localStorage.removeItem(LOCAL_CONVERSATION_HISTORY)

    setIsLogin(false);

    navigate("/login");

    console.log("Logout API placeholder");
  };

  // --------------------------------------------------
  // Authentication protection
  // --------------------------------------------------

  useEffect(() => {
setAnalyzerPageVisible(true)
    if (IsLogin === false) {
      navigate("/");
    }
  }, [IsLogin, navigate]);

  return (
    <div className="relative h-screen overflow-hidden bg-slate-950 scrollbar-hide">

      {/* ================================================
          Main application
      ================================================= */}

      <div className="flex h-full">

        {/* Desktop sidebar */}
        <div className="hidden w-[300px] shrink-0 lg:block">
          <Sidebar
          VectorDeleteSignal={VectorDeleteSignal}
            user={user}
            apiKeys={apiKeys}
            conversations={ConversationHistory}
            onApiKeyChange={handleApiKeyChange}
            onDeleteConversation={
              handleDeleteConversation
            }
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">

            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() =>
                setSidebarOpen(false)
              }
            />

            <div className="relative h-full w-[85%] max-w-[320px]">
              <Sidebar
              VectorDeleteSignal={VectorDeleteSignal}
                user={user}
                apiKeys={apiKeys}
                conversations={ConversationHistory}
                onApiKeyChange={handleApiKeyChange}
                onDeleteConversation={
                  handleDeleteConversation
                }
                onLogout={handleLogout}
                onClose={() =>
                  setSidebarOpen(false)
                }
              />
            </div>
          </div>
        )}

        {/* Chat */}
        {<ChatWindow
        IsStreaming={IsStreaming}

          messages={messages}
          onSend={handleSendMessage}
          onOpenSidebar={() =>
            setSidebarOpen(true)
          }
          onDocumentUpload={
            handleDocumentUpload
          }
        />}
      </div>

      {/* ================================================
          Upload progress overlay
      ================================================= */}

      {uploading && (
        <div className="absolute  inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">

          <div className="flex flex-col items-center">

            {/* Circular progress */}
            <div className="relative h-32 w-32">

              {/* Background circle */}
              <svg
                className="h-full w-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-white/10"
                />

                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  className="text-blue-500 transition-all duration-200"
                  strokeDasharray={
                    2 * Math.PI * 42
                  }
                  strokeDashoffset={
                    2 *
                    Math.PI *
                    42 *
                    (1 -
                      uploadProgress / 100)
                  }
                />
              </svg>

              {/* Percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-semibold text-white">
                  {uploadProgress}%
                </span>
              </div>
            </div>

            <p className="mt-5 text-sm font-medium text-white">
              Uploading document...
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Please don't close this window
            </p>
          </div>
        </div>
      )}
    </div>
  );
}