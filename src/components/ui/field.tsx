import * as React from "react";
import { cn } from "@/lib/utils";

export function Field({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2.5", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium tracking-[0.01em] text-foreground", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs leading-5 text-muted-foreground", className)} {...props} />;
}

export function FieldMessage({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLParagraphElement> & { tone?: "default" | "error" | "success" }) {
  return (
    <p
      className={cn(
        "text-sm leading-6",
        tone === "default" && "text-muted-foreground",
        tone === "error" && "text-destructive",
        tone === "success" && "text-[color:var(--success)]",
        className,
      )}
      {...props}
    />
  );
}
