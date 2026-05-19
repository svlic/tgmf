import { Api } from "telegram/tl";
import { createTelegramClient } from "@/lib/telegram/client";
import { accountRepository, dialogRepository, transferRecordRepository, jobRepository } from "@/lib/db/repositories";
import type { DialogCacheRow, SyncJobRow } from "@/lib/types";
import { nowIso, safeErrorMessage, sleep } from "@/lib/utils";

export type StartLoginResult = {
  phoneCodeHash: string;
};

type MessageLike = {
  id?: number;
  groupedId?: bigint | string | null;
  message?: string;
  media?: unknown;
};

const loginSessions = new Map<string, { phoneCodeHash: string; startedAt: number }>();

export async function testAccountConnectivity(accountId: string) {
  const { client } = await createTelegramClient(accountId);
  try {
    await client.connect();
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      accountRepository.setLoginState(accountId, "reauth_required", "Not authorized");
      return { authorized: false };
    }

    accountRepository.setLoginState(accountId, "ready", null);
    return { authorized: true };
  } finally {
    await client.disconnect();
  }
}

export async function beginPhoneLogin(accountId: string, phoneNumberOverride?: string) {
  const { account, client } = await createTelegramClient(accountId);
  try {
    await client.connect();
    const result = await client.sendCode(
      { apiId: client.apiId, apiHash: client.apiHash },
      phoneNumberOverride || account.phone_number,
    );

    loginSessions.set(accountId, {
      phoneCodeHash: result.phoneCodeHash,
      startedAt: Date.now(),
    });
    accountRepository.setLoginState(accountId, "awaiting_code", "Verification code requested");
    return { phoneCodeHash: result.phoneCodeHash } satisfies StartLoginResult;
  } finally {
    await client.disconnect();
  }
}

export async function completePhoneCodeLogin(accountId: string, phoneCode: string, phoneCodeHash: string) {
  const { account, client, session } = await createTelegramClient(accountId);
  const loginState = loginSessions.get(accountId);
  if (!loginState || loginState.phoneCodeHash !== phoneCodeHash) {
    throw new Error("Login session expired. Please restart login.");
  }

  try {
    await client.connect();
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: account.phone_number,
        phoneCode,
        phoneCodeHash,
      }),
    );
    const me = await client.getMe();
    accountRepository.saveSession(accountId, session.save(), "ready", me?.id ? String(me.id) : null);
    loginSessions.delete(accountId);
    return { loginState: "ready" as const };
  } catch (error) {
    if (safeErrorMessage(error).toLowerCase().includes("password")) {
      accountRepository.setLoginState(accountId, "awaiting_password", "2FA password required");
      return { loginState: "awaiting_password" as const };
    }

    throw error;
  } finally {
    await client.disconnect();
  }
}

export async function completePasswordLogin(accountId: string, password: string) {
  const { client, session } = await createTelegramClient(accountId);
  try {
    await client.connect();
    const me = await client.signInWithPassword(
      { apiId: client.apiId, apiHash: client.apiHash },
      {
        password: async () => password,
        onError: async () => false,
      },
    );
    accountRepository.saveSession(accountId, session.save(), "ready", me?.id ? String(me.id) : null);
    return { loginState: "ready" as const };
  } finally {
    await client.disconnect();
  }
}

export async function refreshDialogs(accountId: string) {
  const { client } = await createTelegramClient(accountId);
  try {
    await client.connect();
    const dialogs = await client.getDialogs({ limit: 100 });
    const rows: Omit<DialogCacheRow, "id" | "account_id" | "fetched_at">[] = dialogs.map((dialog) => ({
      peer_id: String(dialog.id),
      title: dialog.title || String(dialog.id),
      username: dialog.entity && "username" in dialog.entity ? String(dialog.entity.username ?? "") || null : null,
      entity_type: dialog.isChannel ? "channel" : dialog.isGroup ? "group" : "user",
      is_public: dialog.entity && "username" in dialog.entity && dialog.entity.username ? 1 : 0,
      raw_json: JSON.stringify(dialog, (_, value) => (typeof value === "bigint" ? value.toString() : value)),
    }));
    dialogRepository.replaceForAccount(accountId, rows);
    accountRepository.setLoginState(accountId, "ready", null);
    return dialogRepository.listForAccount(accountId);
  } finally {
    await client.disconnect();
  }
}

function buildMessageSequence(job: SyncJobRow) {
  const values: number[] = [];
  if (job.job_order === "asc") {
    for (let id = job.start_message_id; id <= job.end_message_id; id += 1) {
      values.push(id);
    }
  } else {
    for (let id = job.end_message_id; id >= job.start_message_id; id -= 1) {
      values.push(id);
    }
  }
  return values;
}

