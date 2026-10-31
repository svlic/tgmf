import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WORKER_HEARTBEAT_STALE_MS } from "@/lib/constants";

const databasePath = join(tmpdir(), `tgmf-account-flood-wait-${process.pid}.db`);
process.env.DATABASE_URL = databasePath;

const { getDb } = await import("@/lib/db/client");
const { accountRepository, jobEventRepository, jobRepository, workerRepository } = await import("@/lib/db/repositories");

function createJob(accountId: string) {
  return jobRepository.create({
    accountId,
    sourceChannelRef: "source",
    targetChannelRef: "target",
    startMessageId: 1,
    endMessageId: 1,
    jobOrder: "asc",
    mode: "forward",
    albumStrategy: "full_group",
  });
}

function createReadyAccountAndJob(label: string, phoneNumber: string) {
  const account = accountRepository.create({ label, phoneNumber });
  if (!account) {
    throw new Error("Failed to create test account");
  }
  const job = createJob(account.id);
  if (!job) {
    throw new Error("Failed to create test job");
  }
  return { account, job };
}

beforeEach(() => {
  getDb().exec("DELETE FROM sync_jobs; DELETE FROM telegram_accounts; DELETE FROM worker_heartbeats;");
});

afterAll(() => {
  getDb().close();
  rmSync(databasePath, { force: true });
});

describe("jobRepository.create search selection", () => {
  it("stores search selection without message ID bounds", () => {
    const account = accountRepository.create({ label: "search-unbounded", phoneNumber: "+10000000097" });
    if (!account) {
      throw new Error("Failed to create test account");
    }

    const job = jobRepository.create({
      accountId: account.id,
      sourceChannelRef: "source",
      targetChannelRef: "target",
      selection: "search",
      searchQuery: "keyword",
      jobOrder: "asc",
      mode: "forward",
      albumStrategy: "full_group",
    });

    expect(job).toMatchObject({
      selection: "search",
      start_message_id: 0,
      end_message_id: 0,
      total_messages: 0,
      next_message_id: null,
    });
  });

  it("stores bounded search selection with zero total and null next id until plan is set", () => {
    const account = accountRepository.create({ label: "search-acct", phoneNumber: "+10000000099" });
    if (!account) {
      throw new Error("Failed to create test account");
    }

    const job = jobRepository.create({
      accountId: account.id,
      sourceChannelRef: "source",
      targetChannelRef: "target",
      startMessageId: 10,
      endMessageId: 50,
      selection: "search",
      searchQuery: "keyword",
      jobOrder: "desc",
      mode: "forward",
      albumStrategy: "full_group",
    });
    if (!job) {
      throw new Error("Failed to create search job");
    }

    expect(job).toMatchObject({
      selection: "search",
      search_query: "keyword",
      total_messages: 0,
      next_message_id: null,
      start_message_id: 10,
      end_message_id: 50,
      job_order: "desc",
    });

    const planned = jobRepository.setMessagePlan(job.id, {
      totalMessages: 3,
      nextMessageId: 40,
    });
    expect(planned).toMatchObject({
      total_messages: 3,
      next_message_id: 40,
    });
  });

  it.each([-1, 1.5, Number.NaN])("rejects invalid supplied message ID %s", (messageId) => {
    const account = accountRepository.create({ label: "search-invalid", phoneNumber: "+10000000096" });
    if (!account) {
      throw new Error("Failed to create test account");
    }

    expect(() =>
      jobRepository.create({
        accountId: account.id,
        sourceChannelRef: "source",
        targetChannelRef: "target",
        startMessageId: messageId,
        selection: "search",
        searchQuery: "keyword",
        jobOrder: "asc",
        mode: "forward",
        albumStrategy: "full_group",
      }),
    ).toThrow(/positive integer/i);
  });

  it("rejects search selection without a query", () => {
    const account = accountRepository.create({ label: "search-missing", phoneNumber: "+10000000098" });
    if (!account) {
      throw new Error("Failed to create test account");
    }

    expect(() =>
      jobRepository.create({
        accountId: account.id,
        sourceChannelRef: "source",
        targetChannelRef: "target",
        startMessageId: 1,
        endMessageId: 2,
        selection: "search",
        searchQuery: "  ",
        jobOrder: "asc",
        mode: "copy",
        albumStrategy: "captioned_only",
      }),
    ).toThrow(/searchQuery is required/i);
  });
});

