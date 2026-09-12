import { LogOut, UserCircle, X } from "lucide-react";

import type {
  ApiKeys,
  Conversation,
  User,
} from "../../types";

import ApiKeysComponent from "./Apikey"
import ConversationList from "./conversationList"

interface Props {
  user: User;
  apiKeys: ApiKeys;
  conversations: Conversation[];
  onApiKeyChange: (
    key: keyof ApiKeys,
    value: string
  ) => void;
  onDeleteConversation: (id: string) => void;
  onLogout: () => void;
  onClose?: () => void;
  VectorDeleteSignal:boolean
}

export default function Sidebar({
  user,
  apiKeys,
  conversations,
  onApiKeyChange,
  onDeleteConversation,
  onLogout,
  onClose,
  VectorDeleteSignal
}: Props) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-white/10 bg-slate-950">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <div>
          <p className="text-sm font-semibold text-white">
            RAG Workspace
          </p>

          <p className="text-xs text-slate-600">
            Document assistant
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={19} />
          </button>
        )}
      </div>

      {Number(user?.count)>1 && <ApiKeysComponent
        pinecone={apiKeys.pinecone}
        groq={apiKeys.groq}
        gemini={apiKeys.gemini}
        onChange={onApiKeyChange}
      />}

      <ConversationList
      VectorDeleteSignal={VectorDeleteSignal}
        conversations={conversations}
        onDelete={onDeleteConversation}
      />

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl p-3">
          <UserCircle
            size={34}
            className="shrink-0 text-slate-500"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">
              {user.name}
            </p>

            <p className="truncate text-xs text-slate-600">
              {user.email}
            </p>
          </div>

          <button
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            title="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}