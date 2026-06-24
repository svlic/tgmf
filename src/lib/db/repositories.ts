import { getDb } from "@/lib/db/client";
import { DEFAULT_DELAY_SECONDS, LOGIN_WINDOW_MINUTES, MAX_LOGIN_ATTEMPTS } from "@/lib/constants";
import { encryptString, decryptString } from "@/lib/crypto";
import type {
  AllowedMediaType,
  AppSettingRow,
  DialogCacheRow,
  MessageTransferRecordRow,
  SyncJobRow,
  TelegramAccountRow,
  TelegramLoginSessionRow,
  WorkerHeartbeatRow,
  JobStatus,
} from "@/lib/types";
import { generateId, nowIso, safeErrorMessage } from "@/lib/utils";

export type AccountInput = {
  label: string;
  phoneNumber: string;
  apiIdOverride?: string | null;
  apiHashOverride?: string | null;
};

export type JobInput = {
  accountId: string;
  sourceChannelRef: string;
  targetChannelRef: string;
  startMessageId: number;
  endMessageId: number;
  jobOrder: SyncJobRow["job_order"];
  mode: SyncJobRow["mode"];
  albumStrategy: SyncJobRow["album_strategy"];
  allowedMediaTypes?: AllowedMediaType[];
  keywordWhitelist?: string[];
  keywordBlacklist?: string[];
  regexWhitelist?: string[];
  regexBlacklist?: string[];
  delaySeconds?: number;
};

function db() {
  return getDb();
}

function mapAccount(row: TelegramAccountRow | undefined) {
  return row ?? null;
}

export const accountRepository = {
  list(): TelegramAccountRow[] {
    return db().prepare(`SELECT * FROM telegram_accounts ORDER BY updated_at DESC`).all() as TelegramAccountRow[];
  },
  getById(id: string) {
    return mapAccount(
      db().prepare(`SELECT * FROM telegram_accounts WHERE id = ?`).get(id) as TelegramAccountRow | undefined,
    );
  },
  create(input: AccountInput) {
    const id = generateId("acct");
    const now = nowIso();
    db().prepare(
      `INSERT INTO telegram_accounts (
        id, label, phone_number, api_id_override, api_hash_override_encrypted,
        session_encrypted, login_state, login_hint, telegram_user_id, created_at, updated_at, last_connected_at
      ) VALUES (?, ?, ?, ?, ?, NULL, 'logged_out', NULL, NULL, ?, ?, NULL)`,
    ).run(
      id,
      input.label,
      input.phoneNumber,
      input.apiIdOverride || null,
      input.apiHashOverride ? encryptString(input.apiHashOverride) : null,
      now,
      now,
    );
    return this.getById(id);
  },
  update(id: string, input: AccountInput) {
    db().prepare(
      `UPDATE telegram_accounts
       SET label = ?, phone_number = ?, api_id_override = ?, api_hash_override_encrypted = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.label,
      input.phoneNumber,
      input.apiIdOverride || null,
      input.apiHashOverride ? encryptString(input.apiHashOverride) : null,
      nowIso(),
      id,
    );
    return this.getById(id);
  },
  saveSession(id: string, session: string, loginState: TelegramAccountRow["login_state"], telegramUserId?: string | null) {
    db().prepare(
      `UPDATE telegram_accounts
       SET session_encrypted = ?, login_state = ?, telegram_user_id = ?, updated_at = ?, last_connected_at = ?
       WHERE id = ?`,
    ).run(encryptString(session), loginState, telegramUserId ?? null, nowIso(), nowIso(), id);
  },
  clearSession(id: string, loginState: TelegramAccountRow["login_state"] = "logged_out") {
    db().prepare(
      `UPDATE telegram_accounts
       SET session_encrypted = NULL, login_state = ?, login_hint = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(loginState, nowIso(), id);
  },
  setLoginState(id: string, loginState: TelegramAccountRow["login_state"], loginHint?: string | null) {
    db().prepare(`UPDATE telegram_accounts SET login_state = ?, login_hint = ?, updated_at = ? WHERE id = ?`).run(
      loginState,
      loginHint ?? null,
      nowIso(),
      id,
    );
  },
  getResolvedApiCredentials(id: string) {
    const account = this.getById(id);
    if (!account) {
      throw new Error("Account not found");
    }

    const apiId = account.api_id_override || process.env.TELEGRAM_API_ID || "";
    const apiHash = account.api_hash_override_encrypted
      ? decryptString(account.api_hash_override_encrypted)
      : process.env.TELEGRAM_API_HASH || "";

    if (!apiId || !apiHash) {
      throw new Error("Missing Telegram API credentials for this account");
    }

    return { apiId: Number.parseInt(apiId, 10), apiHash };
  },
  getSessionString(id: string) {
    const account = this.getById(id);
    if (!account?.session_encrypted) {
      return null;
    }

    return decryptString(account.session_encrypted);
  },
};

export const telegramLoginSessionRepository = {
  save(input: { accountId: string; phoneNumber: string; phoneCodeHash: string; sessionString: string }) {
    const now = nowIso();
    db().prepare(
      `INSERT INTO telegram_login_sessions (
        account_id, phone_number, phone_code_hash_encrypted, session_encrypted, started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id)
      DO UPDATE SET phone_number = excluded.phone_number,
                    phone_code_hash_encrypted = excluded.phone_code_hash_encrypted,
                    session_encrypted = excluded.session_encrypted,
                    started_at = excluded.started_at,
                    updated_at = excluded.updated_at`,
    ).run(input.accountId, input.phoneNumber, encryptString(input.phoneCodeHash), encryptString(input.sessionString), now, now);
  },
  getActive(accountId: string) {
    const row = db().prepare(`SELECT * FROM telegram_login_sessions WHERE account_id = ?`).get(accountId) as
      | TelegramLoginSessionRow
      | undefined;
    if (!row) {
      return null;
    }

    const expiresAt = new Date(row.started_at).getTime() + LOGIN_WINDOW_MINUTES * 60_000;
    if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
      this.delete(accountId);
      return null;
    }

    return {
      phoneNumber: row.phone_number,
      phoneCodeHash: decryptString(row.phone_code_hash_encrypted),
      sessionString: decryptString(row.session_encrypted),
      startedAt: row.started_at,
    };
  },
  delete(accountId: string) {
    db().prepare(`DELETE FROM telegram_login_sessions WHERE account_id = ?`).run(accountId);
  },
};

