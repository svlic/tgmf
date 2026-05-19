import { requireAdminSession, assertCsrf } from "@/lib/auth";
import { jobRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";

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
    if (!["pending", "running", "claimed"].includes(job.status)) {
      return fail("Only pending or running jobs can be paused", 409);
    }

    const updatedJob = withRepositoryError(() => jobRepository.requestPause(jobId));
    return ok({ job: updatedJob });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to pause job", 400);
  }
}
