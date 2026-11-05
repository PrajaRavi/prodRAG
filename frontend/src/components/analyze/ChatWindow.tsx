import { useState,useRef} from "react";
import {
  Menu,
  Mic,
  Send,
  Sparkles,
  Plus,
} from "lucide-react";

import type { ChatHistory,
    Conversation,
  ImageKitAuthResponse,
  ImageKitUploadResponse,

 } from "../../types";

// import ChatMessage from "./ChatMessage";
// import DocumentOnboarding from "../../pages/DocumentOnBording";
import { Link} from "react-router";
import { DeepThinkingMode, FASTAPI_BASE_URL, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_UPLOAD_ENDPOINT, localUsre } from "../../utils/const";

import "../../App.css"
import { useUser } from "../../context/Global";
import { toast } from "react-toastify";
// import ApiKeyOnboarding from "../../pages/ApiKeyOnBoarding";
import ChatList from "../ui/ChatList";
import DocumentUploadModal from "../ui/Model";
import { v4 as uuidv4 } from "uuid"
import { supabase } from "../../utils/supabase";
import axios, { AxiosError } from "axios";

interface Props {
  messages: ChatHistory[];
  onSend: (message: string) => void;
  onOpenSidebar: () => void;
  // onDocumentUpload: (file: FileList) => void;
  IsStreaming:boolean;
  
}
export default function ChatWindow({
  messages,
  onSend,
  onOpenSidebar,
  // onDocumentUpload,
  IsStreaming,
}: Props) {  
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement|null>(null);
  let [DocumentModelOpen,setDocumentModelOpen]=useState<boolean>(false)
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  
  
const {ActiveConversation,user,setActiveConversation,setConversationHistory,ConversationHistory}=useUser()
  const handleSend = () => {
    if(ActiveConversation.id==""){
      return toast.warn("upload document or select any conversation")
    }
    const value = input.trim();

    if (!value) return;

    onSend(value);
    setInput("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    console.log(e.key)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
  console.log(data)
  return true
  } catch (error) {
    console.log(error)
    return false
  }
}

  // --------------------------------------------------
  // Document upload
  // --------------------------------------------------
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

    const handleDocumentUpload = async (files: FileList) => {
    const allowedTypes = [
      "application/pdf",
      "text/plain",
    ];
    console.log(files)
//     Array.from(files as FileList).forEach((item,index)=>{
// console.log(item)
// if(index>8){
//   alert("document should be less than 5")
// }})
let file=files[0]
    
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
    
    if(sizeInMB>10){

      setUploading(false)
      return toast.error("file size should be less than 10 mb")
    }
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
    
    

  
//   const MainSection=()=>{
//     if(messages.length==0 && Number(user.count)<2 ){
//       return (
//         <DocumentOnboarding/>
//       )
//     }
//     else if(Number(user.count)>1){
//       return (
//         <ApiKeyOnboarding/>
//       )
//     }
//     else{
// return (
//   <div
//   ref={messagesContainerRef} 
//   className="flex-1 overflow-y-auto hide-scrollbar ">
//         <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
//           {messages.map((message) => (
//             <ChatMessage
            
//             IsStreaming={IsStreaming}
//               key={message.id}
//               message={message}
//             />
//           ))}
//           {/* IntersectionObserver sentinel */}
//       <div
//         ref={bottomRef}
//         className="h-3 bg-red-600   relative top-24"
//       />
//         </div>
//       </div>
// )
//     }
//   }

  return (
    <>
    <main className="flex min-w-0 h-screen  flex-1 flex-col bg-slate-900/40">
    <DocumentUploadModal isOpen={DocumentModelOpen} onClose={()=>setDocumentModelOpen(false)} onDeepThinkingOff={()=>{
      localStorage.removeItem(DeepThinkingMode)
    }} onDeepThinkingOn={()=>{
      localStorage.setItem(DeepThinkingMode,"true")

    }} onFileSelect={(file:FileList)=>{
      console.log(file)
      if (!file) return;
      setDocumentModelOpen(false)
      handleDocumentUpload(file);

    }}/>



      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-6">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
          <Sparkles size={17} className="text-blue-400" />
        </div>

        <Link to={"/"}>
          <h1 className="text-sm font-semibold text-white">
            {ActiveConversation.doc_name}
          </h1>

          <p className="text-xs text-slate-600">
            RAG powered conversation
          </p>
        </Link>
        <div className="absolute right-0">

        {/* <DeepThinkToggle enabled={true} onChange={()=>{}} /> */}
        </div>
      </header>

      {/* Messages */}
      
      <ChatList IsStreaming={IsStreaming} messages={messages} messagesContainerRef={messagesContainerRef} />
      

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/60 p-3 backdrop-blur-xl sm:p-5">
       {(Number(user.count)<2 || String(user.api_configured)=="true") && <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-white/10 bg-white/4 p-2">
        {/* <input
  id="document-upload"
  type="file"
  accept=".pdf,.txt,application/pdf,text/plain"
  className="hidden"
  onChange={(e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    onDocumentUpload(file);

    // Allows selecting the same file again later
    e.target.value = "";
  }}
/> */}

<button
onClick={()=>setDocumentModelOpen(true)}
  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white"
  title="Upload document"
>
  <Plus size={20} />
</button>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)}}
            onKeyDown={handleKeyDown}
            placeholder="Ask something about your documents..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
          />

          <button
            className="hidden rounded-xl p-2.5 text-slate-500 transition hover:bg-white/5 hover:text-white sm:block"
            title="Voice input"
          >
            <Mic size={19} />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="rounded-xl bg-blue-600 p-2.5 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>}

        <p className="mx-auto mt-2 max-w-4xl text-center text-[10px] text-slate-700">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </main>
    </>

  );
}