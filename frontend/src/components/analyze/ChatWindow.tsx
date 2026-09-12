import { useState,useEffect,useRef } from "react";
import {
  Menu,
  Mic,
  Send,
  Sparkles,
  Plus,
} from "lucide-react";

import type { ChatHistory } from "../../types";

import ChatMessage from "./ChatMessage";
import DocumentOnboarding from "../../pages/DocumentOnBording";
import { Link } from "react-router";
import "../../App.css"
import { useUser } from "../../context/Global";
import { toast } from "react-toastify";
import ApiKeyOnboarding from "../../pages/ApiKeyOnBoarding";

interface Props {
  messages: ChatHistory[];
  onSend: (message: string) => void;
  onOpenSidebar: () => void;
  onDocumentUpload: (file: File) => void;
  IsStreaming:boolean
}
export default function ChatWindow({
  messages,
  onSend,
  onOpenSidebar,
  onDocumentUpload,
  IsStreaming
}: Props) {  
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const {ActiveConversation,user}=useUser()
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
  const container = messagesContainerRef.current;

  if (!container) return;

  container.scrollTo({
    top: container.scrollHeight,
    behavior: "smooth",
  });
}, [messages]);
  const MainSection=()=>{
    if(messages.length==0 && Number(user.count)<2 ){
      return (
        <DocumentOnboarding/>
      )
    }
    else if(Number(user.count)>1){
      return (
        <ApiKeyOnboarding/>
      )
    }
    else{
return (
  <div
  ref={messagesContainerRef} 
  className="flex-1 overflow-y-auto hide-scrollbar ">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
          {messages.map((message) => (
            <ChatMessage
            IsStreaming={IsStreaming}
              key={message.id}
              message={message}
            />
          ))}
        </div>
      </div>
)
    }
  }

  return (
    <>
    <main className="flex min-w-0   flex-1 flex-col bg-slate-900/40">
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
            Document Assistant
          </h1>

          <p className="text-xs text-slate-600">
            RAG powered conversation
          </p>
        </Link>
      </header>

      {/* Messages */}
      <MainSection/>
      

      {/* Composer */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/60 p-3 backdrop-blur-xl sm:p-5">
       {Number(user.count)<2 && <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
        <input
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
/>
<label
  htmlFor="document-upload"
  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white"
  title="Upload document"
>
  <Plus size={20} />
</label>
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