import { ACCOUNTS_MUTATED_EVENT } from "@/lib/accounts-snapshots";
import { JOBS_MUTATED_EVENT } from "@/lib/jobs-snapshots";

function notifyMutated(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

export function notifyAccountsMutated() {
  notifyMutated(ACCOUNTS_MUTATED_EVENT);
}

export function notifyJobsMutated() {
  notifyMutated(JOBS_MUTATED_EVENT);
}
