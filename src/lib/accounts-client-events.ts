import { ACCOUNTS_MUTATED_EVENT } from "@/lib/accounts-snapshots";

export function notifyAccountsMutated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNTS_MUTATED_EVENT));
}