import { buildJobsOverviewSnapshot } from "@/lib/jobs-dashboard";
import { fail, ok } from "@/lib/http";
import { unstable_rethrow as rethrowNextError } from "next/navigation";

export async function GET() {
  try {
    return ok(buildJobsOverviewSnapshot());
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load jobs overview", 400);
  }
}
