import { jobRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_POLL_INTERVAL_MS } from "@/lib/constants";
import { processJob } from "@/lib/telegram/service";
import { generateId, nowIso, safeErrorMessage, sleep } from "@/lib/utils";

function summarizeError(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    hasError: true,
  };
}

const workerId = process.env.WORKER_ID?.trim() || generateId("worker");
let stopped = false;

function heartbeat(status: "idle" | "running" | "stale", currentJobId?: string | null, details?: Record<string, unknown>) {
  workerRepository.heartbeat(workerId, status, currentJobId ?? null, {
    ...details,
    updatedAt: nowIso(),
    pid: process.pid,
  });
}

async function runJob() {
  const job = jobRepository.claimNext(workerId);
  if (!job) {
    heartbeat("idle", null, { reason: "no_pending_jobs" });
    await sleep(WORKER_POLL_INTERVAL_MS);
    return;
  }

  heartbeat("running", job.id, { phase: "claimed" });

  try {
    await processJob(job, workerId, () => {
      heartbeat("running", job.id, { phase: "processing" });
    });

    const latestJob = jobRepository.getById(job.id);
    heartbeat("idle", null, {
      phase: "job_finished",
      jobId: job.id,
      finalStatus: latestJob?.status ?? "unknown",
    });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    jobRepository.setStatus(job.id, "failed", {
      worker_id: workerId,
      finished_at: nowIso(),
      last_error_code: "worker_job_failed",
      last_error_message: errorMessage,
    });
    heartbeat("idle", null, {
      phase: "job_failed",
      jobId: job.id,
      ...summarizeError(error),
    });
  }
}


async function main() {
  heartbeat("idle", null, { phase: "starting" });

  while (!stopped) {
    await runJob();
  }

  heartbeat("stale", null, { phase: "stopped" });
}

function stop(signal: string) {
  stopped = true;
  heartbeat("stale", null, { phase: "shutdown", signal });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

main().catch((error) => {
  heartbeat("stale", null, {
    phase: "crashed",
    ...summarizeError(error),
  });
  process.exitCode = 1;
});
