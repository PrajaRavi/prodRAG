import React, { useState, useRef, useEffect } from 'react';
import type { AxiosProgressEvent } from 'axios';
import axios from 'axios';

interface FileUploadState {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
}


export function ChatGPTPromptBox() {
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef(new Map());

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      uploads.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const uploadSingleDocument = async (id: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('document', file);

    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploads((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, progress: percent } : item
              )
            );
          }
        },
      });

      abortControllers.current.delete(id);
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: 'success', progress: 100 } : item
        )
      );
    } catch (error) {
      abortControllers.current.delete(id);

      if (axios.isCancel(error)) {
        setUploads((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: 'cancelled', errorMessage: 'Cancelled' }
              : item
          )
        );
        return;
      }

      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Failed';

      setUploads((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'error', errorMessage: message }
            : item
        )
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const selectedFiles = Array.from(e.target.files);

    const newUploads: FileUploadState[] = selectedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
      progress: 0,
      status: 'uploading',
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    newUploads.forEach((item) => {
      uploadSingleDocument(item.id, item.file).catch(() => {});
    });

    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    // Abort if active upload
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
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
    const ext = name.split('.').pop() || '';
    return ext.toUpperCase().slice(0, 4);
  };

  return (
    <div className="min-h-screen bg-[#212121] text-gray-100 flex flex-col justify-end p-4 sm:p-6">
      <div className="max-w-3xl w-full mx-auto">
        {/* ChatGPT Input Card */}
        <div className="bg-[#2f2f2f] rounded-3xl p-3 border border-gray-700/60 shadow-2xl transition-all">
          
          {/* File Attachments Grid */}
          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-2.5 px-2 pt-1 pb-3">
              {uploads.map((item) => {
                // Circular progress calculation
                const radius = 14;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset =
                  circumference - (item.progress / 100) * circumference;

                return (
                  <div
                    key={item.id}
                    className="relative group w-36 h-16 rounded-xl bg-[#212121] border border-gray-700/80 p-2 flex items-center gap-2 overflow-hidden shadow-md"
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
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[9px] font-bold tracking-wider text-gray-300 uppercase">
                            {getFileExtension(item.file.name)}
                          </span>
                        </div>
                      )}

                      {/* Center Circular Progress Overlay while uploading */}
                      {item.status === 'uploading' && (
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
                    </div>

                    {/* Middle: Name and status */}
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-medium text-gray-200 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-[10px] text-gray-400 capitalize truncate">
                        {item.status === 'uploading'
                          ? `${item.progress}%`
                          : item.status === 'error'
                          ? (item.errorMessage || 'Error')
                          : (item.file.size / (1024 * 1024)).toFixed(1) + ' MB'}
                      </p>
                    </div>

                    {/* Top-Right Cross Button to cancel/remove */}
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 hover:bg-black/90 text-gray-300 hover:text-white flex items-center justify-center transition"
                      title="Remove document"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Action Bar: + button, textarea, send button */}
          <div className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Left + Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white transition"
              title="Add attachment"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            {/* Expandable Textarea */}
            <textarea
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 max-h-48 resize-none bg-transparent outline-none text-sm text-gray-100 placeholder-gray-400 py-1.5 px-2"
            />

            {/* Send Arrow Button */}
            <button
              type="button"
              disabled={!prompt.trim() && uploads.length === 0}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                prompt.trim() || uploads.length > 0
                  ? 'bg-white text-black hover:opacity-90'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}