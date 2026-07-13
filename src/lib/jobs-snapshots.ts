import type { JobStatus, MessageRecordStatus, SyncJobRow, WorkerHeartbeatRow } from "@/lib/types";

export const JOBS_POLL_INTERVAL_MS = 2_000;
export const JOBS_MUTATED_EVENT = "tgmf:jobs-mutated";
export const JOB_DETAIL_RECORD_LIMIT = 100;

export type JobListItemSnapshot = {
  id: string;
  source_channel_ref: string;
  target_channel_ref: string;
  status: JobStatus;
  mode: SyncJobRow["mode"];
  start_message_id: number;
  end_message_id: number;
  processed_messages: number;
  total_messages: number;
  progress_percent: number;
  last_error_code: string | null;
  last_error_message: string | null;
  finished_at: string | null;
  account_label: string | null;
};

export type JobsOverviewSnapshot = {
  stats: {
    total: number;
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  worker: WorkerHeartbeatRow | null;
  worker_is_stale: boolean;
  worker_heartbeat_label: string;
  ready_accounts: number;
  total_accounts: number;
  needs_polling: boolean;
  active_jobs: JobListItemSnapshot[];
  archived_jobs: JobListItemSnapshot[];
};

export type JobDetailSnapshot = {
  job: SyncJobRow;
  account_label: string | null;
  account_phone: string | null;
  progress_percent: number;
  needs_polling: boolean;
  record_count: number;
  record_limit: number;
  records: Array<{
    id: string;
    source_message_id: number | null;
    target_message_id: number | null;
    media_group_id: string | null;
    status: MessageRecordStatus;
    error_reason: string | null;
    processed_at: string | null;
    kind: "transfer" | "flood_wait";
  }>;
};