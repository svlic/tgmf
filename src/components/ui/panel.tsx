import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
};

/** Inset surface: stats, env tiles, compact meta blocks (see DESIGN.md §4). */
export function Panel({ children, className, padding = "default" }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card text-card-foreground",
        padding === "default" && "px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}