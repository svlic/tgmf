import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "slate" | "blue" | "green" | "amber" | "red";
};

export function Badge({ className, variant = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "status-pill inline-flex items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em]",
        variant === "slate" && "border-border bg-secondary/85 text-secondary-foreground",
        variant === "blue" && "border-primary/15 bg-primary/10 text-primary",
        variant === "green" && "border-emerald-300/50 bg-emerald-400/10 text-emerald-700",
        variant === "amber" && "border-amber-300/60 bg-amber-400/12 text-amber-800",
        variant === "red" && "border-destructive/20 bg-destructive/10 text-destructive",
        className,
      )}
      {...props}
    />
  );
}
