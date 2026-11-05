import {  useEffect, useState } from "react";
// import { nanoid } from 'nanoid'
// 1d059f65-18d6-45bb-b608-38e08a0da047
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

import { DeepThinkingMode, FASTAPI_BASE_URL, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_UPLOAD_ENDPOINT, localUsre } from "../utils/const";
import { useUser } from "../context/Global";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import axios, { AxiosError } from "axios"
import { supabase } from "../utils/supabase";
import ProcessingLoader from "../components/ui/processing_Loader";

interface Props {
  ConversationHistorySignal:boolean;
  handleShowMoreConversationHistory:()=>Promise<void>
}

export default function Analyze({ConversationHistorySignal,handleShowMoreConversationHistory}:Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {ConversationHistory,setConversationHistory,setActiveConversation}=useUser()
  let [VectorDeleteSignal,setVectorDeleteSignal]=useState<boolean>(false)
  let [ConfigAPiKeySignal,setConfigAPiKeySignal]=useState<boolean>(false)

  const { user, setIsLogin, IsLogin,setAnalyzerPageVisible,ActiveConversation } = useUser();
  const navigate = useNavigate();

  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    pinecone: "",
    groq: "",
    gemini: "",
  });

  async function ConfigureAPIkey(){
    try {
      setConfigAPiKeySignal(true)
      if(apiKeys.groq=="" || apiKeys.gemini==""){
         toast.warn("all keys are required")
         return
      }
      let obj={GROQ_API_KEY:apiKeys.groq,GEMINI_API_KEY:apiKeys.gemini,PINECONE_API_KEY:"nothing",email:user.email}
      let {data}=await axios.post(`${FASTAPI_BASE_URL}/api/configure_api_keys`,obj)
      await delete_vectors_in_pinecone_with_userid(String(user.id),"helllo");
      await DeleteConversationFromSupabaseWithUserId("hello",user.id)

      // send these api key in backend as it is. https[will take care of security]
      if(data.success){
        
        toast.success("configured successfully!!!!")

        
        window.location.reload()
        
      }
      else{
        toast.error("API keys are wrong")
      }


      
    } catch (error) {
      console.log(error)
    }finally{
      setConfigAPiKeySignal(false)

    }
  }
  // const [conversations, setConversations] =
  //   useState<Conversation[]>(ConversationHistory);

  const [messages, setMessages] =
    useState<ChatHistory[]>([]);

  // --------------------------------------------------
  // Upload state
  // --------------------------------------------------

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
  const DeleteConversationFromSupabaseWithUserId=async (id:string,user_id:number)=>{
try {
    const { data, error } = await supabase
      .from("conversation_history")
      .delete()
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
  const delete_vectors_in_pinecone_with_userid= async (user_id:string,conversation_id:string)=>{
    try {
      setVectorDeleteSignal(true)
      let {data}=await axios.delete(`${FASTAPI_BASE_URL}/api/delete_pinecone_index_with_user_id`,{data:{user_id,conversation_id}})
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
    // return setVectorDeleteSignal(true)
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
      source:[]
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
      conversation_id:String(ActiveConversation.id),
      api_configured:user.api_configured?"true":"false",
      email:user?.email,
      deep_think:localStorage.getItem(DeepThinkingMode)?"true":"false"
      
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

    // console.log(
    //   "RAW SSE EVENT:",
    //   rawEvent
    // );

    const lines =
      rawEvent.split(/\r?\n/);

    let eventType =
      "message";

    let data = "";

    for (const line of lines) {
      // console.log(line)
      // console.log("line")

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
      "on_chain_end"
    ) {

      console.log("retrieved chunks")
      console.log(parsedData)
      console.log("retrieved chunks ended")
      continue;
    }
    if (
      eventType ===
      "retrieved_chunks"
    ) {
      // console.log("retrieved_chunks")
      // console.log(parsedData)
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

          source:
            updated[last]
              .source=parsedData
        };

        return updated;
      });

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
        <div className="hidden w-75 shrink-0 lg:block">
          <Sidebar
          ConfigAPiKeySignal={ConfigAPiKeySignal}
          ConfigureAPIkey={ConfigureAPIkey}

          handleShowMoreConversationHistory={handleShowMoreConversationHistory}
          ConversationHistorySignal={ConversationHistorySignal}
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
              ConfigAPiKeySignal={ConfigAPiKeySignal}
              ConfigureAPIkey={ConfigureAPIkey}
              handleShowMoreConversationHistory={handleShowMoreConversationHistory}
              ConversationHistorySignal={ConversationHistorySignal}
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
          
        />}
      </div>

      
      
    </div>
  );
}