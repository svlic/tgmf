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
    if (["completed", "cancelled"].includes(job.status)) {
      return fail("Completed or cancelled jobs cannot be cancelled again", 409);
    }

    const updatedJob = withRepositoryError(() => jobRepository.requestCancel(jobId));
    return ok({ job: updatedJob });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to cancel job", 400);
  }
}
