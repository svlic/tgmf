import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-[calc(var(--radius)-0.125rem)] border border-input bg-white/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm shadow-black/5 outline-none transition focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}
