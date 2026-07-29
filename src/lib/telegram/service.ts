import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Api } from "telegram/tl";
import { CustomFile } from "telegram/client/uploads";
import { createTelegramClient } from "@/lib/telegram/client";
import {
  accountRepository,
  dialogRepository,
  telegramLoginSessionRepository,
  transferRecordRepository,
  jobRepository,
  workerRepository,
} from "@/lib/db/repositories";
import { normalizeAllowedMediaType } from "@/lib/media-types";
import type { AllowedMediaType, DialogCacheRow, SyncJobRow } from "@/lib/types";
import { nowIso, safeErrorMessage, sleep } from "@/lib/utils";
import {
  filterMessagesByTextFilter,
  parseMessageTextFilterFromJob,
} from "@/lib/telegram/message-text-filter";
import { partitionCaptionedAlbumMessages } from "@/lib/telegram/album-policy";
import { collectSearchMessageIds } from "@/lib/telegram/search-message-ids";
import {
  classifyCopyDelivery,
  missingTargetMessageErrorReason,
  partitionForwardDeliveries,
} from "@/lib/telegram/transfer-outcome";
import { getTelegramFloodWaitSeconds } from "@/lib/telegram/flood-wait";
import { AccountSendLimiter } from "@/lib/telegram/send-limiter";

export type StartLoginResult = {
  loginState: "awaiting_code";
};

type MessageLike = {
  id?: number;
  groupedId?: unknown | null;
  message?: string;
  media?: Api.TypeMessageMedia;
  entities?: Api.TypeMessageEntity[];
  noforwards?: boolean;
};

type ForwardedMessage = {
  sourceMessage: MessageLike & { id: number };
  targetMessageId: number | null;
};

type ForwardResult = {
  sent: ForwardedMessage[];
  skipped: MessageLike[];
  responseCount: number;
};

type DocumentLike = {
  mimeType?: string;
  attributes?: Api.TypeDocumentAttribute[];
};

type CopiedMediaUpload = {
  file: CustomFile;
  attributes?: Api.TypeDocumentAttribute[];
  supportsStreaming: boolean;
};

type CopyPhaseDetails = {
  phase: string;
  sourceMessageId: number;
  mediaBytes?: number;
  downloadedBytes?: string;
  totalBytes?: string;
  progress?: number;
};

type CopyPhaseCallback = (details: CopyPhaseDetails) => void;
type TelegramAttemptKind = "read" | "send" | "forward";
type TelegramAttempt = <T>(kind: TelegramAttemptKind, attempt: () => Promise<T>) => Promise<T>;

export function shouldRecordTelegramSuccess(kind: TelegramAttemptKind): boolean {
  return kind !== "read";
}

const accountSendLimiter = new AccountSendLimiter(Date.now, sleep);

export function resolveSyncJobFinalStatus(failedMessages: number): "completed" | "failed" {
  return failedMessages > 0 ? "failed" : "completed";
}

const TERMINAL_TRANSFER_STATUSES = new Set(["sent", "warn", "skipped"]);

export function filterCopyMessagesPendingTransfer<T extends { id: number }>(
  messages: readonly T[],
  getTransferRecord: (sourceMessageId: number) => { status: string } | null,
): T[] {
  return messages.filter((message) => {
    const existing = getTransferRecord(message.id);
    return !existing || !TERMINAL_TRANSFER_STATUSES.has(existing.status);
  });
}

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
  const { account, client, session } = await createTelegramClient(accountId);
  const phoneNumber = phoneNumberOverride || account.phone_number;

  try {
    await client.connect();
    const result = await client.sendCode({ apiId: client.apiId, apiHash: client.apiHash }, phoneNumber);

    telegramLoginSessionRepository.save({
      accountId,
      phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      sessionString: session.save(),
    });
    accountRepository.setLoginState(accountId, "awaiting_code", "Verification code requested");
    return { loginState: "awaiting_code" } satisfies StartLoginResult;
  } finally {
    await client.disconnect();
  }
}

export async function completePhoneCodeLogin(accountId: string, phoneCode: string) {
  const loginState = telegramLoginSessionRepository.getActive(accountId);
  if (!loginState) {
    throw new Error("Login session expired. Please restart login.");
  }

  const { client, session } = await createTelegramClient(accountId, loginState.sessionString);

  try {
    await client.connect();
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: loginState.phoneNumber,
        phoneCode,
        phoneCodeHash: loginState.phoneCodeHash,
      }),
    );
    const me = await client.getMe();
    accountRepository.saveSession(accountId, session.save(), "ready", me?.id ? String(me.id) : null);
    telegramLoginSessionRepository.delete(accountId);
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
  const loginState = telegramLoginSessionRepository.getActive(accountId);
  if (!loginState) {
    throw new Error("Login session expired. Please restart login.");
  }

  const { client, session } = await createTelegramClient(accountId, loginState.sessionString);
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
    telegramLoginSessionRepository.delete(accountId);
    return { loginState: "ready" as const };
  } finally {
    await client.disconnect();
  }
}

