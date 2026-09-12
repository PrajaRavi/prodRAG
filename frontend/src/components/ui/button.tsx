import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export default function Button({
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl
        px-4 py-2.5 text-sm font-medium
        transition-all duration-200
        disabled:cursor-not-allowed disabled:opacity-40
        ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}