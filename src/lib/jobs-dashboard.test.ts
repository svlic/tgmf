import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
import { JOB_DETAIL_RECORD_LIMIT } from "@/lib/jobs-snapshots";
import type { JobStatus } from "@/lib/types";

const tempDirectory = mkdtempSync(join(tmpdir(), "tgmf-jobs-dashboard-"));
process.env.DATABASE_URL = join(tempDirectory, "test.db");

afterAll(() => {
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("job dashboard repositories", () => {
  let repositories: typeof import("@/lib/db/repositories");
  let dashboard: typeof import("@/lib/jobs-dashboard");

  beforeAll(async () => {
    repositories = await import("@/lib/db/repositories");
    dashboard = await import("@/lib/jobs-dashboard");
  });

  it.each([
    { statuses: [], active: [], archived: [] },
    { statuses: ["paused", "failed", "draft", "running", "pending"], active: [0, 1, 2, 3, 4], archived: [] },
    { statuses: ["cancelled", "completed"], active: [], archived: [0, 1] },
    { statuses: ["completed", "failed", "cancelled", "pending", "draft", "paused", "running"], active: [1, 3, 4, 5, 6], archived: [0, 2] },
  ])("preserves overview grouping and repository order for $statuses", ({ statuses, active, archived }) => {
    const account = repositories.accountRepository.create({ label: "Overview", phoneNumber: "+10000000003" })!;
    try {
      const jobs = statuses.map((status) => {
        const job = repositories.jobRepository.create({
          accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
          startMessageId: 1, endMessageId: 3, jobOrder: "asc", mode: "forward", albumStrategy: "full_group",
        })!;
        return repositories.jobRepository.setStatus(job.id, status as JobStatus)!;
      });
      const order = repositories.jobRepository.list().filter((job) => job.account_id === account.id);
      const snapshot = dashboard.buildJobsOverviewSnapshot();
      const activeIds = active.map((index) => jobs[index].id);
      const archivedIds = archived.map((index) => jobs[index].id);
      expect(snapshot.active_jobs.map((job) => job.id)).toEqual(order.filter((job) => activeIds.includes(job.id)).map((job) => job.id));
      expect(snapshot.archived_jobs.map((job) => job.id)).toEqual(order.filter((job) => archivedIds.includes(job.id)).map((job) => job.id));
      expect(snapshot.stats).toEqual({
        total: jobs.length, active: active.length,
        queued: statuses.filter((status) => status === "pending" || status === "paused").length,
        completed: statuses.filter((status) => status === "completed").length,
        failed: statuses.filter((status) => status === "failed").length,
      });
      expect(snapshot.needs_polling).toBe(statuses.includes("pending") || statuses.includes("running"));
      expect([...snapshot.active_jobs, ...snapshot.archived_jobs].every((job) => job.account_label === "Overview")).toBe(true);
    } finally {
      getDb().prepare("DELETE FROM sync_jobs WHERE account_id = ?").run(account.id);
      repositories.accountRepository.delete(account.id);
    }
  });

  it("returns only the latest bounded transfer records when a job has many records", () => {
    const account = repositories.accountRepository.create({
      label: "Account",
      phoneNumber: "+10000000000",
    });
    expect(account).not.toBeNull();
    if (!account) {
      return;
    }

    const job = repositories.jobRepository.create({
      accountId: account.id,
      sourceChannelRef: "source",
      targetChannelRef: "target",
      startMessageId: 1,
      endMessageId: 150,
      jobOrder: "asc",
      mode: "forward",
      albumStrategy: "full_group",
    });
    expect(job).not.toBeNull();
    if (!job) {
      return;
    }

    for (let sourceMessageId = 1; sourceMessageId <= 150; sourceMessageId += 1) {
      repositories.transferRecordRepository.upsert({
        jobId: job.id,
        sourceMessageId,
        targetMessageId: sourceMessageId + 1000,
        status: "sent",
      });
    }

    const snapshot = dashboard.buildJobDetailSnapshot(job.id);

    expect(snapshot?.record_count).toBe(150);
    expect(snapshot?.records.length).toBe(JOB_DETAIL_RECORD_LIMIT);
    expect(snapshot?.records[0]?.source_message_id).toBe(51);
    expect(snapshot?.records.at(-1)?.source_message_id).toBe(150);
  });

  it("keeps a newly created job unclaimable until it is manually started", () => {
    const account = repositories.accountRepository.create({
      label: "Manual start account",
      phoneNumber: "+10000000002",
    });
    expect(account).not.toBeNull();
    if (!account) {
      return;
    }

    const job = repositories.jobRepository.create({
      accountId: account.id,
      sourceChannelRef: "manual-source",
      targetChannelRef: "manual-target",
      startMessageId: 1,
      endMessageId: 1,
      jobOrder: "asc",
      mode: "forward",
      albumStrategy: "full_group",
    });

    expect(job?.status).toBe("draft");
    expect(repositories.jobRepository.claimNext("worker-before-start")).toBeNull();

    const started = job ? repositories.jobRepository.requestStart(job.id) : null;

    expect(started?.status).toBe("pending");
    expect(repositories.jobRepository.claimNext("worker-after-start")?.id).toBe(job?.id);
  });

  it("clears nullable status fields when explicit null extras are provided", () => {
    const account = repositories.accountRepository.create({
      label: "Second account",
      phoneNumber: "+10000000001",
    });
    expect(account).not.toBeNull();
    if (!account) {
      return;
    }

    const job = repositories.jobRepository.create({
      accountId: account.id,
      sourceChannelRef: "source-2",
      targetChannelRef: "target-2",
      startMessageId: 1,
      endMessageId: 1,
      jobOrder: "asc",
      mode: "forward",
      albumStrategy: "full_group",
    });
    expect(job).not.toBeNull();
    if (!job) {
      return;
    }

    repositories.jobRepository.setStatus(job.id, "running", {
      worker_id: "worker-1",
      last_error_code: "old_code",
      last_error_message: "old message",
      cancel_requested_at: "2026-01-01T00:00:00.000Z",
    });

    const resumed = repositories.jobRepository.setStatus(job.id, "pending", {
      worker_id: null,
      last_error_code: null,
      last_error_message: null,
    });

    expect(resumed?.worker_id).toBeNull();
    expect(resumed?.last_error_code).toBeNull();
    expect(resumed?.last_error_message).toBeNull();
  });
});
