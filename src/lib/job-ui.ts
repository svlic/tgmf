import type { JobSelection } from "@/lib/types";

type BadgeVariant = "slate" | "blue" | "green" | "amber" | "red";

export function formatMessageBounds(selection: JobSelection, startMessageId: number, endMessageId: number) {
  if (selection === "range" || (startMessageId > 0 && endMessageId > 0)) {
    return `${startMessageId}–${endMessageId}`;
  }
  if (startMessageId > 0) {
    return `From ID ${startMessageId}`;
  }
  if (endMessageId > 0) {
    return `Through ID ${endMessageId}`;
  }
  return "All matching messages";
}

export function jobStatusVariant(status: string): BadgeVariant {
  if (status === "completed") {
    return "green";
  }

  if (["running", "pending"].includes(status)) {
    return "blue";
  }

  if (["failed", "cancelled"].includes(status)) {
    return "red";
  }

  return "amber";
}

export function formatJobDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function jobProgressPercent(processed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((processed / total) * 100));
}