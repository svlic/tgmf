import { jobRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_POLL_INTERVAL_MS } from "@/lib/constants";
import { processJob, WorkerCleanupError } from "@/lib/telegram/service";
import { JobExecutionError } from "@/lib/telegram/job-execution";
import { systemErrorFields, systemLog } from "@/lib/logger";
import { generateId, nowIso, safeErrorMessage, sleep } from "@/lib/utils";
import { startWorkerDiagnostics, updateWorkerDiagnostics, withWorkerDiagnosticStage } from "@/lib/worker-diagnostics";

const workerId = process.env.WORKER_ID?.trim() || generateId("worker");
const stopDiagnostics = startWorkerDiagnostics(workerId);
let stopped = false;

function heartbeat(status: "idle" | "running" | "stale", currentJobId?: string | null, details?: Record<string, unknown>) {
  withWorkerDiagnosticStage("heartbeat_write", () => workerRepository.heartbeat(workerId, status, currentJobId ?? null, {
    ...details,
    updatedAt: nowIso(),
    pid: process.pid,
  }));
}

async function runJob() {
  updateWorkerDiagnostics({ phase: "scheduler", mainStage: "scheduler" });
  const job = withWorkerDiagnosticStage("claim_next", () => jobRepository.claimNext(workerId));
  if (!job) {
    updateWorkerDiagnostics({ jobId: null, accountId: null, sourceMessageId: null, phase: "idle", mainStage: "idle", operationStartedAt: null, lastProgressAt: null });
    heartbeat("idle", null, { reason: "no_pending_jobs" });
    await sleep(WORKER_POLL_INTERVAL_MS);
    return;
  }

  updateWorkerDiagnostics({ jobId: job.id, accountId: job.account_id, sourceMessageId: job.next_message_id, phase: "claimed" });
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
    systemLog("error", "job_failure_handling_started", { workerId, jobId: job.id, ...systemErrorFields(error) });
    withWorkerDiagnosticStage("failure_write", () => jobRepository.failIfRunningByWorker({
      jobId: job.id,
      workerId,
      errorMessage,
    }));
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
}).finally(stopDiagnostics);