describe("account-scoped Telegram flood waits", () => {
  it("claims another account's job while the oldest account is cooling down", () => {
    const coolingAccount = accountRepository.create({ label: "cooling", phoneNumber: "+10000000001" });
    const readyAccount = accountRepository.create({ label: "ready", phoneNumber: "+10000000002" });
    if (!coolingAccount || !readyAccount) {
      throw new Error("Failed to create test accounts");
    }
    const coolingJob = createJob(coolingAccount.id);
    const secondCoolingJob = createJob(coolingAccount.id);
    const readyJob = createJob(readyAccount.id);
    if (!coolingJob || !secondCoolingJob || !readyJob) {
      throw new Error("Failed to create test jobs");
    }
    jobRepository.setStatus(coolingJob.id, "running", { worker_id: "worker_flooded" });
    jobRepository.requestStart(secondCoolingJob.id);
    jobRepository.requestStart(readyJob.id);

    jobRepository.deferForFloodWait({
      jobId: coolingJob.id,
      accountId: coolingAccount.id,
      workerId: "worker_flooded",
      waitSeconds: 60,
      errorMessage: "FLOOD_WAIT_60",
    });

    const claimed = jobRepository.claimNext("worker_test");

    expect(claimed?.id).toBe(readyJob.id);
    expect(jobRepository.getById(coolingJob.id)).toMatchObject({
      status: "pending",
      worker_id: null,
      last_error_code: "telegram_flood_wait",
      last_error_message: "FLOOD_WAIT_60",
      flood_wait_events: 1,
    });
    expect(jobRepository.getById(secondCoolingJob.id)?.status).toBe("pending");
    expect(accountRepository.getById(coolingAccount.id)).toMatchObject({
      flood_wait_until: expect.any(String),
      adaptive_interval_ms: 4_000,
    });
    expect(jobEventRepository.listLatestForJob(coolingJob.id, 10)).toEqual([
      expect.objectContaining({
        job_id: coolingJob.id,
        event_type: "flood_wait",
        status: "warn",
        details: "FLOOD_WAIT_60",
        wait_seconds: 60,
        adaptive_interval_ms: 4_000,
      }),
    ]);
    expect(
      jobRepository.failIfRunningByWorker({
        jobId: coolingJob.id,
        workerId: "worker_flooded",
        errorMessage: "disconnect failed",
      }),
    ).toBe(false);
    expect(jobRepository.getById(coolingJob.id)?.status).toBe("pending");

    getDb()
      .prepare("UPDATE telegram_accounts SET flood_wait_until = ? WHERE id = ?")
      .run(new Date(Date.now() - 1_000).toISOString(), coolingAccount.id);

    expect(jobRepository.claimNext("worker_after_wait")?.account_id).toBe(coolingAccount.id);
  });

  it("backs off repeatedly and recovers toward the configured floor after successful RPCs", () => {
    // Given
    const { account, job } = createReadyAccountAndJob("adaptive", "+10000000017");
    jobRepository.setStatus(job.id, "running", { worker_id: "adaptive_worker" });
    jobRepository.deferForFloodWait({
      jobId: job.id,
      accountId: account.id,
      workerId: "adaptive_worker",
      waitSeconds: 30,
      errorMessage: "FLOOD_WAIT_30",
    });
    jobRepository.setStatus(job.id, "running", { worker_id: "adaptive_worker" });

    // When
    jobRepository.deferForFloodWait({
      jobId: job.id,
      accountId: account.id,
      workerId: "adaptive_worker",
      waitSeconds: 60,
      errorMessage: "FLOOD_WAIT_60",
    });
    accountRepository.recordTelegramSuccess(account.id, 2_000);

    // Then
    expect(accountRepository.getById(account.id)?.adaptive_interval_ms).toBe(6_000);
  });

  it("does not defer a job after its worker loses ownership", () => {
    const account = accountRepository.create({ label: "paused", phoneNumber: "+10000000003" });
    if (!account) {
      throw new Error("Failed to create test account");
    }
    const job = createJob(account.id);
    if (!job) {
      throw new Error("Failed to create test job");
    }
    jobRepository.setStatus(job.id, "paused", { worker_id: null });

    const result = jobRepository.deferForFloodWait({
      jobId: job.id,
      accountId: account.id,
      workerId: "stale_worker",
      waitSeconds: 60,
      errorMessage: "FLOOD_WAIT_60",
    });

    expect(result).toBe(false);
    expect(jobRepository.getById(job.id)).toMatchObject({ status: "paused", worker_id: null });
    expect(accountRepository.getById(account.id)?.flood_wait_until).toBeNull();
  });

  it("does not cool a different account for a running job", () => {
    const jobAccount = accountRepository.create({ label: "job", phoneNumber: "+10000000004" });
    const otherAccount = accountRepository.create({ label: "other", phoneNumber: "+10000000005" });
    if (!jobAccount || !otherAccount) {
      throw new Error("Failed to create test accounts");
    }
    const job = createJob(jobAccount.id);
    if (!job) {
      throw new Error("Failed to create test job");
    }
    jobRepository.setStatus(job.id, "running", { worker_id: "worker_owner" });

    const result = jobRepository.deferForFloodWait({
      jobId: job.id,
      accountId: otherAccount.id,
      workerId: "worker_owner",
      waitSeconds: 60,
      errorMessage: "FLOOD_WAIT_60",
    });

    expect(result).toBe(false);
    expect(jobRepository.getById(job.id)).toMatchObject({ status: "running", worker_id: "worker_owner" });
    expect(accountRepository.getById(jobAccount.id)?.flood_wait_until).toBeNull();
    expect(accountRepository.getById(otherAccount.id)?.flood_wait_until).toBeNull();
  });
});

