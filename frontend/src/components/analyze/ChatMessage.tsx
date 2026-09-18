
import { useState } from "react";
import {
  Bot,
  User,
  ChevronDown,
  // ExternalLink,
  RefreshCw,
  Sparkles,
  Minimize2,
  Lightbulb,
  Copy,
  Check,
} from "lucide-react";

import type { ChatHistory, Doc } from "../../types";
import MarkdownRenderer from "../MarkdownRenderer";
import TypingIndicator from "../ThinkingIndicator";


interface Props {
  message: ChatHistory;
  IsStreaming: boolean;
  sources:Doc[]|undefined;

  onRegenerate?: (message: ChatHistory) => void;
  onImprove?: (message: ChatHistory) => void;
  onMakeShorter?: (message: ChatHistory) => void;
  onExplainSimply?: (message: ChatHistory) => void;
}

export default function ChatMessage({
  message,
  sources,
  IsStreaming,
  onRegenerate,
  onImprove,
  onMakeShorter,
  onExplainSimply,
}: Props) {
  const isUser = message.role === "user";

  const [showCitations, setShowCitations] = useState(false);
  const [copied, setCopied] = useState(false);

  
  const isCurrentStreamingMessage =
    IsStreaming &&
    String(localStorage.getItem("curr_msg_id")) === String(message.id);

  // -----------------------------------------
  // COPY MESSAGE
  // -----------------------------------------
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Bot size={16} className="text-blue-400" />
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-blue-600 text-white"
            : "rounded-bl-md border border-white/10 bg-white/4 text-slate-300"
        }`}
      >
        {/* Thinking indicator */}
        {isCurrentStreamingMessage && (
          <TypingIndicator text="thinking..." />
        )}

        {/* Message content */}
        <MarkdownRenderer content={message.content} />

        {/* =========================================
            CITATIONS
           ========================================= */}
        {!isUser && sources && (
          <div className="mt-4 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() => setShowCitations((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                {/* <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                  <ExternalLink
                    size={13}
                    className="text-blue-400"
                  />
                </div> */}

                <span className="text-xs font-medium text-slate-300">
                  Sources
                </span>

                <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {sources.length}
                </span>
              </div>

              <ChevronDown
                size={15}
                className={`text-slate-500 transition-transform duration-200 ${
                  showCitations ? "rotate-180" : ""
                }`}
              />
            </button>

            {showCitations && (
              <div className="mt-2 space-y-2">
                {sources.map((citation, index) => (
                  <div
                    key={`${citation.metadata.title}-${index}`}
                    className="rounded-xl border border-white/8 bg-black/10 p-3 transition hover:border-white/15 hover:bg-white/3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-semibold text-blue-400">
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-300">
                          {citation.page_content}
                        </p>

                        {(citation.metadata.page_label) && (
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                            {citation.metadata.page_label && (
                              <span>Page {citation.metadata.page_label}</span>
                            )}

                            {/* {citation.section && (
                              <span>{citation.section}</span>
                            )} */}
                          </div>
                        )}

                        {/* {citation.url && (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-400 transition hover:text-blue-300"
                          >
                            Open source
                            <ExternalLink size={10} />
                          </a>
                        )} */}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================
            MESSAGE ACTIONS
           ========================================= */}
        {!IsStreaming && (
          <div
            className={`mt-3 flex flex-wrap items-center gap-1 border-t border-white/8 pt-2 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {/* COPY - BOTH USER AND AI */}
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied" : "Copy message"}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-green-400" />
                  <span className="hidden sm:inline text-green-400">
                    Copied
                  </span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span className="hidden sm:inline">
                    Copy
                  </span>
                </>
              )}
            </button>

            {/* AI ONLY ACTIONS */}
            {!isUser && (
              <>
                {/* Regenerate */}
                <button
                  type="button"
                  onClick={() => onRegenerate?.(message)}
                  title="Regenerate answer"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                >
                  <RefreshCw size={13} />
                  <span className="hidden sm:inline">
                    Regenerate
                  </span>
                </button>

                {/* Improve */}
                <button
                  type="button"
                  onClick={() => onImprove?.(message)}
                  title="Improve answer"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                >
                  <Sparkles size={13} />
                  <span className="hidden sm:inline">
                    Improve
                  </span>
                </button>

                {/* Make shorter */}
                <button
                  type="button"
                  onClick={() => onMakeShorter?.(message)}
                  title="Make answer shorter"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                >
                  <Minimize2 size={13} />
                  <span className="hidden sm:inline">
                    Shorter
                  </span>
                </button>

                {/* Explain simply */}
                <button
                  type="button"
                  onClick={() => onExplainSimply?.(message)}
                  title="Explain simply"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                >
                  <Lightbulb size={13} />
                  <span className="hidden sm:inline">
                    Simplify
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
          <User size={16} className="text-slate-400" />
        </div>
      )}
    </div>
  );
}


