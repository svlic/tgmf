import { JOBS_MUTATED_EVENT } from "@/lib/jobs-snapshots";

export function notifyJobsMutated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(JOBS_MUTATED_EVENT));
}