describe("job transfer observability", () => {
  it("records send attempts separately from delivery outcomes", () => {
    // Given
    const { job } = createReadyAccountAndJob("metrics", "+10000000010");
    const attemptedAt = "2026-07-12T08:00:00.000Z";
    jobRepository.setStatus(job.id, "running", { worker_id: "worker_owner" });

    // When
    const recorded = jobRepository.recordSendAttempt({
      jobId: job.id,
      accountId: job.account_id,
      workerId: "worker_owner",
      attemptedAt,
      forward: true,
    });
    jobRepository.recordProgress(job.id, {
      nextMessageId: null,
      skippedIncrement: 1,
      forwardUnmappedIncrement: 1,
    });

    // Then
    expect(recorded).toBe(true);
    expect(jobRepository.getById(job.id)).toMatchObject({
      send_attempts: 1,
      forward_attempts: 1,
      forward_confirmed: 0,
      forward_unmapped: 1,
      last_send_attempt_at: attemptedAt,
    });
  });

  it("rejects a send attempt after worker ownership changes", () => {
    // Given
    const { job } = createReadyAccountAndJob("stale metrics", "+10000000016");
    jobRepository.setStatus(job.id, "running", { worker_id: "replacement_worker" });

    // When
    const recorded = jobRepository.recordSendAttempt({
      jobId: job.id,
      accountId: job.account_id,
      workerId: "stale_worker",
      attemptedAt: "2026-07-12T08:00:00.000Z",
      forward: true,
    });

    // Then
    expect(recorded).toBe(false);
    expect(jobRepository.getById(job.id)).toMatchObject({
      send_attempts: 0,
      forward_attempts: 0,
      last_send_attempt_at: null,
    });
  });
});

