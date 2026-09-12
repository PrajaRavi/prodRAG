import { FileText, Trash2 } from "lucide-react";

import type { Conversation } from "../../types";
import "../../index.css"
import { CircularLoader } from "../ui/CircularLoader";
import { useUser } from "../../context/Global";
interface Props {
  conversations: Conversation[];
  onDelete: (id: string) => void;
  VectorDeleteSignal:boolean

}

export default function ConversationList({
  conversations,
  onDelete,
  VectorDeleteSignal

}: Props) {
  const {ActiveConversation,setActiveConversation}=useUser()
  return (
    <section className="flex-1 overflow-y-auto p-3 hide-scrollbar">
      <div className="mb-3 px-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Conversations
        </h2>
      </div>

      <div className="space-y-1">
        {conversations.map((conversation) => (
          <div
            onClick={()=>{
              setActiveConversation(conversation)
            }}
            key={conversation.id}
            className={ActiveConversation.id==conversation.id?"group flex border-blue-300 border items-center gap-3 rounded-xl p-3 transition hover:bg-white/5":"group flex  items-center cursor-pointer gap-3 rounded-xl p-3 transition hover:bg-white/5"}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              {VectorDeleteSignal && ActiveConversation.id==conversation.id?
              <CircularLoader  className="w-3 h-3"/>:<FileText size={16} className="text-blue-400" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">
                {conversation.doc_name}
              </p>

              <p className="mt-0.5 truncate text-[11px] text-slate-600">
                {conversation.id}
              </p>
            </div>

            <button
              onClick={() =>
                onDelete(conversation.id)
              }
              className="rounded-lg p-2 text-slate-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-slate-600">
            No conversations yet.
          </div>
        )}
      </div>
    </section>
  );
}