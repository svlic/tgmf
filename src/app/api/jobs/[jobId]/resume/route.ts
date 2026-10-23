import { assertCsrf } from "@/lib/csrf";
import { jobRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { rethrowNextError } from "@/lib/next";

export async function POST(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    await assertCsrf();
    const { jobId } = await context.params;
    const job = jobRepository.getById(jobId);
    if (!job) {
      return fail("Job not found", 404);
    }
    if (job.status !== "paused") {
      return fail("Only paused jobs can be resumed", 409);
    }

    const updatedJob = withRepositoryError(() => jobRepository.requestResume(jobId));
    return ok({ job: updatedJob });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to resume job", 400);
  }
}
