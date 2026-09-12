import { Bot, User } from "lucide-react";

import type { ChatHistory } from "../../types";
import MarkdownRenderer from "../MarkdownRenderer";
import TypingIndicator from "../ThinkingIndicator";

interface Props {
  message: ChatHistory;
  IsStreaming:boolean
}

export default function ChatMessage({ message ,IsStreaming}: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Bot size={16} className="text-blue-400" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-blue-600 text-white"
            : "rounded-bl-md border border-white/10 bg-white/[0.04] text-slate-300"
        }`}
      >
        {/* <p>hello bhai</p>
        <p className="text-white">{String(localStorage.getItem("curr_msg_id"))==String(message.id)}</p> */}
        {(IsStreaming && localStorage.getItem("curr_msg_id")==message.id ) && <TypingIndicator text={"thinking..."}/>}
        <MarkdownRenderer content={message.content} />
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
          <User size={16} className="text-slate-400" />
        </div>
      )}
    </div>
  );
}