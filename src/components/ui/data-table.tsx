import * as React from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border/70 bg-card/90 shadow-[var(--shadow-panel)] backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-full border-collapse", className)} {...props} />
      </div>
    </div>
  );
}

export function DataTableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/30", className)} {...props} />;
}

export function DataTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border/70", className)} {...props} />;
}

export function DataTableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("align-top transition-colors duration-200 hover:bg-accent/30", className)} {...props} />;
}

export function DataTableHeader({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-sm text-muted-foreground", className)} {...props} />;
}
