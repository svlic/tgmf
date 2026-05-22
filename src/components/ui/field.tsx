import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-slate-800", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 text-slate-500", className)} {...props} />;
}

export function FieldMessage({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLParagraphElement> & { tone?: "default" | "error" | "success" }) {
  return (
    <p
      className={cn(
        "text-sm",
        tone === "default" && "text-slate-500",
        tone === "error" && "text-red-600",
        tone === "success" && "text-emerald-600",
        className,
      )}
      {...props}
    />
  );
}
