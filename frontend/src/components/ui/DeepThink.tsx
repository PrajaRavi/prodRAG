import { Brain, Sparkles } from "lucide-react";
import { toast } from "react-toastify";

interface DeepThinkToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function DeepThinkToggle({
  enabled,
  onChange,
}: DeepThinkToggleProps) {
  const handleToggle = () => {
    const nextState = !enabled;

    onChange(nextState);

    if (nextState) {
      toast.warn(
        "Deep Think is enabled. LLM responses may take longer to generate.",
        {
          position: "top-right",
          autoClose: 3500,
        }
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={enabled}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
        enabled
          ? "border-[#155DFC]/40 bg-[#155DFC]/10"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
          enabled
            ? "bg-[#155DFC] text-white shadow-lg shadow-[#155DFC]/25"
            : "bg-white/10 text-slate-400 group-hover:text-white"
        }`}
      >
        {enabled ? <Sparkles size={16} /> : <Brain size={16} />}
      </div>

      {/* Text */}
      <div className="flex flex-col items-start">
        <span
          className={`text-sm font-medium transition-colors ${
            enabled ? "text-white" : "text-slate-300"
          }`}
        >
          Deep Think
        </span>

        <span className="text-[11px] text-slate-500">
          {enabled ? "Enhanced reasoning" : "Standard reasoning"}
        </span>
      </div>

      {/* Toggle */}
      <div
        className={`relative ml-2 h-5 w-9 rounded-full transition-colors duration-200 ${
          enabled ? "bg-[#155DFC]" : "bg-slate-700"
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}