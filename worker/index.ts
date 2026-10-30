import { jobRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_POLL_INTERVAL_MS } from "@/lib/constants";
import { processJob, WorkerCleanupError } from "@/lib/telegram/service";
import { JobExecutionError } from "@/lib/telegram/job-execution";
import { systemErrorFields, systemLog } from "@/lib/logger";
import { generateId, nowIso, safeErrorMessage, sleep } from "@/lib/utils";

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
  systemLog("info", "job_claimed", { workerId, jobId: job.id, accountId: job.account_id, nextMessageId: job.next_message_id });

  try {
    await processJob(job, workerId, (details) => {
      heartbeat("running", job.id, { phase: "processing", ...details });
    });

    const latestJob = jobRepository.getById(job.id);
    heartbeat("idle", null, {
      phase: "job_finished",
      jobId: job.id,
      finalStatus: latestJob?.status ?? "unknown",
    });
    systemLog("info", "job_released", { workerId, jobId: job.id, status: latestJob?.status ?? "unknown" });
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    jobRepository.failIfRunningByWorker({
      jobId: job.id,
      workerId,
      errorMessage,
    });
    heartbeat("idle", null, {
      phase: "job_failed",
      jobId: job.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      hasError: true,
    });
    systemLog("error", "job_failed", { workerId, jobId: job.id, ...systemErrorFields(error) });
    if (error instanceof WorkerCleanupError || (error instanceof JobExecutionError && error.code === "operation_timeout")) {
      // Promise deadlines cannot cancel GramJS internals. Exit to dispose all outstanding sockets/requests.
      heartbeat("stale", null, { phase: "restarting_after_timeout" });
      systemLog("error", "worker_restart_required", { workerId, jobId: job.id });
      process.exit(1);
    }
  }
}

async function main() {
  heartbeat("idle", null, { phase: "starting" });
  systemLog("info", "worker_started", { workerId, pid: process.pid });

  while (!stopped) {
    await runJob();
  }

  heartbeat("stale", null, { phase: "stopped" });
}

function stop(signal: string) {
  stopped = true;
  systemLog("info", "worker_shutdown_requested", { workerId, signal });
  heartbeat("stale", null, { phase: "shutdown", signal });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

main().catch((error) => {
  systemLog("error", "worker_crashed", { workerId, ...systemErrorFields(error) });
  heartbeat("stale", null, {
    phase: "crashed",
    errorName: error instanceof Error ? error.name : "UnknownError",
    hasError: true,
  });
  process.exitCode = 1;
});