describe("account send serialization", () => {
  it("logs the worker state at resume without exposing account or message content", () => {
    const { job } = createReadyAccountAndJob("private-label", "+10000000019");
    jobRepository.setStatus(job.id, "paused", { worker_id: "blocked-worker" });
    workerRepository.heartbeat("blocked-worker", "running", job.id, {
      phase: "fetch_album", sourceMessageId: 600055, unrelated: "private-message-content",
    });
    getDb().prepare("UPDATE worker_heartbeats SET heartbeat_at = ?").run(new Date(Date.now() - 90_000).toISOString());
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      expect(jobRepository.requestResume(job.id)?.status).toBe("pending");
      const lines = output.mock.calls.map(([line]) => String(line));
      const snapshot = lines.map((line) => JSON.parse(line)).find((event) => event.event === "job_control_worker_snapshot");
      expect(snapshot).toMatchObject({
        jobId: job.id, jobStatus: "pending", jobWorkerId: null,
        workerId: "blocked-worker", workerStatus: "running", workerCurrentJobId: job.id,
        workerPhase: "fetch_album", workerSourceMessageId: 600055, accountFloodWaitUntil: null,
      });
      expect(snapshot.workerHeartbeatAgeMs).toBeGreaterThanOrEqual(90_000);
      expect(lines.join("\n")).not.toMatch(/private-label|10000000019|private-message-content/);
    } finally {
      output.mockRestore();
    }
  });

  it("resumes only paused jobs without erasing progress or diagnostic errors", () => {
    const { job } = createReadyAccountAndJob("controls", "+10000000018");
    jobRepository.setStatus(job.id, "running", {
      worker_id: "owner", processed_messages: 7, succeeded_messages: 7,
      last_error_code: "telegram_delivery_unknown", last_error_message: "Check target before retrying",
    });
    expect(() => jobRepository.requestResume(job.id)).toThrow("Only paused");
    jobRepository.requestPause(job.id);
    expect(jobRepository.requestResume(job.id)).toMatchObject({
      status: "pending", worker_id: null, processed_messages: 7, succeeded_messages: 7,
      last_error_code: "telegram_delivery_unknown", last_error_message: "Check target before retrying",
    });
    expect(() => jobRepository.requestResume(job.id)).toThrow("Only paused");
    jobRepository.setStatus(job.id, "completed");
    expect(() => jobRepository.requestPause(job.id)).toThrow("Only pending or running");
    expect(jobRepository.getById(job.id)?.status).toBe("completed");
  });

  it("does not claim a second job while the same account has a running job", () => {
    // Given
    const account = accountRepository.create({ label: "serialized", phoneNumber: "+10000000015" });
    if (!account) {
      throw new Error("Failed to create test account");
    }
    const runningJob = createJob(account.id);
    const pendingJob = createJob(account.id);
    if (!runningJob || !pendingJob) {
      throw new Error("Failed to create test jobs");
    }
    jobRepository.setStatus(runningJob.id, "running", { worker_id: "active_worker" });
    jobRepository.requestStart(pendingJob.id);
    workerRepository.heartbeat("active_worker", "running", runningJob.id);

    // When
    const claimed = jobRepository.claimNext("other_worker");

    // Then
    expect(claimed).toBeNull();
    expect(jobRepository.getById(pendingJob.id)?.status).toBe("pending");
  });
});

describe("stale running job reclaim", () => {
  it("reclaims a running job when the owning worker has no heartbeat", () => {
    const { job } = createReadyAccountAndJob("orphan", "+10000000011");
    jobRepository.setStatus(job.id, "running", { worker_id: "dead_worker" });

    const claimed = jobRepository.claimNext("survivor");

    expect(claimed?.id).toBe(job.id);
    expect(claimed).toMatchObject({
      status: "running",
      worker_id: "survivor",
      last_error_code: "worker_stale_reclaimed",
    });
  });

  it("does not reclaim a running job while the owning worker heartbeat is fresh", () => {
    const { job } = createReadyAccountAndJob("live", "+10000000012");
    jobRepository.setStatus(job.id, "running", { worker_id: "live_worker" });
    workerRepository.heartbeat("live_worker", "running", job.id);

    const claimed = jobRepository.claimNext("other_worker");

    expect(claimed).toBeNull();
    expect(jobRepository.getById(job.id)).toMatchObject({
      status: "running",
      worker_id: "live_worker",
    });
  });

  it("reclaims a running job when the owning worker heartbeat is older than the lease", () => {
    const { job } = createReadyAccountAndJob("expired", "+10000000013");
    jobRepository.setStatus(job.id, "running", { worker_id: "stale_worker" });
    workerRepository.heartbeat("stale_worker", "running", job.id);
    getDb()
      .prepare("UPDATE worker_heartbeats SET heartbeat_at = ? WHERE worker_id = ?")
      .run(new Date(Date.now() - WORKER_HEARTBEAT_STALE_MS - 1_000).toISOString(), "stale_worker");

    const claimed = jobRepository.claimNext("survivor");

    expect(claimed?.id).toBe(job.id);
    expect(claimed?.worker_id).toBe("survivor");
    expect(jobRepository.getById(job.id)?.last_error_code).toBe("worker_stale_reclaimed");
  });

  it("reclaims a running job when the owning worker marked itself stale", () => {
    const { job } = createReadyAccountAndJob("shutdown", "+10000000014");
    jobRepository.setStatus(job.id, "running", { worker_id: "shutdown_worker" });
    workerRepository.heartbeat("shutdown_worker", "stale", null, { phase: "crashed" });

    const claimed = jobRepository.claimNext("survivor");

    expect(claimed?.id).toBe(job.id);
    expect(claimed?.worker_id).toBe("survivor");
  });
});
