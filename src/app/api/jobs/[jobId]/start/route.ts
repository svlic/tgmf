import { assertCsrf } from "@/lib/csrf";
import { jobRepository, withRepositoryError } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { unstable_rethrow as rethrowNextError } from "next/navigation";

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
