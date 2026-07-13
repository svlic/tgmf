import { assertCsrf, requireAdminSession } from "@/lib/auth";
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
    if (job.status !== "draft") {
      return fail("Only draft jobs can be started", 409);
    }

    const updatedJob = withRepositoryError(() => jobRepository.requestStart(jobId));
    return ok({ job: updatedJob });
  } catch (error) {
    rethrowNextError(error);
    return fail(error instanceof Error ? error.message : "Failed to start job", 400);
  }
}