export const loginAttemptRepository = {
  record(input: {
    accountId?: string | null;
    phoneNumber?: string | null;
    status: "success" | "failure";
    ipAddress?: string | null;
    userAgent?: string | null;
    reason?: string | null;
  }) {
    db().prepare(
      `INSERT INTO login_attempts (id, account_id, phone_number, status, ip_address, user_agent, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      generateId("login"),
      input.accountId ?? null,
      input.phoneNumber ?? null,
      input.status,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.reason ?? null,
      nowIso(),
    );
  },
  countRecentFailures(ipAddress: string) {
    const row = db()
      .prepare(
        `SELECT COUNT(*) as count FROM login_attempts
         WHERE ip_address = ? AND status = 'failure' AND created_at >= datetime('now', ?)`,
      )
      .get(ipAddress, `-${LOGIN_WINDOW_MINUTES} minutes`) as { count: number };
    return row.count;
  },
  assertNotRateLimited(ipAddress: string) {
    if (this.countRecentFailures(ipAddress) >= MAX_LOGIN_ATTEMPTS) {
      throw new Error("Too many login attempts. Please try again later.");
    }
  },
};

export const dialogRepository = {
  replaceForAccount(accountId: string, dialogs: Omit<DialogCacheRow, "id" | "account_id" | "fetched_at">[]) {
    const now = nowIso();
    const transaction = db().transaction(() => {
      db().prepare(`DELETE FROM dialog_cache WHERE account_id = ?`).run(accountId);
      const stmt = db().prepare(
        `INSERT INTO dialog_cache (id, account_id, peer_id, title, username, entity_type, is_public, raw_json, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const dialog of dialogs) {
        stmt.run(
          generateId("dlg"),
          accountId,
          dialog.peer_id,
          dialog.title,
          dialog.username,
          dialog.entity_type,
          dialog.is_public,
          dialog.raw_json,
          now,
        );
      }
    });
    transaction();
  },
  listForAccount(accountId: string) {
    return db().prepare(`SELECT * FROM dialog_cache WHERE account_id = ? ORDER BY title ASC`).all(accountId) as DialogCacheRow[];
  },
};

