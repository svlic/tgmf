import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { jobRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    await requireAdminSession();
    await assertCsrf();
    const { jobId } = await context.params;
    const job = jobRepository.getById(jobId);
    if (!job) {
      return fail("Job not found", 404);
    }
    if (!["failed", "completed", "cancelled", "paused"].includes(job.status)) {
      return fail("Job must be finished, paused, or failed before retrying", 409);
    }

    const updatedJob = withRepositoryError(() => jobRepository.retryFailed(jobId));
    return ok({ job: updatedJob });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to retry failed messages", 400);
  }
}
