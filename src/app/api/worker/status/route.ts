import { requireAdminSession } from "@/lib/auth";
import { workerRepository } from "@/lib/db/repositories";
import { fail, ok } from "@/lib/http";
import { WORKER_HEARTBEAT_STALE_MS } from "@/lib/constants";

export async function GET() {
  try {
    await requireAdminSession();
    const worker = workerRepository.getLatest() ?? null;
    const isStale = worker
      ? Date.now() - new Date(worker.heartbeat_at).getTime() > WORKER_HEARTBEAT_STALE_MS
      : true;

    return ok({ worker, isStale });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to load worker status", 400);
  }
}
