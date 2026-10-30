import { jobRepository } from "@/lib/db/repositories";
import { systemErrorFields, systemLog } from "@/lib/logger";
import type { SyncJobRow } from "@/lib/types";

export class JobExecutionError extends Error {
  constructor(readonly code: "control_changed" | "operation_timeout", readonly phase: string) {
    super(`${code}: ${phase}`);
  }
}

// The deadline measures inactivity, so large media transfers can continue while making progress.
const OPERATION_IDLE_TIMEOUT_MS = 120_000;

export class JobExecution {
  private lastProgressAt = Date.now();
  sourceMessageId: number | null = null;

  constructor(
    private readonly job: SyncJobRow,
    private readonly workerId: string,
    private readonly heartbeat: (details: Record<string, unknown>) => void,
  ) {}

  log(level: "info" | "warn" | "error", event: string, fields: Parameters<typeof systemLog>[2] = {}) {
    systemLog(level, event, {
      workerId: this.workerId, jobId: this.job.id, accountId: this.job.account_id,
      sourceMessageId: this.sourceMessageId, ...fields,
    });
  }

  assertActive() {
    const current = jobRepository.getById(this.job.id);
    if (!current || current.status !== "running" || current.worker_id !== this.workerId || current.cancel_requested_at) {
      throw new JobExecutionError("control_changed", "control_check");
    }
  }

  progress() {
    this.lastProgressAt = Date.now();
  }

  async run<T>(phase: string, operation: () => Promise<T>, options: {
    timeoutMs?: number;
    interruptible?: boolean;
    checkControl?: boolean;
  } = {}): Promise<T> {
    if (options.checkControl !== false) this.assertActive();
    const startedAt = Date.now();
    this.progress();
    let lastReportAt = startedAt;
    let timer: ReturnType<typeof setInterval> | undefined;
    this.log("info", "operation_started", { phase });
    try {
      const result = await Promise.race([
        Promise.resolve().then(operation),
        new Promise<never>((_, reject) => {
          timer = setInterval(() => {
            const now = Date.now();
            const details = {
              phase, sourceMessageId: this.sourceMessageId,
              elapsedMs: now - startedAt, idleMs: now - this.lastProgressAt,
            };
            try {
              if (options.checkControl !== false && options.interruptible !== false) this.assertActive();
              if (details.idleMs >= (options.timeoutMs ?? OPERATION_IDLE_TIMEOUT_MS)) {
                throw new JobExecutionError("operation_timeout", phase);
              }
              if (now - lastReportAt >= 10_000) {
                this.heartbeat(details);
                const current = jobRepository.getById(this.job.id);
                this.log("info", "operation_waiting", {
                  ...details, status: current?.status ?? "missing",
                  processedMessages: current?.processed_messages ?? 0,
                  nextMessageId: current?.next_message_id ?? null,
                });
                lastReportAt = now;
              }
            } catch (error) {
              reject(error);
            }
          }, 1_000);
        }),
      ]);
      this.log("info", "operation_completed", { phase, elapsedMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.log("warn", error instanceof JobExecutionError ? error.code : "operation_failed", {
        phase, elapsedMs: Date.now() - startedAt, ...systemErrorFields(error),
      });
      throw error;
    } finally {
      clearInterval(timer);
    }
  }
}