function getDialogUsername(entity: unknown) {
  if (entity && typeof entity === "object" && "username" in entity) {
    const username = entity.username;
    return typeof username === "string" && username.length > 0 ? username : null;
  }

  return null;
}

function getDialogEntitySnapshot(entity: unknown) {
  if (!entity || typeof entity !== "object") {
    return null;
  }

  return {
    id: "id" in entity ? String(entity.id) : null,
    username: getDialogUsername(entity),
    firstName: "firstName" in entity && typeof entity.firstName === "string" ? entity.firstName : null,
    lastName: "lastName" in entity && typeof entity.lastName === "string" ? entity.lastName : null,
    title: "title" in entity && typeof entity.title === "string" ? entity.title : null,
    className: entity.constructor.name,
  };
}

function buildDialogSnapshot(dialog: Awaited<ReturnType<Awaited<ReturnType<typeof createTelegramClient>>["client"]["getDialogs"]>>[number]) {
  return {
    id: String(dialog.id),
    title: dialog.title || String(dialog.id),
    isChannel: dialog.isChannel,
    isGroup: dialog.isGroup,
    isUser: dialog.isUser,
    unreadCount: dialog.unreadCount,
    entity: getDialogEntitySnapshot(dialog.entity),
  };
}

export async function refreshDialogs(accountId: string) {
  const { client } = await createTelegramClient(accountId);
  try {
    await client.connect();
    const dialogs = await client.getDialogs({ limit: 100 });
    const rows: Omit<DialogCacheRow, "id" | "account_id" | "fetched_at">[] = dialogs.map((dialog) => {
      const username = getDialogUsername(dialog.entity);
      return {
        peer_id: String(dialog.id),
        title: dialog.title || String(dialog.id),
        username,
        entity_type: dialog.isChannel ? "channel" : dialog.isGroup ? "group" : "user",
        is_public: username ? 1 : 0,
        raw_json: JSON.stringify(buildDialogSnapshot(dialog)),
      };
    });
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

function getGroupedIdKey(message: MessageLike) {
  return message.groupedId ? String(message.groupedId) : null;
}

function sortMessagesById(messages: MessageLike[]) {
  return messages.sort((left, right) => (left.id ?? 0) - (right.id ?? 0));
}

function getDocumentFromMessage(message: MessageLike) {
  return message.media instanceof Api.MessageMediaDocument && message.media.document instanceof Api.Document ? message.media.document : null;
}

function isPhotoMessage(message: MessageLike) {
  return message.media instanceof Api.MessageMediaPhoto;
}

function parseAllowedMediaTypes(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return new Set<AllowedMediaType>();
    }

    return new Set(parsed.map(normalizeAllowedMediaType).filter((mediaType): mediaType is AllowedMediaType => mediaType !== null));
  } catch {
    return new Set<AllowedMediaType>();
  }
}

const COPY_PROGRESS_REPORT_INTERVAL_MS = 2_000;
const COPY_PROGRESS_REPORT_PERCENT_STEP = 5;
const TELEGRAM_TRANSFER_LOG_PREFIX = "[telegram-transfer]";

function getMessageMediaType(message: MessageLike): AllowedMediaType {
  if (!message.media) {
    return typeof message.message === "string" && message.message.trim().length > 0 ? "text" : "other";
  }
  if (isPhotoMessage(message)) {
    return "photo";
  }

  const document = getDocumentFromMessage(message);
  if (!document) {
    return "other";
  }

  const attributes = document.attributes ?? [];
  if (attributes.some((attribute) => attribute instanceof Api.DocumentAttributeSticker)) {
    return "other";
  }

  const videoAttribute = attributes.find(
    (attribute): attribute is Api.DocumentAttributeVideo => attribute instanceof Api.DocumentAttributeVideo,
  );
  if (videoAttribute) {
    return videoAttribute.roundMessage ? "other" : "video";
  }

  const audioAttribute = attributes.find(
    (attribute): attribute is Api.DocumentAttributeAudio => attribute instanceof Api.DocumentAttributeAudio,
  );
  if (audioAttribute) {
    return audioAttribute.voice ? "voice" : "audio";
  }

  if (attributes.some((attribute) => attribute instanceof Api.DocumentAttributeAnimated)) {
    return "other";
  }

  if (document.mimeType?.startsWith("video/")) {
    return "video";
  }
  if (document.mimeType?.startsWith("audio/")) {
    return "audio";
  }

  return "document";
}

