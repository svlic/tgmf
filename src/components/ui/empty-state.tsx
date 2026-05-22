import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  className,
  title,
  description,
  children,
}: React.HTMLAttributes<HTMLDivElement> & { title: string; description: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
    </div>
  );
}
