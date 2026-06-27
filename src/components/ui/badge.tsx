import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "slate" | "blue" | "green" | "amber" | "red";
};

export function Badge({ className, variant = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "status-pill inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize tracking-normal",
        variant === "slate" && "border-border bg-secondary text-secondary-foreground",
        variant === "blue" && "border-primary/20 bg-primary/10 text-primary",
        variant === "green" &&
          "border-[color:color-mix(in_oklab,var(--success)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--success)_14%,transparent)] text-success-foreground",
        variant === "amber" &&
          "border-[color:color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--warning)_18%,transparent)] text-warning-foreground",
        variant === "red" && "border-destructive/25 bg-destructive/10 text-destructive",
        className,
      )}
      {...props}
    />
  );
}
