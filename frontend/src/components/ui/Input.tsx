import type { InputHTMLAttributes } from "react";

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({
  label,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}

      <input
        className={`w-full rounded-xl border border-white/10
          bg-white/5 px-4 py-3 text-sm text-white
          outline-none placeholder:text-slate-500
          transition-all duration-200
          focus:border-blue-500/70 focus:bg-white/[0.07]
          focus:ring-2 focus:ring-blue-500/10
          ${className}`}
        {...props}
      />
    </div>
  );
}