import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  Mic,
  Send,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";

import type {
  ChatHistory,
  Conversation,
  ImageKitAuthResponse,
  ImageKitUploadResponse,
} from "../../types";

import { Link } from "react-router";
import {
  DeepThinkingMode,
  FASTAPI_BASE_URL,
  IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_UPLOAD_ENDPOINT,
} from "../../utils/const";

import "../../App.css";
import { useUser } from "../../context/Global";
import { toast } from "react-toastify";
import ChatList from "../ui/ChatList";
import DocumentUploadModal from "../ui/Model";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../utils/supabase";
import axios, { type AxiosProgressEvent } from "axios";

export interface FileUploadState {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'processing' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  conversationId?: string;
}

interface Props {
  messages: ChatHistory[];
  onSend: (message: string) => void;
  onOpenSidebar: () => void;
  IsStreaming: boolean;
}

export default function ChatWindow({
  messages,
  onSend,
  onOpenSidebar,
  IsStreaming,
}: Props) {
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const eventSources = useRef<Map<string, EventSource>>(new Map());

  const {
    ActiveConversation,
    user,
    setActiveConversation,
    setConversationHistory,
    ConversationHistory,
    DocumentModelOpen,
    setDocumentModelOpen,
    setuser,
  } = useUser();

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      uploads.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      abortControllers.current.forEach((controller) => controller.abort());
      abortControllers.current.clear();
      eventSources.current.forEach((es) => es.close());
      eventSources.current.clear();
    };
  }, []);

  const handleSend = () => {
    if (!ActiveConversation || ActiveConversation.id === "") {
      return toast.warn("upload document or select any conversation");
    }
    const value = input.trim();

    if (!value) return;

    onSend(value);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const UpdateUserCount = async (email: string, newCount: number) => {
    try {
      const { data, error }: { data: any; error: any } = await supabase
        .from("users")
        .update({ count: newCount })
        .eq("email", email)
        .select();

      if (error) {
        toast.error("something went wrong during count increment");
        return false;
      }
      console.log(data);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  // --------------------------------------------------
  // Document upload database sync
  // --------------------------------------------------
  const Add_conversation_history_in_supabase = async (
    id: string,
    doc_name: string,
    user_id: number
  ) => {
    try {
      const { data, error } = await supabase
        .from("conversation_history")
        .insert({ id, doc_name, user_id });

      console.log(data);
      if (error) {
        if (error.code === "23505") {
          toast.error("This document already exists in your database");
          return false;
        } else {
          toast.error(error?.message);
          return false;
        }
      } else {
        return true;
      }
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  // --------------------------------------------------
  // Upload single document
  // --------------------------------------------------
  const uploadSingleDocument = async (id: string, file: File): Promise<void> => {
    const allowedExtensions = [".pdf", ".txt"];
    const allowedTypes = ["application/pdf", "text/plain"];
    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() || "");

    // Validate extension
    if (!allowedExtensions.includes(fileExtension)) {
      const errorMsg = "Only .pdf and .txt files are supported.";
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "error", errorMessage: errorMsg } : item
        )
      );
      toast.error(`"${file.name}": ${errorMsg}`);
      return;
    }

    // Validate MIME type if available
    if (file.type && !allowedTypes.includes(file.type)) {
      const errorMsg = "Only PDF and TXT files are supported.";
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "error", errorMessage: errorMsg } : item
        )
      );
      toast.warn(`"${file.name}": ${errorMsg}`);
      return;
    }

    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 10) {
      const errorMsg = "File size should be less than 10 MB";
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "error", errorMessage: errorMsg } : item
        )
      );
      toast.error(`"${file.name}": ${errorMsg}`);
      return;
    }

    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      // Step A: Fetch authentication parameters from FastAPI backend
      const authResponse = await axios.get<ImageKitAuthResponse>(
        `${FASTAPI_BASE_URL}/api/imagekit-auth`,
        { signal: controller.signal }
      );
      const { token, expire, signature } = authResponse.data;

      // Step B: Build FormData for ImageKit V1 API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
      formData.append("signature", signature);
      formData.append("token", token);
      formData.append("expire", expire.toString());
      formData.append("useUniqueFileName", "true");
      formData.append("folder", "/rag_documents");

      // Step C: Send POST request to ImageKit with upload progress tracking
      const uploadResponse = await axios.post<ImageKitUploadResponse>(
        IMAGEKIT_UPLOAD_ENDPOINT,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          signal: controller.signal,
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploads((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, progress: percentCompleted } : item
                )
              );
            }
          },
        }
      );

      // Step D: Dispatch distributed Celery pipeline to FastAPI (returns HTTP 202 immediately)
      const docid = uuidv4();

      const dispatchResponse = await axios.post(
        `${FASTAPI_BASE_URL}/api/RAG_process_delete_file_pipeline?file_id=${String(
          uploadResponse.data.fileId
        )}&path=${String(uploadResponse.data.url)}&signature=${String(
          signature
        )}&token=${token}&expire=${expire}&user_id=${String(
          user.id
        )}&conversation_id=${docid}`,
        {},
        { signal: controller.signal }
      );

      if (dispatchResponse.status !== 202 && !dispatchResponse.data?.success) {
        throw new Error("Failed to dispatch document processing");
      }

      // Step E: Update status to 'processing' and listen via Server-Sent Events (SSE)
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "processing", progress: 100, conversationId: docid }
            : item
        )
      );

      const sseUrl = `${FASTAPI_BASE_URL}/api/documents/stream/${docid}`;
      const es = new EventSource(sseUrl);
      eventSources.current.set(id, es);

      es.onmessage = async (sseEvent) => {
        try {
          const payload = JSON.parse(sseEvent.data);
          const currentStatus = payload.status;
          console.log(currentStatus)

          if (currentStatus === "READY" || currentStatus === "SUCCESS") {
            es.close();
            eventSources.current.delete(id);

            toast.success(`"${file.name}" analysed successfully! Now you can chat from your document.`);

            const conversation_obj: Conversation = {
              id: docid,
              doc_name: uploadResponse.data.name,
            };

            const conversation_history_supabase_result =
              await Add_conversation_history_in_supabase(
                docid,
                uploadResponse.data.name,
                user?.id
              );

            if (conversation_history_supabase_result !== false) {
              setConversationHistory((prev) => [...prev, conversation_obj]);
              setActiveConversation(conversation_obj);

              const result = await UpdateUserCount(user.email, Number(user?.count) + 1);
              if (result) {
                setuser?.((prev) => ({ ...prev, count: Number(prev.count || 0) + 1 }));
              }
            }

            abortControllers.current.delete(id);
            setUploads((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "success", progress: 100, conversationId: docid }
                  : item
              )
            );
          } else if (currentStatus === "FAILED") {
            es.close();
            eventSources.current.delete(id);
            abortControllers.current.delete(id);
            const errMsg = payload.error || "Document ingestion failed.";
            setUploads((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: "error", errorMessage: errMsg }
                  : item
              )
            );
            toast.error(`Error processing "${file.name}": ${errMsg}`);
          }
        } catch (err: any) {
          console.error("Error handling SSE message:", err);
        }
      };

      es.onerror = (err) => {
        console.warn("SSE stream closed or encountered error:", err);
      };
    } catch (error) {
      abortControllers.current.delete(id);
      const es = eventSources.current.get(id);
      if (es) {
        es.close();
        eventSources.current.delete(id);
      }

      if (axios.isCancel(error)) {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "cancelled", errorMessage: "Cancelled" }
              : item
          )
        );
        return;
      }

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error
        ? error.message
        : "Failed";

      setUploads((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "error", errorMessage: message }
            : item
        )
      );
      toast.error(`Error uploading "${file.name}": ${message}`);
    }
  };

  // --------------------------------------------------
  // Document upload handler for multiple documents
  // --------------------------------------------------
  const handleDocumentUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);

    const newUploads: FileUploadState[] = selectedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
      progress: 0,
      status: "uploading",
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    newUploads.forEach((item) => {
      uploadSingleDocument(item.id, item.file).catch(() => {});
    });
  };

  const handleRemove = (id: string) => {
    // Abort if active upload
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }

    const es = eventSources.current.get(id);
    if (es) {
      es.close();
      eventSources.current.delete(id);
    }

    // Revoke object URL
    const target = uploads.find((u) => u.id === id);
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }

    // Remove from UI list
    setUploads((prev) => prev.filter((item) => item.id !== id));
  };

  // Compute file extension for document icons
  const getFileExtension = (name: string) => {
    const ext = name.split(".").pop() || "";
    return ext.toUpperCase().slice(0, 4);
  };

  return (
    <>
      <main className="flex min-w-0 h-screen flex-1 flex-col bg-slate-900/40">
        <DocumentUploadModal
          isOpen={DocumentModelOpen}
          onClose={() => setDocumentModelOpen(false)}
          onDeepThinkingOff={() => {
            localStorage.removeItem(DeepThinkingMode);
          }}
          onDeepThinkingOn={() => {
            localStorage.setItem(DeepThinkingMode, "true");
          }}
          onFileSelect={(files: FileList) => {
            if (!files || files.length === 0) return;
            setDocumentModelOpen(false);
            handleDocumentUpload(files);
          }}
        />

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
              {ActiveConversation?.doc_name || "New Conversation"}
            </h1>

            <p className="text-xs text-slate-600">RAG powered conversation</p>
          </Link>
          <div className="absolute right-0"></div>
        </header>

        {/* Messages */}
        <ChatList
          IsStreaming={IsStreaming}
          messages={messages}
          messagesContainerRef={messagesContainerRef}
        />

        {/* Composer */}
        <div className="shrink-0 border-t border-white/10 bg-slate/60 p-3 backdrop-blur-xl sm:p-5">
          {(Number(user.count) < 2 || String(user.api_configured) === "true") && (
            <div className="mx-auto flex max-w-4xl flex-col rounded-3xl border border-white p-3 shadow-2xl transition-all">
              {/* File Attachments Grid */}
              {uploads.length > 0 && (
                <div className="flex flex-wrap gap-2.5 px-2 pt-1 pb-3">
                  {uploads.map((item) => {
                    // Circular progress calculation
                    const radius = 14;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset =
                      circumference - (item.progress / 100) * circumference;

                    const isCurrentActive =
                      item.conversationId &&
                      ActiveConversation?.id === item.conversationId;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.conversationId) {
                            const matched =
                              ConversationHistory.find(
                                (c) => c.id === item.conversationId
                              ) || {
                                id: item.conversationId,
                                doc_name: item.file.name,
                              };
                            setActiveConversation(matched);
                          }
                        }}
                        className={`relative group w-36 h-16 rounded-xl bg-[#212121] border p-2 flex items-center gap-2 overflow-hidden shadow-md transition cursor-pointer ${
                          isCurrentActive
                            ? "border-blue-500/80 ring-1 ring-blue-500/50"
                            : "border-gray-700/80 hover:border-gray-600"
                        }`}
                        title={
                          item.conversationId
                            ? "Click to switch to this document's conversation"
                            : item.file.name
                        }
                      >
                        {/* Left: Thumbnail or File Badge */}
                        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg bg-[#383838] flex items-center justify-center overflow-hidden">
                          {item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.8}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="text-[9px] font-bold tracking-wider text-gray-300 uppercase">
                                {getFileExtension(item.file.name)}
                              </span>
                            </div>
                          )}

                          {/* Center Circular Progress Overlay while uploading */}
                          {item.status === "uploading" && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                              <svg className="w-9 h-9 -rotate-90">
                                {/* Track circle */}
                                <circle
                                  cx="18"
                                  cy="18"
                                  r={radius}
                                  fill="transparent"
                                  stroke="#4b5563"
                                  strokeWidth="2.5"
                                />
                                {/* Progress fill circle */}
                                <circle
                                  cx="18"
                                  cy="18"
                                  r={radius}
                                  fill="transparent"
                                  stroke="#ffffff"
                                  strokeWidth="2.5"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  className="transition-[stroke-dashoffset] duration-150"
                                />
                              </svg>
                            </div>
                          )}

                          {/* Center Spinning Indicator while processing */}
                          {item.status === "processing" && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                            </div>
                          )}
                        </div>

                        {/* Middle: Name and status */}
                        <div className="flex-1 min-w-0 pr-2">
                          <p
                            className="text-xs font-medium text-gray-200 truncate"
                            title={item.file.name}
                          >
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-gray-400 capitalize truncate">
                            {item.status === "uploading"
                              ? `${item.progress}%`
                              : item.status === "processing"
                              ? "Analyzing..."
                              : item.status === "error"
                              ? item.errorMessage || "Error"
                              : item.status === "cancelled"
                              ? "Cancelled"
                              : (item.file.size / (1024 * 1024)).toFixed(1) +
                                " MB"}
                          </p>
                        </div>

                        {/* Top-Right Cross Button to cancel/remove */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(item.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white flex items-center justify-center transition z-10"
                          title="Remove document"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Main Action Bar */}
              <div className="flex items-end gap-2 ">
                <button
                  type="button"
                  onClick={() => setDocumentModelOpen(true)}
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white transition"
                  title="Upload document"
                >
                  <Plus size={20} />
                </button>

                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something about your documents..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
      
                />

                <button
                  type="button"
                  className="hidden rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white sm:flex items-center justify-center"
                  title="Voice input"
                >
                  <Mic size={19} />
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition ${
                    input.trim()
                      ? "bg-white text-black hover:opacity-90"
                      : "bg-white/10 text-gray-500 cursor-not-allowed"
                  }`}
                  title="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}

          <p className="mx-auto mt-2 max-w-4xl text-center text-[10px] text-slate-700">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </main>
    </>
  );
}