export const jobRepository = {
  list() {
    return db().prepare(`SELECT * FROM sync_jobs ORDER BY created_at DESC`).all() as SyncJobRow[];
  },
  getById(id: string) {
    return (db().prepare(`SELECT * FROM sync_jobs WHERE id = ?`).get(id) as SyncJobRow | undefined) ?? null;
  },
  create(input: JobInput) {
    if (input.startMessageId > input.endMessageId) {
      throw new Error("startMessageId must be less than or equal to endMessageId");
    }

    const totalMessages = input.endMessageId - input.startMessageId + 1;
    const nextMessageId = input.jobOrder === "asc" ? input.startMessageId : input.endMessageId;
    const id = generateId("job");
    const now = nowIso();

    db().prepare(
      `INSERT INTO sync_jobs (
        id, account_id, source_channel_ref, target_channel_ref, start_message_id, end_message_id,
        job_order, mode, album_strategy, allowed_media_types, keyword_whitelist, keyword_blacklist,
        regex_whitelist, regex_blacklist, delay_seconds, status, total_messages, processed_messages,
        succeeded_messages, skipped_messages, failed_messages, next_message_id, worker_id,
        last_error_code, last_error_message, cancel_requested_at, started_at, finished_at, created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, 0, 0, 0, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,

    ).run(
      id,
      input.accountId,
      input.sourceChannelRef,
      input.targetChannelRef,
      input.startMessageId,
      input.endMessageId,
      input.jobOrder,
      input.mode,
      input.albumStrategy,
      JSON.stringify(input.allowedMediaTypes ?? []),
      JSON.stringify(input.keywordWhitelist ?? []),
      JSON.stringify(input.keywordBlacklist ?? []),
      JSON.stringify(input.regexWhitelist ?? []),
      JSON.stringify(input.regexBlacklist ?? []),
      input.delaySeconds ?? DEFAULT_DELAY_SECONDS,
      totalMessages,
      nextMessageId,
      now,
      now,
    );

    return this.getById(id);
  },
  setStatus(id: string, status: JobStatus, extras?: Partial<SyncJobRow>) {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error("Job not found");
    }

    db().prepare(
      `UPDATE sync_jobs SET status = ?, worker_id = ?, next_message_id = ?, processed_messages = ?,
       succeeded_messages = ?, skipped_messages = ?, failed_messages = ?, last_error_code = ?,
       last_error_message = ?, cancel_requested_at = ?, started_at = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      status,
      extras?.worker_id ?? existing.worker_id,
      extras?.next_message_id ?? existing.next_message_id,
      extras?.processed_messages ?? existing.processed_messages,
      extras?.succeeded_messages ?? existing.succeeded_messages,
      extras?.skipped_messages ?? existing.skipped_messages,
      extras?.failed_messages ?? existing.failed_messages,
      extras?.last_error_code ?? existing.last_error_code,
      extras?.last_error_message ?? existing.last_error_message,
      extras?.cancel_requested_at ?? existing.cancel_requested_at,
      extras?.started_at ?? existing.started_at,
      extras?.finished_at ?? existing.finished_at,
      nowIso(),
      id,
    );
    return this.getById(id);
  },
  requestPause(id: string) {
    return this.setStatus(id, "paused");
  },
  requestResume(id: string) {
    return this.setStatus(id, "pending", { worker_id: null, last_error_code: null, last_error_message: null });
  },
  requestCancel(id: string) {
    return this.setStatus(id, "running", { cancel_requested_at: nowIso() });
  },
  retryFailed(id: string) {
    const job = this.getById(id);
    if (!job) {
      throw new Error("Job not found");
    }

    db().prepare(`DELETE FROM message_transfer_records WHERE job_id = ? AND status = 'failed'`).run(id);
    const nextMessageId = job.job_order === "asc" ? job.start_message_id : job.end_message_id;
    return this.setStatus(id, "pending", {
      next_message_id: nextMessageId,
      processed_messages: 0,
      succeeded_messages: 0,
      skipped_messages: 0,
      failed_messages: 0,
      worker_id: null,
      cancel_requested_at: null,
      started_at: null,
      finished_at: null,
      last_error_code: null,
      last_error_message: null,
    });
  },
  claimNext(workerId: string) {
    const candidate = db().prepare(`SELECT id FROM sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1`).get() as
      | { id: string }
      | undefined;
    if (!candidate) {
      return null;
    }

    const startedAt = nowIso();
    const result = db()
      .prepare(
        `UPDATE sync_jobs
         SET status = 'running', worker_id = ?, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(workerId, startedAt, startedAt, candidate.id);

    if (result.changes === 0) {
      return null;
    }

    return this.getById(candidate.id);
  },
  recordProgress(id: string, payload: {
    nextMessageId: number | null;
    succeededIncrement?: number;
    skippedIncrement?: number;
    failedIncrement?: number;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }) {
    const succeededIncrement = payload.succeededIncrement ?? 0;
    const skippedIncrement = payload.skippedIncrement ?? 0;
    const failedIncrement = payload.failedIncrement ?? 0;
    const processedIncrement = succeededIncrement + skippedIncrement + failedIncrement;
    const shouldUpdateLastErrorCode = payload.lastErrorCode !== undefined;
    const shouldUpdateLastErrorMessage = payload.lastErrorMessage !== undefined;

    const result = db().prepare(
      `UPDATE sync_jobs
       SET next_message_id = ?,
           processed_messages = processed_messages + ?,
           succeeded_messages = succeeded_messages + ?,
           skipped_messages = skipped_messages + ?,
           failed_messages = failed_messages + ?,
           last_error_code = CASE WHEN ? THEN ? ELSE last_error_code END,
           last_error_message = CASE WHEN ? THEN ? ELSE last_error_message END,
           updated_at = ?
       WHERE id = ?`,
    ).run(
      payload.nextMessageId,
      processedIncrement,
      succeededIncrement,
      skippedIncrement,
      failedIncrement,
      shouldUpdateLastErrorCode ? 1 : 0,
      payload.lastErrorCode ?? null,
      shouldUpdateLastErrorMessage ? 1 : 0,
      payload.lastErrorMessage ?? null,
      nowIso(),
      id,
    );

    if (result.changes === 0) {
      throw new Error("Job not found");
    }
  },
};

export const transferRecordRepository = {
  listForJob(jobId: string) {
    return db()
      .prepare(`SELECT * FROM message_transfer_records WHERE job_id = ? ORDER BY source_message_id ASC, created_at ASC`)
      .all(jobId) as MessageTransferRecordRow[];
  },

  getByJobAndSourceMessageId(jobId: string, sourceMessageId: number) {
    return (
      (db()
        .prepare(`SELECT * FROM message_transfer_records WHERE job_id = ? AND source_message_id = ?`)
        .get(jobId, sourceMessageId) as MessageTransferRecordRow | undefined) ?? null
    );
  },

  upsert(input: {
    jobId: string;
    sourceMessageId: number;
    targetMessageId?: number | null;
    mediaGroupId?: string | null;
    status: MessageTransferRecordRow["status"];
    errorReason?: string | null;
  }) {
    db().prepare(
      `INSERT INTO message_transfer_records (
        id, job_id, source_message_id, target_message_id, media_group_id, status, error_reason, processed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id, source_message_id)
      DO UPDATE SET target_message_id = excluded.target_message_id,
                    media_group_id = excluded.media_group_id,
                    status = excluded.status,
                    error_reason = excluded.error_reason,
                    processed_at = excluded.processed_at`,
    ).run(
      generateId("rec"),
      input.jobId,
      input.sourceMessageId,
      input.targetMessageId ?? null,
      input.mediaGroupId ?? null,
      input.status,
      input.errorReason ?? null,
      nowIso(),
      nowIso(),
    );
  },
};

export const workerRepository = {
  heartbeat(workerId: string, status: WorkerHeartbeatRow["status"], currentJobId?: string | null, details?: unknown) {
    db().prepare(
      `INSERT INTO worker_heartbeats (worker_id, status, current_job_id, heartbeat_at, started_at, details_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(worker_id)
       DO UPDATE SET status = excluded.status, current_job_id = excluded.current_job_id,
                     heartbeat_at = excluded.heartbeat_at, details_json = excluded.details_json`,
    ).run(workerId, status, currentJobId ?? null, nowIso(), nowIso(), details ? JSON.stringify(details) : null);
  },
  getLatest() {
    return db().prepare(`SELECT * FROM worker_heartbeats ORDER BY heartbeat_at DESC LIMIT 1`).get() as
      | WorkerHeartbeatRow
      | undefined;
  },
};

export const settingsRepository = {
  get(key: string) {
    return (db().prepare(`SELECT * FROM app_settings WHERE key = ?`).get(key) as AppSettingRow | undefined) ?? null;
  },
  set(key: string, value: unknown) {
    db().prepare(
      `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    ).run(key, JSON.stringify(value), nowIso());
    return this.get(key);
  },
};

export function withRepositoryError<T>(callback: () => T) {
  try {
    return callback();
  } catch (error) {
    throw new Error(safeErrorMessage(error));
  }
}
