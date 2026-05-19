import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "danger";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "default" && "border-slate-900 bg-slate-900 text-white hover:bg-slate-700",
        variant === "secondary" && "border-slate-200 bg-white text-slate-900 hover:bg-slate-100",
        variant === "danger" && "border-red-600 bg-red-600 text-white hover:bg-red-500",
        className,
      )}
      {...props}
    />
  );
}
