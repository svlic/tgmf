import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "slate" | "blue" | "green" | "amber" | "red";
};

export function Badge({ className, variant = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variant === "slate" && "border-slate-200 bg-slate-100 text-slate-700",
        variant === "blue" && "border-sky-200 bg-sky-50 text-sky-700",
        variant === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        variant === "amber" && "border-amber-200 bg-amber-50 text-amber-700",
        variant === "red" && "border-red-200 bg-red-50 text-red-700",
        className,
      )}
      {...props}
    />
  );
}
