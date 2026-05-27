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

export function FieldMessage({
  className,
  tone = "default",
  role,
  "aria-live": ariaLive,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: "default" | "error" | "success" }) {
  const liveRegion = ariaLive ?? (tone === "error" ? "assertive" : tone === "success" ? "polite" : undefined);

  return (
    <p
      className={cn(
        "rounded-[calc(var(--radius)-0.25rem)] border px-3 py-2 text-sm leading-6 shadow-sm shadow-black/5",
        tone === "default" && "border-border/70 bg-muted/45 text-muted-foreground",
        tone === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "success" && "border-[color:color-mix(in_oklab,var(--success)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--success)_12%,transparent)] text-success-foreground",
        className,
      )}
      role={role ?? (tone === "error" ? "alert" : undefined)}
      aria-live={liveRegion}
      {...props}
    />
  );
}
