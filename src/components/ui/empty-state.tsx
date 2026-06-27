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
        "rounded-[var(--radius-xl)] border border-dashed border-border bg-secondary/45 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mx-auto max-w-md space-y-2">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {children ? <div className="pt-4">{children}</div> : null}
      </div>
    </div>
  );
}
