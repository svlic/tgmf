import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 shadow-sm shadow-slate-950/5 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}
