import { buildAccountsOverviewSnapshot } from "@/lib/accounts-dashboard";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";

export async function GET() {
  try {
    return ok(buildAccountsOverviewSnapshot());
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load accounts overview", 400);
  }
}
