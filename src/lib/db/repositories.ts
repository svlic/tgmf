import { getDb } from "@/lib/db/client";
import {
  DEFAULT_DELAY_SECONDS,
  LOGIN_WINDOW_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  WORKER_HEARTBEAT_STALE_MS,
} from "@/lib/constants";
import { encryptString, decryptString } from "@/lib/crypto";
import type {
  AllowedMediaType,
  DialogCacheRow,
  JobEventRow,
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
  startMessageId?: number;
  endMessageId?: number;
  selection?: SyncJobRow["selection"];
  searchQuery?: string | null;
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

export const accountRepository = {
  list(): TelegramAccountRow[] {
    return getDb().prepare(`SELECT * FROM telegram_accounts ORDER BY updated_at DESC`).all() as TelegramAccountRow[];
  },
  getById(id: string) {
    return (
      (getDb().prepare(`SELECT * FROM telegram_accounts WHERE id = ?`).get(id) as TelegramAccountRow | undefined) ?? null
    );
  },
  recordTelegramSuccess(id: string, configuredIntervalMs: number) {
    getDb().prepare(
      `UPDATE telegram_accounts
       SET adaptive_interval_ms = MAX(?, adaptive_interval_ms - ?), updated_at = ?
       WHERE id = ?`,
    ).run(configuredIntervalMs, configuredIntervalMs, nowIso(), id);
  },
  create(input: AccountInput) {
    const id = generateId("acct");
    const now = nowIso();
    getDb().prepare(
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
    getDb().prepare(
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
  delete(id: string) {
    const result = getDb().prepare(`DELETE FROM telegram_accounts WHERE id = ?`).run(id);
    return result.changes > 0;
  },
  saveSession(id: string, session: string, loginState: TelegramAccountRow["login_state"], telegramUserId?: string | null) {
    getDb().prepare(
      `UPDATE telegram_accounts
       SET session_encrypted = ?, login_state = ?, telegram_user_id = ?, updated_at = ?, last_connected_at = ?
       WHERE id = ?`,
    ).run(encryptString(session), loginState, telegramUserId ?? null, nowIso(), nowIso(), id);
  },
  clearSession(id: string, loginState: TelegramAccountRow["login_state"] = "logged_out") {
    getDb().prepare(
      `UPDATE telegram_accounts
       SET session_encrypted = NULL, login_state = ?, login_hint = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(loginState, nowIso(), id);
  },
  setLoginState(id: string, loginState: TelegramAccountRow["login_state"], loginHint?: string | null) {
    getDb().prepare(`UPDATE telegram_accounts SET login_state = ?, login_hint = ?, updated_at = ? WHERE id = ?`).run(
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
    getDb().prepare(
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
    const row = getDb().prepare(`SELECT * FROM telegram_login_sessions WHERE account_id = ?`).get(accountId) as
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
    getDb().prepare(`DELETE FROM telegram_login_sessions WHERE account_id = ?`).run(accountId);
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
    getDb().prepare(
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
    const row = getDb()
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
    const transaction = getDb().transaction(() => {
      getDb().prepare(`DELETE FROM dialog_cache WHERE account_id = ?`).run(accountId);
      const stmt = getDb().prepare(
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
    return getDb().prepare(`SELECT * FROM dialog_cache WHERE account_id = ? ORDER BY title ASC`).all(accountId) as DialogCacheRow[];
  },
};

export const jobRepository = {
  list() {
    return getDb().prepare(`SELECT * FROM sync_jobs ORDER BY created_at DESC`).all() as SyncJobRow[];
  },
  getById(id: string) {
    return (getDb().prepare(`SELECT * FROM sync_jobs WHERE id = ?`).get(id) as SyncJobRow | undefined) ?? null;
  },
  create(input: JobInput) {
    const selection = input.selection ?? "range";
    const startMessageId = input.startMessageId ?? 0;
    const endMessageId = input.endMessageId ?? 0;
    if (
      (input.startMessageId !== undefined && (!Number.isInteger(input.startMessageId) || input.startMessageId <= 0)) ||
      (input.endMessageId !== undefined && (!Number.isInteger(input.endMessageId) || input.endMessageId <= 0))
    ) {
      throw new Error("Supplied message IDs must be positive integers");
    }
    if (selection === "range" && (!input.startMessageId || !input.endMessageId)) {
      throw new Error("startMessageId and endMessageId are required when selection is range");
    }
    if (
      input.startMessageId !== undefined &&
      input.endMessageId !== undefined &&
      startMessageId > endMessageId
    ) {
      throw new Error("startMessageId must be less than or equal to endMessageId");
    }

    const searchQuery = selection === "search" ? (input.searchQuery?.trim() || null) : null;
    if (selection === "search" && !searchQuery) {
      throw new Error("searchQuery is required when selection is search");
    }

    const totalMessages = selection === "search" ? 0 : endMessageId - startMessageId + 1;
    const nextMessageId = selection === "search" ? null : input.jobOrder === "asc" ? startMessageId : endMessageId;
    const id = generateId("job");
    const now = nowIso();

    getDb().prepare(
      `INSERT INTO sync_jobs (
        id, account_id, source_channel_ref, target_channel_ref, start_message_id, end_message_id,
        selection, search_query, job_order, mode, album_strategy, allowed_media_types, keyword_whitelist,
        keyword_blacklist, regex_whitelist, regex_blacklist, delay_seconds, status, total_messages,
        processed_messages, succeeded_messages, skipped_messages, failed_messages, next_message_id,
        worker_id, last_error_code, last_error_message, cancel_requested_at, started_at, finished_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 0, 0, 0, 0, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    ).run(
      id,
      input.accountId,
      input.sourceChannelRef,
      input.targetChannelRef,
      startMessageId,
      endMessageId,
      selection,
      searchQuery,
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

    const updates = extras ?? {};

    getDb().prepare(
      `UPDATE sync_jobs SET status = ?, worker_id = ?, next_message_id = ?, total_messages = ?,
       processed_messages = ?, succeeded_messages = ?, skipped_messages = ?, failed_messages = ?,
       last_error_code = ?, last_error_message = ?, cancel_requested_at = ?, started_at = ?,
       finished_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      status,
      "worker_id" in updates ? updates.worker_id : existing.worker_id,
      "next_message_id" in updates ? updates.next_message_id : existing.next_message_id,
      "total_messages" in updates ? updates.total_messages : existing.total_messages,
      "processed_messages" in updates ? updates.processed_messages : existing.processed_messages,
      "succeeded_messages" in updates ? updates.succeeded_messages : existing.succeeded_messages,
      "skipped_messages" in updates ? updates.skipped_messages : existing.skipped_messages,
      "failed_messages" in updates ? updates.failed_messages : existing.failed_messages,
      "last_error_code" in updates ? updates.last_error_code : existing.last_error_code,
      "last_error_message" in updates ? updates.last_error_message : existing.last_error_message,
      "cancel_requested_at" in updates ? updates.cancel_requested_at : existing.cancel_requested_at,
      "started_at" in updates ? updates.started_at : existing.started_at,
      "finished_at" in updates ? updates.finished_at : existing.finished_at,
      nowIso(),
      id,
    );
    return this.getById(id);
  },
  setMessagePlan(id: string, payload: { totalMessages: number; nextMessageId: number | null }) {
    getDb().prepare(
      `UPDATE sync_jobs
       SET total_messages = ?, next_message_id = ?, updated_at = ?
       WHERE id = ?`,
    ).run(payload.totalMessages, payload.nextMessageId, nowIso(), id);
    return this.getById(id);
  },
  requestStart(id: string) {
    const result = getDb().prepare(
      `UPDATE sync_jobs
       SET status = 'pending', updated_at = ?
       WHERE id = ? AND status = 'draft'`,
    ).run(nowIso(), id);
    if (result.changes === 0) {
      throw new Error("Only draft jobs can be started");
    }

    return this.getById(id);
  },
  requestPause(id: string) {
    return this.setStatus(id, "paused");
  },
  requestResume(id: string) {
    return this.setStatus(id, "pending", { worker_id: null, last_error_code: null, last_error_message: null });
  },
  requestCancel(id: string) {
    const job = this.getById(id);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === "running") {
      return this.setStatus(id, "running", { cancel_requested_at: nowIso() });
    }

    return this.setStatus(id, "cancelled", {
      finished_at: nowIso(),
      cancel_requested_at: null,
      worker_id: null,
    });
  },
  claimNext(workerId: string) {
    return getDb().transaction(() => {
      const now = nowIso();
      const staleBefore = new Date(Date.now() - WORKER_HEARTBEAT_STALE_MS).toISOString();

      getDb()
        .prepare(
          `UPDATE sync_jobs
           SET status = 'pending',
               worker_id = NULL,
               last_error_code = 'worker_stale_reclaimed',
               last_error_message = 'Worker lease expired; job reclaimed',
               updated_at = ?
           WHERE status = 'running'
             AND (
               worker_id IS NULL
               OR NOT EXISTS (
                 SELECT 1 FROM worker_heartbeats wh
                 WHERE wh.worker_id = sync_jobs.worker_id
                   AND wh.status != 'stale'
                   AND wh.heartbeat_at >= ?
               )
             )`,
        )
        .run(now, staleBefore);

      const candidate = getDb()
        .prepare(
          `SELECT sync_jobs.id
           FROM sync_jobs
           JOIN telegram_accounts ON telegram_accounts.id = sync_jobs.account_id
           WHERE sync_jobs.status = 'pending'
             AND (telegram_accounts.flood_wait_until IS NULL OR telegram_accounts.flood_wait_until <= ?)
             AND NOT EXISTS (
               SELECT 1 FROM sync_jobs active_job
               WHERE active_job.account_id = sync_jobs.account_id
                 AND active_job.status = 'running'
             )
           ORDER BY sync_jobs.created_at ASC
           LIMIT 1`,
        )
        .get(now) as { id: string } | undefined;
      if (!candidate) {
        return null;
      }

      const result = getDb()
        .prepare(
          `UPDATE sync_jobs
           SET status = 'running', worker_id = ?, started_at = COALESCE(started_at, ?), updated_at = ?
           WHERE id = ? AND status = 'pending'`,
        )
        .run(workerId, now, now, candidate.id);

      if (result.changes === 0) {
        return null;
      }

      return this.getById(candidate.id);
    })();
  },
  failIfRunningByWorker(input: { jobId: string; workerId: string; errorMessage: string }) {
    const result = getDb().prepare(
      `UPDATE sync_jobs
       SET status = 'failed', finished_at = ?, last_error_code = 'worker_job_failed',
           last_error_message = ?, updated_at = ?
       WHERE id = ? AND status = 'running' AND worker_id = ?`,
    ).run(nowIso(), input.errorMessage, nowIso(), input.jobId, input.workerId);
    return result.changes > 0;
  },
  deferForFloodWait(input: {
    jobId: string;
    accountId: string;
    workerId: string;
    waitSeconds: number;
    errorMessage: string;
  }) {
    const now = new Date();
    const updatedAt = now.toISOString();
    const floodWaitUntil = new Date(now.getTime() + input.waitSeconds * 1000).toISOString();
    return getDb().transaction(() => {
      const jobUpdate = getDb().prepare(
        `UPDATE sync_jobs
         SET status = 'pending', worker_id = NULL, last_error_code = 'telegram_flood_wait',
             last_error_message = ?, flood_wait_events = flood_wait_events + 1, updated_at = ?
         WHERE id = ? AND account_id = ? AND status = 'running' AND worker_id = ?`,
      ).run(input.errorMessage, updatedAt, input.jobId, input.accountId, input.workerId);
      if (jobUpdate.changes === 0) {
        return false;
      }

      const account = accountRepository.getById(input.accountId);
      if (!account) {
        throw new Error("Account not found");
      }
      const job = this.getById(input.jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      const configuredIntervalMs = job.delay_seconds * 1_000;
      const adaptiveIntervalMs = Math.min(
        Math.max(account.adaptive_interval_ms, configuredIntervalMs) * 2,
        300_000,
      );
      getDb().prepare(
        `UPDATE telegram_accounts
         SET flood_wait_until = CASE
               WHEN flood_wait_until IS NULL OR flood_wait_until < ? THEN ?
               ELSE flood_wait_until
             END,
             adaptive_interval_ms = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(floodWaitUntil, floodWaitUntil, adaptiveIntervalMs, updatedAt, input.accountId);
      getDb().prepare(
        `INSERT INTO job_events (
          id, job_id, event_type, status, details, wait_seconds, adaptive_interval_ms, created_at
        ) VALUES (?, ?, 'flood_wait', 'warn', ?, ?, ?, ?)`,
      ).run(
        generateId("evt"),
        input.jobId,
        input.errorMessage,
        input.waitSeconds,
        adaptiveIntervalMs,
        updatedAt,
      );
      return true;
    })();
  },
  recordSendAttempt(input: {
    jobId: string;
    accountId: string;
    workerId: string;
    attemptedAt: string;
    forward: boolean;
  }) {
    const result = getDb().prepare(
      `UPDATE sync_jobs
       SET send_attempts = send_attempts + 1,
           forward_attempts = forward_attempts + ?,
           last_send_attempt_at = ?,
           updated_at = ?
       WHERE id = ? AND account_id = ? AND status = 'running' AND worker_id = ?`,
    ).run(
      input.forward ? 1 : 0,
      input.attemptedAt,
      input.attemptedAt,
      input.jobId,
      input.accountId,
      input.workerId,
    );

    return result.changes > 0;
  },
  recordProgress(id: string, payload: {
    nextMessageId: number | null;
    succeededIncrement?: number;
    skippedIncrement?: number;
    failedIncrement?: number;
    localSkipsIncrement?: number;
    forwardConfirmedIncrement?: number;
    forwardUnmappedIncrement?: number;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }) {
    const succeededIncrement = payload.succeededIncrement ?? 0;
    const skippedIncrement = payload.skippedIncrement ?? 0;
    const failedIncrement = payload.failedIncrement ?? 0;
    const localSkipsIncrement = payload.localSkipsIncrement ?? 0;
    const forwardConfirmedIncrement = payload.forwardConfirmedIncrement ?? 0;
    const forwardUnmappedIncrement = payload.forwardUnmappedIncrement ?? 0;
    const processedIncrement = succeededIncrement + skippedIncrement + failedIncrement;
    const shouldUpdateLastErrorCode = payload.lastErrorCode !== undefined;
    const shouldUpdateLastErrorMessage = payload.lastErrorMessage !== undefined;

    const result = getDb().prepare(
      `UPDATE sync_jobs
       SET next_message_id = ?,
           processed_messages = processed_messages + ?,
           succeeded_messages = succeeded_messages + ?,
           skipped_messages = skipped_messages + ?,
           failed_messages = failed_messages + ?,
           local_skips = local_skips + ?,
           forward_confirmed = forward_confirmed + ?,
           forward_unmapped = forward_unmapped + ?,
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
      localSkipsIncrement,
      forwardConfirmedIncrement,
      forwardUnmappedIncrement,
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

export const jobEventRepository = {
  countForJob(jobId: string) {
    const row = getDb().prepare(`SELECT COUNT(*) AS count FROM job_events WHERE job_id = ?`).get(jobId) as { count: number };
    return row.count;
  },
  listLatestForJob(jobId: string, limit: number) {
    return getDb()
      .prepare(
        `SELECT * FROM job_events
         WHERE job_id = ? AND event_type = 'flood_wait' AND status = 'warn'
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(jobId, limit) as JobEventRow[];
  },
};

export const transferRecordRepository = {
  countForJob(jobId: string) {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS count FROM message_transfer_records WHERE job_id = ?`)
      .get(jobId) as { count: number };
    return row.count;
  },

  listLatestForJob(jobId: string, limit: number) {
    return getDb()
      .prepare(
        `SELECT * FROM (
          SELECT * FROM message_transfer_records
          WHERE job_id = ?
          ORDER BY source_message_id DESC, created_at DESC
          LIMIT ?
        ) ORDER BY source_message_id ASC, created_at ASC`,
      )
      .all(jobId, limit) as MessageTransferRecordRow[];
  },

  getByJobAndSourceMessageId(jobId: string, sourceMessageId: number) {
    return (
      (getDb()
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
    getDb().prepare(
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
    getDb().prepare(
      `INSERT INTO worker_heartbeats (worker_id, status, current_job_id, heartbeat_at, started_at, details_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(worker_id)
       DO UPDATE SET status = excluded.status, current_job_id = excluded.current_job_id,
                     heartbeat_at = excluded.heartbeat_at, details_json = excluded.details_json`,
    ).run(workerId, status, currentJobId ?? null, nowIso(), nowIso(), details ? JSON.stringify(details) : null);
  },
  getLatest() {
    return getDb().prepare(`SELECT * FROM worker_heartbeats ORDER BY heartbeat_at DESC LIMIT 1`).get() as
      | WorkerHeartbeatRow
      | undefined;
  },
};

export function withRepositoryError<T>(callback: () => T) {
  try {
    return callback();
  } catch (error) {
    throw new Error(safeErrorMessage(error));
  }
}