function selectCaptionedMessage(messages: MessageLike[]) {
  return messages.find((message) => typeof message.message === "string" && message.message.trim().length > 0) ?? null;
}

async function forwardMessage(client: Awaited<ReturnType<typeof createTelegramClient>>["client"], job: SyncJobRow, messageId: number) {
  const result = await client.forwardMessages(job.target_channel_ref, {
    fromPeer: job.source_channel_ref,
    messages: [messageId],
  });
  const first = Array.isArray(result) ? result[0] : result;
  return first && typeof first.id === "number" ? first.id : null;
}

async function copyMessage(client: Awaited<ReturnType<typeof createTelegramClient>>["client"], job: SyncJobRow, message: MessageLike) {
  if (!message.id) {
    throw new Error("Message missing id");
  }

  if (message.media) {
    throw new Error("Copy mode for media is not fully implemented in v1");
  }

  const result = await client.sendMessage(job.target_channel_ref, {
    message: message.message || "",
  });

  return result.id ?? null;
}

export async function processJob(job: SyncJobRow, workerId: string, onHeartbeat: () => void) {
  const { client } = await createTelegramClient(job.account_id);
  try {
    await client.connect();
    const messageIds = buildMessageSequence(job);

    for (let index = 0; index < messageIds.length; index += 1) {
      const currentJob = jobRepository.getById(job.id);
      if (!currentJob) {
        throw new Error("Job no longer exists");
      }
      if (currentJob.cancel_requested_at) {
        jobRepository.setStatus(job.id, "cancelled", {
          finished_at: nowIso(),
          worker_id: workerId,
        });
        return;
      }
      if (currentJob.status === "paused") {
        return;
      }

      const messageId = messageIds[index];
      onHeartbeat();

      try {
        const fetched = await client.getMessages(job.source_channel_ref, { ids: [messageId] });
        const sourceMessage = Array.isArray(fetched) ? fetched[0] : fetched;
        if (!sourceMessage?.id) {
          transferRecordRepository.upsert({
            jobId: job.id,
            sourceMessageId: messageId,
            status: "skipped",
            errorReason: "Message not found",
          });
          jobRepository.recordProgress(job.id, {
            nextMessageId: messageIds[index + 1] ?? null,
            skippedIncrement: 1,
          });
          continue;
        }

        if (job.album_strategy === "captioned_only" && sourceMessage.groupedId) {
          const groupMessages = await client.getMessages(job.source_channel_ref, { ids: [messageId] });
          const selected = selectCaptionedMessage((Array.isArray(groupMessages) ? groupMessages : [groupMessages]) as MessageLike[]);
          if (!selected || selected.id !== sourceMessage.id) {
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId: sourceMessage.id,
              mediaGroupId: String(sourceMessage.groupedId),
              status: "skipped",
              errorReason: "Skipped by captioned_only policy",
            });
            jobRepository.recordProgress(job.id, {
              nextMessageId: messageIds[index + 1] ?? null,
              skippedIncrement: 1,
            });
            continue;
          }
        }

        let targetMessageId: number | null;
        if (job.mode === "forward") {
          targetMessageId = await forwardMessage(client, job, sourceMessage.id);
        } else {
          targetMessageId = await copyMessage(client, job, sourceMessage as MessageLike);
        }

        transferRecordRepository.upsert({
          jobId: job.id,
          sourceMessageId: sourceMessage.id,
          targetMessageId,
          mediaGroupId: sourceMessage.groupedId ? String(sourceMessage.groupedId) : null,
          status: "sent",
        });
        jobRepository.recordProgress(job.id, {
          nextMessageId: messageIds[index + 1] ?? null,
          succeededIncrement: 1,
        });
      } catch (error) {
        const errorMessage = safeErrorMessage(error);
        transferRecordRepository.upsert({
          jobId: job.id,
          sourceMessageId: messageId,
          status: "failed",
          errorReason: errorMessage,
        });
        jobRepository.recordProgress(job.id, {
          nextMessageId: messageIds[index + 1] ?? null,
          failedIncrement: 1,
          lastErrorCode: "message_transfer_failed",
          lastErrorMessage: errorMessage,
        });
      }

      await sleep(job.delay_seconds * 1000);
    }

    jobRepository.setStatus(job.id, "completed", {
      worker_id: workerId,
      next_message_id: null,
      finished_at: nowIso(),
    });
  } finally {
    await client.disconnect();
  }
}
