import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
};

export function StatTile({ label, value, hint, className }: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border/60 bg-background/80 px-4 py-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}