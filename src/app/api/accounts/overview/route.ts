import { buildAccountsOverviewSnapshot } from "@/lib/accounts-dashboard";
import { fail, ok } from "@/lib/http";
import { unstable_rethrow as rethrowNextError } from "next/navigation";

export async function GET() {
  try {
    return ok(buildAccountsOverviewSnapshot());
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load accounts overview", 400);
  }
}
