import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOB_DETAIL_RECORD_LIMIT } from "@/lib/jobs-snapshots";

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

    const resumed = repositories.jobRepository.requestResume(job.id);

    expect(resumed?.worker_id).toBeNull();
    expect(resumed?.last_error_code).toBeNull();
    expect(resumed?.last_error_message).toBeNull();
  });
});