function isMessageAllowedByMediaTypes(message: MessageLike, allowedMediaTypes: Set<AllowedMediaType>) {
  if (allowedMediaTypes.size === 0) {
    return true;
  }

  return allowedMediaTypes.has(getMessageMediaType(message));
}

function filterMessagesByAllowedMediaTypes(messages: MessageLike[], allowedMediaTypes: Set<AllowedMediaType>) {
  if (allowedMediaTypes.size === 0) {
    return { allowed: messages, skipped: [] };
  }

  const allowed: MessageLike[] = [];
  const skipped: MessageLike[] = [];

  for (const message of messages) {
    if (isMessageAllowedByMediaTypes(message, allowedMediaTypes)) {
      allowed.push(message);
    } else {
      skipped.push(message);
    }
  }

  return { allowed, skipped };
}

function getDocumentFilename(document: DocumentLike | null) {
  const filenameAttribute = document?.attributes?.find(
    (attribute): attribute is Api.DocumentAttributeFilename => attribute instanceof Api.DocumentAttributeFilename,
  );

  return filenameAttribute?.fileName ?? null;
}

function filenameHasExtension(filename: string) {
  return /\.[^./\\]+$/.test(filename);
}

function sanitizeTelegramFilename(filename: string) {
  const basename = path.basename(filename).replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim();
  return basename.length > 0 && basename !== "." && basename !== ".." ? basename : null;
}

function assertPathInsideDirectory(filePath: string, directory: string) {
  const resolvedDirectory = path.resolve(directory);
  const resolvedFilePath = path.resolve(filePath);
  if (!resolvedFilePath.startsWith(`${resolvedDirectory}${path.sep}`)) {
    throw new Error("Copy media temp file path escaped its temporary directory");
  }
}

