import { unstable_rethrow } from "next/navigation";

export function rethrowNextError(error: unknown) {
  unstable_rethrow(error);
}
