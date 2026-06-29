"use client";

import { FieldMessage } from "@/components/ui/field";

export function PollRefreshBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <FieldMessage tone="error" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
      Live refresh failed: {message}. Showing last loaded data.
    </FieldMessage>
  );
}