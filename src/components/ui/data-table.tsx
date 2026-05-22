import * as React from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <table className={cn("w-full min-w-full border-collapse", className)} {...props} />
      </div>
    </div>
  );
}

export function DataTableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-slate-50/80", className)} {...props} />;
}

export function DataTableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100", className)} {...props} />;
}

export function DataTableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("align-top transition-colors hover:bg-slate-50/60", className)} {...props} />;
}

export function DataTableHeader({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-4 text-sm text-slate-600", className)} {...props} />;
}