function getExtensionFromMimeType(mimeType: string | undefined) {
  if (!mimeType) {
    return null;
  }

  const [type, subtype] = mimeType.split("/");
  if (!type || !subtype) {
    return null;
  }

  if (type === "video") {
    return subtype === "quicktime" ? "mov" : subtype;
  }
  if (type === "image") {
    return subtype === "jpeg" ? "jpg" : subtype;
  }
  if (type === "audio") {
    return subtype;
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return null;
}

function buildCopiedMediaFilename(message: MessageLike) {
  if (isPhotoMessage(message)) {
    return `telegram-photo-${message.id}.jpg`;
  }

  const document = getDocumentFromMessage(message);
  const existingName = getDocumentFilename(document);
  const sanitizedName = existingName ? sanitizeTelegramFilename(existingName) : null;
  if (sanitizedName) {
    if (filenameHasExtension(sanitizedName)) {
      return sanitizedName;
    }

    const extension = getExtensionFromMimeType(document?.mimeType);
    return extension ? `${sanitizedName}.${extension}` : sanitizedName;
  }

  const extension = getExtensionFromMimeType(document?.mimeType);
  return extension ? `telegram-media-${message.id}.${extension}` : `telegram-media-${message.id}`;
}

function getCopiedDocumentAttributes(message: MessageLike) {
  if (isPhotoMessage(message)) {
    return undefined;
  }

  return getDocumentFromMessage(message)?.attributes;
}

function getVideoAttribute(message: MessageLike) {
  return getDocumentFromMessage(message)?.attributes?.find(
    (attribute): attribute is Api.DocumentAttributeVideo => attribute instanceof Api.DocumentAttributeVideo,
  );
}

function supportsVideoStreaming(message: MessageLike) {
  const videoAttribute = getVideoAttribute(message);
  if (videoAttribute) {
    return videoAttribute.supportsStreaming ?? false;
  }

  const document = getDocumentFromMessage(message);
  return document?.mimeType?.startsWith("video/") ?? false;
}

function buildCopiedMediaUpload(message: MessageLike, filePath: string, fileSize: number, filename: string): CopiedMediaUpload {
  return {
    file: new CustomFile(filename, fileSize, filePath),
    attributes: getCopiedDocumentAttributes(message),
    supportsStreaming: supportsVideoStreaming(message),
  };
}

function reportCopyPhase(onPhase: CopyPhaseCallback | undefined, details: CopyPhaseDetails) {
  onPhase?.(details);
  console.info(TELEGRAM_TRANSFER_LOG_PREFIX, "Copy media phase", details);
}

function createCopyProgressReporter(onPhase: CopyPhaseCallback | undefined, sourceMessageId: number, mediaBytes?: number) {
  let lastReportAt = 0;
  let lastProgressBucket = -1;

  return (details: Omit<CopyPhaseDetails, "sourceMessageId" | "mediaBytes">) => {
    const now = Date.now();
    const progressBucket = typeof details.progress === "number" ? Math.floor(details.progress / COPY_PROGRESS_REPORT_PERCENT_STEP) : -1;
    const shouldReportByProgress = progressBucket >= 0 && progressBucket !== lastProgressBucket;
    const shouldReportByTime = now - lastReportAt >= COPY_PROGRESS_REPORT_INTERVAL_MS;

    if (!shouldReportByProgress && !shouldReportByTime) {
      return;
    }

    lastReportAt = now;
    lastProgressBucket = progressBucket;
    reportCopyPhase(onPhase, { ...details, sourceMessageId, mediaBytes });
  };
}

async function createCopyTempDirectory(jobId: string, messageId: number) {
  return mkdtemp(path.join(tmpdir(), `tgmf-${jobId}-${messageId}-`));
}

function isMessageInJobRange(message: MessageLike, job: SyncJobRow) {
  return typeof message.id === "number" && message.id >= job.start_message_id && message.id <= job.end_message_id;
}

function isForwardableMessage(message: MessageLike): message is MessageLike & { id: number } {
  return message instanceof Api.Message && typeof message.id === "number";
}

async function fetchAlbumMessages(
  client: Awaited<ReturnType<typeof createTelegramClient>>["client"],
  job: SyncJobRow,
  sourceMessage: MessageLike,
  telegramAttempt: TelegramAttempt,
) {
  const groupedId = getGroupedIdKey(sourceMessage);
  const sourceMessageId = sourceMessage.id;
  if (!groupedId || !sourceMessageId) {
    return [sourceMessage];
  }

  const nearby = await telegramAttempt("read", () =>
    client.getMessages(job.source_channel_ref, {
      minId: Math.max(0, sourceMessageId - 10),
      maxId: sourceMessageId + 10,
      limit: 25,
    }),
  );
  const messages = Array.from(nearby as Iterable<MessageLike>).filter(
    (message) => getGroupedIdKey(message) === groupedId && isMessageInJobRange(message, job),
  );

  return messages.length > 0 ? sortMessagesById(messages) : [sourceMessage];
}

export function mapForwardResponse(
  forwardableMessages: ReadonlyArray<MessageLike & { id: number }>,
  sentMessages: ReadonlyArray<ReadonlyArray<{ readonly id?: number }> | { readonly id?: number }>,
): Pick<ForwardResult, "sent" | "responseCount"> {
  const normalizedMessages = sentMessages.flatMap((message) => (Array.isArray(message) ? message : [message]));
  return {
    sent: forwardableMessages.map((sourceMessage, index) => {
      const targetMessageId = normalizedMessages[index]?.id;
      return {
        sourceMessage,
        targetMessageId: typeof targetMessageId === "number" ? targetMessageId : null,
      };
    }),
    responseCount: normalizedMessages.length,
  };
}

async function forwardMessages(
  client: Awaited<ReturnType<typeof createTelegramClient>>["client"],
  job: SyncJobRow,
  sourceMessages: MessageLike[],
  telegramAttempt: TelegramAttempt,
): Promise<ForwardResult> {
  const forwardableMessages = sourceMessages.filter(isForwardableMessage);
  const skipped = sourceMessages.filter((message) => !isForwardableMessage(message));
  const sourceMessageIds = forwardableMessages.map((message) => message.id);

  if (sourceMessageIds.length === 0) {
    return { sent: [], skipped, responseCount: 0 };
  }

  const sentMessages = await telegramAttempt(
    "forward",
    () =>
      client.forwardMessages(job.target_channel_ref, {
        fromPeer: job.source_channel_ref,
        messages: sourceMessageIds,
      }),
  );

  return {
    ...mapForwardResponse(forwardableMessages, sentMessages),
    skipped,
  };
}

async function copyMessage(
  client: Awaited<ReturnType<typeof createTelegramClient>>["client"],
  job: SyncJobRow,
  message: MessageLike,
  telegramAttempt: TelegramAttempt,
  onPhase?: CopyPhaseCallback,
) {
  if (!message.id) {
    throw new Error("Message missing id");
  }
  if (message.noforwards) {
    throw new Error("Message is protected by Telegram no-forward restrictions");
  }

  const sourceMessageId = message.id;
  const caption = message.message ?? "";
  if (!message.media) {
    reportCopyPhase(onPhase, { phase: "send_text", sourceMessageId });
    const result = await telegramAttempt("send", () =>
      client.sendMessage(job.target_channel_ref, {
        message: caption,
        formattingEntities: message.entities,
      }),
    );
    reportCopyPhase(onPhase, { phase: "sent_text", sourceMessageId });
    return result.id ?? null;
  }
  if (!(message instanceof Api.Message)) {
    throw new Error("Copy media requires a full Telegram message");
  }

  const tempDirectory = await createCopyTempDirectory(job.id, sourceMessageId);
  const mediaFilename = buildCopiedMediaFilename(message);
  const tempFilePath = path.join(tempDirectory, mediaFilename);
  assertPathInsideDirectory(tempFilePath, tempDirectory);

  try {
    const reportDownloadProgress = createCopyProgressReporter(onPhase, sourceMessageId);
    reportCopyPhase(onPhase, { phase: "download_start", sourceMessageId });
    const downloaded = await telegramAttempt("read", () =>
      client.downloadMedia(message, {
        outputFile: tempFilePath,
        progressCallback: (downloadedBytes, totalBytes) => {
          reportDownloadProgress({
            phase: "download_progress",
            downloadedBytes: downloadedBytes.toString(),
            totalBytes: totalBytes.toString(),
          });
        },
      }),
    );
    if (typeof downloaded !== "string" || path.resolve(downloaded) !== path.resolve(tempFilePath)) {
      throw new Error(`Failed to download media from message ${sourceMessageId}`);
    }

    const mediaSize = (await stat(tempFilePath)).size;
    if (mediaSize === 0) {
      throw new Error(`Failed to download media from message ${sourceMessageId}`);
    }

    reportCopyPhase(onPhase, { phase: "download_complete", sourceMessageId, mediaBytes: mediaSize });
    const upload = buildCopiedMediaUpload(message, tempFilePath, mediaSize, mediaFilename);
    const reportUploadProgress = createCopyProgressReporter(onPhase, sourceMessageId, mediaSize);

    reportCopyPhase(onPhase, { phase: "upload_start", sourceMessageId, mediaBytes: mediaSize });
    const result = await telegramAttempt("send", () =>
      client.sendFile(job.target_channel_ref, {
        file: upload.file,
        caption,
        formattingEntities: message.entities,
        attributes: upload.attributes,
        supportsStreaming: upload.supportsStreaming,
        workers: 1,
        progressCallback: (progress) => {
          reportUploadProgress({ phase: "upload_progress", progress });
        },
      }),
    );
    reportCopyPhase(onPhase, { phase: "sent_media", sourceMessageId, mediaBytes: mediaSize });

    return result.id ?? null;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function processJob(job: SyncJobRow, workerId: string, onHeartbeat: () => void) {
  const { client } = await createTelegramClient(job.account_id);
  const configuredIntervalMs = job.delay_seconds * 1_000;
  const telegramAttempt: TelegramAttempt = (kind, attempt) => {
    const account = accountRepository.getById(job.account_id);
    const minimumIntervalMs = Math.max(configuredIntervalMs, account?.adaptive_interval_ms ?? 0);
    return accountSendLimiter.run(job.account_id, minimumIntervalMs, async () => {
      if (kind !== "read") {
        const ownsJob = jobRepository.recordSendAttempt({
          jobId: job.id,
          accountId: job.account_id,
          workerId,
          attemptedAt: nowIso(),
          forward: kind === "forward",
        });
        if (!ownsJob) {
          throw new Error("Worker no longer owns this job");
        }
      }
      const result = await attempt();
      if (shouldRecordTelegramSuccess(kind)) {
        accountRepository.recordTelegramSuccess(job.account_id, configuredIntervalMs);
      }
      return result;
    });
  };

  try {
    await client.connect();
    const messageIds =
      job.selection === "search"
        ? await (async () => {
            const searchQuery = job.search_query?.trim() ?? "";
            if (!searchQuery) {
              throw new Error("search_query is required when selection is search");
            }

            const collectedIds = await collectSearchMessageIds({
              searchQuery,
              startMessageId: job.start_message_id,
              endMessageId: job.end_message_id,
              jobOrder: job.job_order,
              fetchMessages: async (params) => {
                const fetched = await telegramAttempt("read", () =>
                  client.getMessages(job.source_channel_ref, {
                    search: params.search,
                    minId: params.minId,
                    maxId: params.maxId,
                    reverse: params.reverse,
                  }),
                );
                return Array.from(fetched as Iterable<MessageLike | null | undefined>).flatMap((message) =>
                  message ? [message] : [],
                );
              },
            });

            jobRepository.setMessagePlan(job.id, {
              totalMessages: collectedIds.length,
              nextMessageId: collectedIds[0] ?? null,
            });
            return collectedIds;
          })()
        : buildMessageSequence(job);
    const mediaFilter = parseAllowedMediaTypes(job.allowed_media_types);
    const textFilter = parseMessageTextFilterFromJob(job);
    const groupedMessagesCache = new Map<string, MessageLike[]>();
    const captionedSelectionCache = new Map<string, ReturnType<typeof partitionCaptionedAlbumMessages<MessageLike>>>();
    const messageCache = new Map<number, MessageLike | null>();
    const messagePrefetchWindow = 50;
    const alreadyTransferredFlushThreshold = 50;
    let pendingAlreadyTransferredCount = 0;

    const flushAlreadyTransferredProgress = (nextMessageId: number | null) => {
      if (pendingAlreadyTransferredCount === 0) {
        return;
      }

      jobRepository.recordProgress(job.id, {
        nextMessageId,
      });
      pendingAlreadyTransferredCount = 0;
    };

    const populateMessageCache = (requestedIds: readonly number[], fetchedMessages: readonly MessageLike[]) => {
      const fetchedById = new Map<number, MessageLike>();
      fetchedMessages.forEach((message) => {
        if (typeof message.id === "number") {
          fetchedById.set(message.id, message);
        }
      });
      requestedIds.forEach((requestedId) => {
        messageCache.set(requestedId, fetchedById.get(requestedId) ?? null);
      });
    };

    const prefetchMessages = async (startIndex: number) => {
      const requestedIds = messageIds.slice(startIndex, startIndex + messagePrefetchWindow);
      const uncachedIds = requestedIds.filter((candidateId) => !messageCache.has(candidateId));
      if (uncachedIds.length === 0) {
        return;
      }

      const fetched = await telegramAttempt("read", () =>
        client.getMessages(job.source_channel_ref, { ids: uncachedIds }),
      );
      const fetchedMessages = Array.isArray(fetched)
        ? fetched.flatMap((message) => (message ? [message as MessageLike] : []))
        : fetched
          ? [fetched as MessageLike]
          : [];
      populateMessageCache(uncachedIds, fetchedMessages);
    };

    for (let index = 0; index < messageIds.length; index += 1) {
      const nextMessageId = messageIds[index + 1] ?? null;
      const currentJob = jobRepository.getById(job.id);
      if (!currentJob) {
        flushAlreadyTransferredProgress(nextMessageId);
        throw new Error("Job no longer exists");
      }
      if (currentJob.cancel_requested_at) {
        flushAlreadyTransferredProgress(nextMessageId);
        jobRepository.setStatus(job.id, "cancelled", {
          finished_at: nowIso(),
          worker_id: workerId,
        });
        return;
      }
      if (currentJob.status === "paused") {
        flushAlreadyTransferredProgress(nextMessageId);
        return;
      }

      const messageId = messageIds[index];
      onHeartbeat();

      try {
        const alreadyTransferred = transferRecordRepository.getByJobAndSourceMessageId(job.id, messageId);
        if (
          alreadyTransferred?.status === "sent" ||
          alreadyTransferred?.status === "warn" ||
          alreadyTransferred?.status === "skipped"
        ) {
          pendingAlreadyTransferredCount += 1;
          if (pendingAlreadyTransferredCount >= alreadyTransferredFlushThreshold) {
            flushAlreadyTransferredProgress(nextMessageId);
          }
          continue;
        }

        flushAlreadyTransferredProgress(nextMessageId);

        await prefetchMessages(index);
        const sourceMessage = messageCache.get(messageId) ?? null;
        if (!sourceMessage?.id) {
          transferRecordRepository.upsert({
            jobId: job.id,
            sourceMessageId: messageId,
            status: "skipped",
            errorReason: "Message not found",
          });
          jobRepository.recordProgress(job.id, {
            nextMessageId,
            skippedIncrement: 1,
            localSkipsIncrement: 1,
          });
          continue;
        }

        const groupedIdKey = getGroupedIdKey(sourceMessage);
        let messagesToForward = groupedIdKey
          ? (groupedMessagesCache.get(groupedIdKey) ?? [sourceMessage as MessageLike])
          : [sourceMessage as MessageLike];
        if (groupedIdKey && !groupedMessagesCache.has(groupedIdKey)) {
          messagesToForward = await fetchAlbumMessages(client, job, sourceMessage as MessageLike, telegramAttempt);
          groupedMessagesCache.set(groupedIdKey, messagesToForward);
          messagesToForward.forEach((message) => {
            if (typeof message.id === "number") {
              messageCache.set(message.id, message);
            }
          });
        }

        let skippedByAlbumPolicy = 0;
        if (job.album_strategy === "captioned_only" && groupedIdKey) {
          const cachedPartition = captionedSelectionCache.get(groupedIdKey);
          const partition = cachedPartition ?? partitionCaptionedAlbumMessages(messagesToForward);
          if (!cachedPartition) {
            captionedSelectionCache.set(groupedIdKey, partition);
          }
          if (!partition.selected) {
            partition.skipped.forEach((message) => {
              if (!message.id) {
                return;
              }
              skippedByAlbumPolicy += 1;
              transferRecordRepository.upsert({
                jobId: job.id,
                sourceMessageId: message.id,
                mediaGroupId: groupedIdKey,
                status: "skipped",
                errorReason: "Skipped by captioned_only policy",
              });
            });
            jobRepository.recordProgress(job.id, {
              nextMessageId,
              skippedIncrement: skippedByAlbumPolicy,
              localSkipsIncrement: skippedByAlbumPolicy,
            });
            continue;
          }
          if (partition.selected.id !== sourceMessage.id) {
            continue;
          }

          partition.skipped.forEach((message) => {
            if (!message.id) {
              return;
            }
            skippedByAlbumPolicy += 1;
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId: message.id,
              mediaGroupId: groupedIdKey,
              status: "skipped",
              errorReason: "Skipped by captioned_only policy",
            });
          });
          messagesToForward = [partition.selected];
        }

        const mediaFilteredMessages = filterMessagesByAllowedMediaTypes(messagesToForward, mediaFilter);
        const textFilteredMessages = filterMessagesByTextFilter(mediaFilteredMessages.allowed, textFilter);
        const filterSkippedMessages = [
          ...mediaFilteredMessages.skipped.map((message) => ({ message, reason: "Skipped by media type filter" })),
          ...textFilteredMessages.skipped.map((message) => ({ message, reason: "Skipped by text filter" })),
        ];
        const skippedByFilters = filterSkippedMessages.length;
        messagesToForward = textFilteredMessages.allowed;

        filterSkippedMessages.forEach(({ message, reason }) => {
          if (!message.id) {
            return;
          }
          transferRecordRepository.upsert({
            jobId: job.id,
            sourceMessageId: message.id,
            mediaGroupId: getGroupedIdKey(message),
            status: "skipped",
            errorReason: reason,
          });
        });

        if (job.mode === "copy") {
          if (filterSkippedMessages.some(({ message }) => message.id === messageId)) {
            jobRepository.recordProgress(job.id, {
              nextMessageId,
              skippedIncrement: skippedByAlbumPolicy + (messagesToForward.length === 0 ? skippedByFilters : 0),
              localSkipsIncrement: skippedByAlbumPolicy + (messagesToForward.length === 0 ? skippedByFilters : 0),
            });
            continue;
          }
        } else {
          if (messagesToForward.length === 0) {
            jobRepository.recordProgress(job.id, {
              nextMessageId,
              skippedIncrement: skippedByAlbumPolicy + skippedByFilters,
              localSkipsIncrement: skippedByAlbumPolicy + skippedByFilters,
            });
            continue;
          }
        }

        if (job.mode === "forward") {
          const forwardResult = await forwardMessages(client, job, messagesToForward, telegramAttempt);
          const deliveryRows = forwardResult.sent.map(({ sourceMessage, targetMessageId }) => ({
            sourceMessageId: sourceMessage.id,
            targetMessageId,
          }));
          const { delivered, undelivered } = partitionForwardDeliveries(deliveryRows);
          delivered.forEach(({ sourceMessageId, targetMessageId }) => {
            const sourceMessage = forwardResult.sent.find((row) => row.sourceMessage.id === sourceMessageId)?.sourceMessage;
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId,
              targetMessageId,
              mediaGroupId: sourceMessage ? getGroupedIdKey(sourceMessage) : null,
              status: "sent",
            });
          });
          undelivered.forEach(({ sourceMessageId }) => {
            const sourceMessage = forwardResult.sent.find((row) => row.sourceMessage.id === sourceMessageId)?.sourceMessage;
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId,
              mediaGroupId: sourceMessage ? getGroupedIdKey(sourceMessage) : null,
              status: "warn",
              errorReason: missingTargetMessageErrorReason(),
            });
          });
          forwardResult.skipped.forEach((message) => {
            if (!message.id) {
              return;
            }
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId: message.id,
              mediaGroupId: getGroupedIdKey(message),
              status: "skipped",
              errorReason: "Skipped because message is not forwardable",
            });
          });
          jobRepository.recordProgress(job.id, {
            nextMessageId,
            succeededIncrement: delivered.length,
            skippedIncrement: skippedByAlbumPolicy + skippedByFilters + forwardResult.skipped.length + undelivered.length,
            localSkipsIncrement: skippedByAlbumPolicy + skippedByFilters + forwardResult.skipped.length,
            forwardConfirmedIncrement: delivered.length,
            forwardUnmappedIncrement: undelivered.length,
          });
          if (undelivered.length > 0) {
            console.warn("Telegram forward response could not be fully mapped", {
              jobId: job.id,
              sourceCount: deliveryRows.length,
              responseCount: forwardResult.responseCount,
              mappedCount: delivered.length,
              unmappedCount: undelivered.length,
              sourceMessageIdSample: deliveryRows.slice(0, 5).map(({ sourceMessageId }) => sourceMessageId),
              sourceMessageIdsOmitted: Math.max(0, deliveryRows.length - 5),
              mappedTargetMessageIdSample: delivered.slice(0, 5).map(({ targetMessageId }) => targetMessageId),
              mappedTargetMessageIdsOmitted: Math.max(0, delivered.length - 5),
            });
          }
        } else {
          const copyableMessages = messagesToForward.filter(
            (message): message is MessageLike & { id: number } => typeof message.id === "number",
          );
          const messageToCopy = copyableMessages.find((message) => message.id === messageId);
          if (!messageToCopy) {
            jobRepository.recordProgress(job.id, {
              nextMessageId,
            });
            continue;
          }

          const pendingCopyMessages = filterCopyMessagesPendingTransfer(copyableMessages, (sourceMessageId) =>
            transferRecordRepository.getByJobAndSourceMessageId(job.id, sourceMessageId),
          );

          let copiedCount = 0;
          let copyFailureCount = 0;
          let copySkippedCount = 0;
          let lastCopyError: string | null = null;
          for (const copyableMessage of pendingCopyMessages) {
            try {
              const targetMessageId = await copyMessage(client, job, copyableMessage, telegramAttempt, (details) => {
                onHeartbeat();
                workerRepository.heartbeat(workerId, "running", job.id, {
                  ...details,
                  updatedAt: nowIso(),
                  pid: process.pid,
                });
              });
              const copyOutcome = classifyCopyDelivery(targetMessageId);
              if (copyOutcome.outcome === "sent") {
                copiedCount += 1;
                transferRecordRepository.upsert({
                  jobId: job.id,
                  sourceMessageId: copyableMessage.id,
                  targetMessageId: copyOutcome.targetMessageId,
                  mediaGroupId: getGroupedIdKey(copyableMessage),
                  status: "sent",
                });
              } else {
                copySkippedCount += 1;
                transferRecordRepository.upsert({
                  jobId: job.id,
                  sourceMessageId: copyableMessage.id,
                  mediaGroupId: getGroupedIdKey(copyableMessage),
                  status: "warn",
                  errorReason: copyOutcome.errorReason,
                });
              }
            } catch (copyError) {
              if (getTelegramFloodWaitSeconds(copyError) !== null) {
                throw copyError;
              }

              const copyErrorMessage = safeErrorMessage(copyError);
              copyFailureCount += 1;
              lastCopyError = copyErrorMessage;
              transferRecordRepository.upsert({
                jobId: job.id,
                sourceMessageId: copyableMessage.id,
                mediaGroupId: getGroupedIdKey(copyableMessage),
                status: "failed",
                errorReason: copyErrorMessage,
              });
            }
          }

          jobRepository.recordProgress(job.id, {
            nextMessageId,
            succeededIncrement: copiedCount,
            failedIncrement: copyFailureCount,
            skippedIncrement: skippedByAlbumPolicy + skippedByFilters + copySkippedCount,
            lastErrorCode: copyFailureCount > 0 ? "message_transfer_failed" : null,
            lastErrorMessage: lastCopyError,
          });
        }
      } catch (error) { // no-excuse-ok: catch - Telegram RPC errors are narrowed by getTelegramFloodWaitSeconds.
        const floodWaitSeconds = getTelegramFloodWaitSeconds(error);
        if (floodWaitSeconds !== null) {
          const errorMessage = safeErrorMessage(error);
          jobRepository.deferForFloodWait({
            jobId: job.id,
            accountId: job.account_id,
            workerId,
            waitSeconds: floodWaitSeconds,
            errorMessage,
          });
          return;
        }

        flushAlreadyTransferredProgress(nextMessageId);
        const errorMessage = safeErrorMessage(error);
        transferRecordRepository.upsert({
          jobId: job.id,
          sourceMessageId: messageId,
          status: "failed",
          errorReason: errorMessage,
        });
        jobRepository.recordProgress(job.id, {
          nextMessageId,
          failedIncrement: 1,
          lastErrorCode: "message_transfer_failed",
          lastErrorMessage: errorMessage,
        });
      }
    }

    flushAlreadyTransferredProgress(null);
    const latestJob = jobRepository.getById(job.id);
    if (!latestJob) {
      throw new Error("Job no longer exists");
    }

    const finalStatus = resolveSyncJobFinalStatus(latestJob.failed_messages);

    jobRepository.setStatus(job.id, finalStatus, {
      worker_id: workerId,
      next_message_id: null,
      finished_at: nowIso(),
    });
  } finally {
    await client.disconnect();
  }
}
