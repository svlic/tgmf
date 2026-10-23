export type JobStatus =
  | "draft"
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type JobMode = "forward" | "copy";
export type JobOrder = "asc" | "desc";
export type JobSelection = "range" | "search";
export type AlbumStrategy = "full_group" | "captioned_only";
export const ALLOWED_MEDIA_TYPES = ["text", "photo", "video", "audio", "voice", "document", "other"] as const;
export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];
export type MessageRecordStatus = "pending" | "sent" | "warn" | "skipped" | "failed";

export type WorkerStatus = "idle" | "running" | "stale";

export type TelegramLoginState =
  | "logged_out"
  | "awaiting_code"
  | "awaiting_password"
  | "ready"
  | "reauth_required";

export type TelegramAccountRow = {
  id: string;
  label: string;
  phone_number: string;
  api_id_override: string | null;
  api_hash_override_encrypted: string | null;
  session_encrypted: string | null;
  login_state: TelegramLoginState;
  login_hint: string | null;
  telegram_user_id: string | null;
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
  flood_wait_until: string | null;
  adaptive_interval_ms: number;
};

export type TelegramLoginSessionRow = {
  account_id: string;
  phone_number: string;
  phone_code_hash_encrypted: string;
  session_encrypted: string;
  started_at: string;
  updated_at: string;
};

export type SyncJobRow = {
  id: string;
  account_id: string;
  source_channel_ref: string;
  target_channel_ref: string;
  start_message_id: number;
  end_message_id: number;
  selection: JobSelection;
  search_query: string | null;
  job_order: JobOrder;
  mode: JobMode;
  album_strategy: AlbumStrategy;
  allowed_media_types: string;
  keyword_whitelist: string;
  keyword_blacklist: string;
  regex_whitelist: string;
  regex_blacklist: string;
  delay_seconds: number;
  status: JobStatus;
  total_messages: number;
  processed_messages: number;
  succeeded_messages: number;
  skipped_messages: number;
  failed_messages: number;
  local_skips: number;
  send_attempts: number;
  forward_attempts: number;
  forward_confirmed: number;
  forward_unmapped: number;
  flood_wait_events: number;
  last_send_attempt_at: string | null;
  next_message_id: number | null;
  worker_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  cancel_requested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type JobEventRow = {
  id: string;
  job_id: string;
  event_type: "flood_wait";
  status: "warn";
  details: string;
  wait_seconds: number | null;
  adaptive_interval_ms: number | null;
  created_at: string;
};

export type MessageTransferRecordRow = {
  id: string;
  job_id: string;
  source_message_id: number;
  target_message_id: number | null;
  media_group_id: string | null;
  status: MessageRecordStatus;
  error_reason: string | null;
  processed_at: string | null;
  created_at: string;
};

export type DialogCacheRow = {
  id: string;
  account_id: string;
  peer_id: string;
  title: string;
  username: string | null;
  entity_type: string;
  is_public: number;
  raw_json: string;
  fetched_at: string;
};

export type WorkerHeartbeatRow = {
  worker_id: string;
  status: WorkerStatus;
  current_job_id: string | null;
  heartbeat_at: string;
  started_at: string;
  details_json: string | null;
};
