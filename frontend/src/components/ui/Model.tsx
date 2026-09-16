import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  FileUp,
  X,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { DeepThinkingMode } from "../../utils/const";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect?: (file: File) => void;

  // Deep thinking callbacks
  onDeepThinkingOff?: () => void;
  onDeepThinkingOn?: () => void;
}

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onFileSelect,
  onDeepThinkingOff,
  onDeepThinkingOn,
}: DocumentUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [deepThinking, setDeepThinking] = useState(localStorage.getItem(DeepThinkingMode)?true:false);

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    onFileSelect?.(file);

    onClose();

    event.target.value = "";
  };

  const handleDeepThinkingToggle = () => {
    setDeepThinking((previous) => {
      const newValue = !previous;

      if (newValue) {
        // Deep thinking turned ON
        onDeepThinkingOn?.();
      } else {
        // Deep thinking turned OFF
        onDeepThinkingOff?.();
      }

      return newValue;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.92,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.92,
                y: 20,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              onClick={(e) => e.stopPropagation()}
              className="
                relative w-full max-w-md
                overflow-hidden rounded-2xl
                border border-white/10
                bg-slate-950
                p-5 shadow-2xl
                sm:p-6
              "
            >
              {/* Decorative glow */}
              <div
                className="
                  pointer-events-none absolute
                  -right-20 -top-20
                  h-40 w-40
                  rounded-full
                  bg-[#155DFC]/20
                  blur-3xl
                "
              />

              {/* Header */}
              <div className="relative mb-6 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#155DFC]/10 text-[#155DFC]">
                      <FileUp size={18} />
                    </div>

                    <h2 className="text-base font-semibold text-white sm:text-lg">
                      Document Tools
                    </h2>
                  </div>

                  <p className="text-xs leading-5 text-slate-400 sm:text-sm">
                    Upload a document or configure how the AI
                    should reason.
                  </p>
                </div>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="
                    flex h-8 w-8 shrink-0
                    items-center justify-center
                    rounded-lg
                    text-slate-500
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  <X size={18} />
                </button>
              </div>

              {/* Actions */}
              <div className="relative space-y-3">

                {/* Upload File */}
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="
                    group flex w-full items-center
                    gap-4 rounded-xl
                    border border-[#155DFC]/30
                    bg-[#155DFC]/10
                    p-4 text-left
                    transition-all duration-200
                    hover:border-[#155DFC]/60
                    hover:bg-[#155DFC]/15
                    hover:shadow-lg
                    hover:shadow-[#155DFC]/10
                    active:scale-[0.98]
                  "
                >
                  <div
                    className="
                      flex h-11 w-11 shrink-0
                      items-center justify-center
                      rounded-xl
                      bg-[#155DFC]
                      text-white
                      shadow-lg
                      shadow-[#155DFC]/20
                      transition-transform
                      group-hover:scale-105
                    "
                  >
                    <FileUp size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      Upload File
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Upload PDF or TXT document
                    </p>
                  </div>

                  <span className="text-xs font-medium text-[#155DFC]">
                    Select
                  </span>
                </button>

                {/* Deep Thinking */}
                <button
                  type="button"
                  onClick={handleDeepThinkingToggle}
                  aria-pressed={deepThinking}
                  className={`
                    group flex w-full items-center
                    gap-4 rounded-xl
                    border p-4 text-left
                    transition-all duration-200
                    active:scale-[0.98]
                    ${
                      deepThinking
                        ? "border-[#155DFC]/50 bg-[#155DFC]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
                    }
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`
                      flex h-11 w-11 shrink-0
                      items-center justify-center
                      rounded-xl
                      transition-all duration-200
                      ${
                        deepThinking
                          ? "bg-[#155DFC] text-white shadow-lg shadow-[#155DFC]/20"
                          : "bg-white/10 text-slate-400 group-hover:text-slate-200"
                      }
                    `}
                  >
                    {deepThinking ? (
                      <Sparkles size={20} />
                    ) : (
                      <Brain size={20} />
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      Deep Thinking
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {deepThinking
                        ? "Extended reasoning enabled"
                        : "Use standard reasoning"}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div
                    className={`
                      relative h-6 w-11 shrink-0
                      rounded-full
                      transition-colors duration-200
                      ${
                        deepThinking
                          ? "bg-[#155DFC]"
                          : "bg-slate-700"
                      }
                    `}
                  >
                    <motion.span
                      animate={{
                        x: deepThinking ? 20 : 2,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className="
                        absolute left-0 top-1
                        h-4 w-4 rounded-full
                        bg-white shadow-sm
                      "
                    />
                  </div>
                </button>
              </div>

              {/* Footer */}
              <div className="relative mt-5 border-t border-white/5 pt-4">
                <p className="text-center text-[11px] text-slate-500">
                  Supported formats: PDF and TXT
                </p>
              </div>

              {/* File input */}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,application/pdf,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}