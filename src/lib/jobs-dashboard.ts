import { accountRepository, jobRepository, transferRecordRepository, workerRepository } from "@/lib/db/repositories";
import { WORKER_HEARTBEAT_STALE_MS } from "@/lib/constants";
import { formatJobDateTime, jobProgressPercent } from "@/lib/job-ui";
import type {
  JobDetailSnapshot,
  JobListItemSnapshot,
  JobsOverviewSnapshot,
} from "@/lib/jobs-snapshots";
import type { JobStatus, SyncJobRow, TelegramAccountRow } from "@/lib/types";

export type { JobDetailSnapshot, JobListItemSnapshot, JobsOverviewSnapshot } from "@/lib/jobs-snapshots";

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["pending", "running", "paused", "failed"];
export const QUEUED_JOB_STATUSES: readonly JobStatus[] = ["pending", "paused"];
export const REFRESHING_JOB_STATUSES: readonly JobStatus[] = ["pending", "running"];

function toJobListItem(job: SyncJobRow, account: TelegramAccountRow | null): JobListItemSnapshot {
  return {
    id: job.id,
    source_channel_ref: job.source_channel_ref,
    target_channel_ref: job.target_channel_ref,
    status: job.status,
    mode: job.mode,
    start_message_id: job.start_message_id,
    end_message_id: job.end_message_id,
    processed_messages: job.processed_messages,
    total_messages: job.total_messages,
    progress_percent: jobProgressPercent(job.processed_messages, job.total_messages),
    last_error_message: job.last_error_message,
    finished_at: job.finished_at,
    account_label: account?.label ?? null,
  };
}

export function buildJobsOverviewSnapshot(): JobsOverviewSnapshot {
  const jobs = jobRepository.list();
  const accounts = accountRepository.list();
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const worker = workerRepository.getLatest() ?? null;
  const workerIsStale = worker
    ? Date.now() - new Date(worker.heartbeat_at).getTime() > WORKER_HEARTBEAT_STALE_MS
    : true;

  const activeJobs = jobs.filter((job) => ACTIVE_JOB_STATUSES.includes(job.status));
  const activeJobIds = new Set(activeJobs.map((job) => job.id));
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const archivedJobs = jobs.filter((job) => !activeJobIds.has(job.id));
  const queuedJobs = jobs.filter((job) => QUEUED_JOB_STATUSES.includes(job.status));
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const readyAccounts = accounts.filter((account) => account.login_state === "ready");
  const needsPolling = jobs.some((job) => REFRESHING_JOB_STATUSES.includes(job.status));

  return {
    stats: {
      total: jobs.length,
      active: activeJobs.length,
      queued: queuedJobs.length,
      completed: completedJobs.length,
      failed: failedJobs.length,
    },
    worker,
    worker_is_stale: workerIsStale,
    worker_heartbeat_label: worker ? formatJobDateTime(worker.heartbeat_at) : "never",
    ready_accounts: readyAccounts.length,
    total_accounts: accounts.length,
    needs_polling: needsPolling,
    active_jobs: activeJobs.map((job) => toJobListItem(job, accountById.get(job.account_id) ?? null)),
    archived_jobs: archivedJobs.map((job) => toJobListItem(job, accountById.get(job.account_id) ?? null)),
  };
}

export function buildJobDetailSnapshot(jobId: string): JobDetailSnapshot | null {
  const job = jobRepository.getById(jobId);
  if (!job) {
    return null;
  }

  const account = accountRepository.getById(job.account_id);
  const records = transferRecordRepository.listForJob(jobId).map((record) => ({
    id: record.id,
    source_message_id: record.source_message_id,
    target_message_id: record.target_message_id,
    media_group_id: record.media_group_id,
    status: record.status,
    error_reason: record.error_reason,
    processed_at: record.processed_at,
  }));

  return {
    job,
    account_label: account?.label ?? null,
    account_phone: account?.phone_number ?? null,
    progress_percent: jobProgressPercent(job.processed_messages, job.total_messages),
    needs_polling: REFRESHING_JOB_STATUSES.includes(job.status),
    records,
  };
}