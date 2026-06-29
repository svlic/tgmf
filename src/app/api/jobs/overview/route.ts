import { requireAdminSession } from "@/lib/auth";
import { buildJobsOverviewSnapshot } from "@/lib/jobs-dashboard";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";

export async function GET() {
  try {
    await requireAdminSession();
    return ok(buildJobsOverviewSnapshot());
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load jobs overview", 400);
  }
}