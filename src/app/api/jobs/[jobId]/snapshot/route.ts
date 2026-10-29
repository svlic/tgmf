import { buildJobDetailSnapshot } from "@/lib/jobs-dashboard";
import { fail, ok } from "@/lib/http";
import { unstable_rethrow as rethrowNextError } from "next/navigation";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const snapshot = buildJobDetailSnapshot(jobId);
    if (!snapshot) {
      return fail("Job not found", 404);
    }

    return ok(snapshot);
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to load job snapshot", 400);
  }
}
