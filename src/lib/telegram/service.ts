import { Api } from "telegram/tl";
import { CustomFile } from "telegram/client/uploads";
import { createTelegramClient } from "@/lib/telegram/client";
import {
  accountRepository,
  dialogRepository,
  telegramLoginSessionRepository,
  transferRecordRepository,
  jobRepository,
} from "@/lib/db/repositories";
import { ALLOWED_MEDIA_TYPES } from "@/lib/types";
import type { AllowedMediaType, DialogCacheRow, SyncJobRow } from "@/lib/types";
import { nowIso, safeErrorMessage, sleep } from "@/lib/utils";

export type StartLoginResult = {
  loginState: "awaiting_code";
};

type MessageLike = {
  id?: number;
  groupedId?: bigint | string | null;
  message?: string;
  media?: Api.TypeMessageMedia;
  entities?: Api.TypeMessageEntity[];
  noforwards?: boolean;
};

type ForwardedMessage = {
  sourceMessage: MessageLike;
  targetMessageId: number;
};

type ForwardResult = {
  sent: ForwardedMessage[];
  skipped: MessageLike[];
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

function getActiveLoginSession(accountId: string) {
  return telegramLoginSessionRepository.getActive(accountId);
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
  const loginState = getActiveLoginSession(accountId);
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
  const loginState = getActiveLoginSession(accountId);
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

function selectCaptionedMessage(messages: MessageLike[]) {
  return messages.find((message) => typeof message.message === "string" && message.message.trim().length > 0) ?? null;
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

function normalizeAllowedMediaType(value: unknown): AllowedMediaType | null {
  if (typeof value !== "string") {
    return null;
  }
  if (ALLOWED_MEDIA_TYPES.includes(value as AllowedMediaType)) {
    return value as AllowedMediaType;
  }
  if (["video_note", "sticker", "animation"].includes(value)) {
    return "other";
  }

  return null;
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
  if (existingName) {
    if (filenameHasExtension(existingName)) {
      return existingName;
    }

    const extension = getExtensionFromMimeType(document?.mimeType);
    return extension ? `${existingName}.${extension}` : existingName;
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

function buildCopiedMediaUpload(message: MessageLike, downloaded: Buffer): CopiedMediaUpload {
  return {
    file: new CustomFile(buildCopiedMediaFilename(message), downloaded.length, "", downloaded),
    attributes: getCopiedDocumentAttributes(message),
    supportsStreaming: supportsVideoStreaming(message),
  };
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
) {
  const groupedId = getGroupedIdKey(sourceMessage);
  if (!groupedId || !sourceMessage.id) {
    return [sourceMessage];
  }

  const nearby = await client.getMessages(job.source_channel_ref, {
    minId: Math.max(0, sourceMessage.id - 10),
    maxId: sourceMessage.id + 10,
    limit: 25,
  });
  const messages = Array.from(nearby as Iterable<MessageLike>).filter(
    (message) => getGroupedIdKey(message) === groupedId && isMessageInJobRange(message, job),
  );

  return messages.length > 0 ? sortMessagesById(messages) : [sourceMessage];
}

async function forwardMessages(
  client: Awaited<ReturnType<typeof createTelegramClient>>["client"],
  job: SyncJobRow,
  sourceMessages: MessageLike[],
): Promise<ForwardResult> {
  const sourceMessageIds = sourceMessages
    .map((message) => message.id)
    .filter((messageId): messageId is number => typeof messageId === "number");
  if (sourceMessageIds.length === 0) {
    throw new Error("Message missing id");
  }

  const sentMessages = await client.forwardMessages(job.target_channel_ref, {
    fromPeer: job.source_channel_ref,
    messages: sourceMessageIds,
  });

  const targetMessageIds = sentMessages.map((message) => message.id).filter((messageId): messageId is number => typeof messageId === "number");
  if (targetMessageIds.length !== sourceMessageIds.length) {
    throw new Error(`Forwarded message count mismatch: expected ${sourceMessageIds.length}, got ${targetMessageIds.length}`);
  }

  return {
    targetMessageIds,
    sourceMessages,
  };
}

async function copyMessage(client: Awaited<ReturnType<typeof createTelegramClient>>["client"], job: SyncJobRow, message: MessageLike) {
  if (!message.id) {
    throw new Error("Message missing id");
  }
  if (message.noforwards) {
    throw new Error("Message is protected by Telegram no-forward restrictions");
  }

  const caption = message.message ?? "";
  if (!message.media) {
    const result = await client.sendMessage(job.target_channel_ref, {
      message: caption,
      formattingEntities: message.entities,
    });
    return result.id ?? null;
  }

  const downloaded = await client.downloadMedia(message.media, {});
  if (!Buffer.isBuffer(downloaded) || downloaded.length === 0) {
    throw new Error(`Failed to download media from message ${message.id}`);
  }

  const upload = buildCopiedMediaUpload(message, downloaded);
  const result = await client.sendFile(job.target_channel_ref, {
    file: upload.file,
    caption,
    formattingEntities: message.entities,
    attributes: upload.attributes,
    supportsStreaming: upload.supportsStreaming,
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
        const alreadyTransferred = transferRecordRepository.getByJobAndSourceMessageId(job.id, messageId);
        if (alreadyTransferred?.status === "sent" || alreadyTransferred?.status === "skipped") {
          jobRepository.recordProgress(job.id, {
            nextMessageId: messageIds[index + 1] ?? null,
          });
          continue;
        }

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

        let messagesToForward = sourceMessage.groupedId ? await fetchAlbumMessages(client, job, sourceMessage as MessageLike) : [sourceMessage as MessageLike];

        if (job.album_strategy === "captioned_only" && sourceMessage.groupedId) {
          const selected = selectCaptionedMessage(messagesToForward);
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
          messagesToForward = [selected];
        }

        const mediaFilter = parseAllowedMediaTypes(currentJob.allowed_media_types);
        const filteredMessages = filterMessagesByAllowedMediaTypes(messagesToForward, mediaFilter);
        filteredMessages.skipped.forEach((message) => {
          if (!message.id) {
            return;
          }
          transferRecordRepository.upsert({
            jobId: job.id,
            sourceMessageId: message.id,
            mediaGroupId: getGroupedIdKey(message),
            status: "skipped",
            errorReason: "Skipped by media type filter",
          });
        });
        if (filteredMessages.allowed.length === 0) {
          jobRepository.recordProgress(job.id, {
            nextMessageId: messageIds[index + 1] ?? null,
            skippedIncrement: filteredMessages.skipped.length,
          });
          continue;
        }
        messagesToForward = filteredMessages.allowed;

        if (job.mode === "forward") {
          const forwardResult = await forwardMessages(client, job, messagesToForward);
          forwardResult.sourceMessages.forEach((message, messageIndex) => {
            if (!message.id) {
              return;
            }
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId: message.id,
              targetMessageId: forwardResult.targetMessageIds[messageIndex] ?? null,
              mediaGroupId: getGroupedIdKey(message),
              status: "sent",
            });
          });
          jobRepository.recordProgress(job.id, {
            nextMessageId: messageIds[index + 1] ?? null,
            succeededIncrement: forwardResult.sourceMessages.length,
            skippedIncrement: filteredMessages.skipped.length,
          });
        } else {
          const messageToCopy = messagesToForward.find(
            (message): message is MessageLike & { id: number } => message.id === messageId,
          );
          if (!messageToCopy) {
            jobRepository.recordProgress(job.id, {
              nextMessageId: messageIds[index + 1] ?? null,
              skippedIncrement: filteredMessages.skipped.length,
            });
            continue;
          }

          const skippedCopyAlbumMessages = messagesToForward.filter(
            (message): message is MessageLike & { id: number } => typeof message.id === "number" && message.id !== messageToCopy.id,
          );
          skippedCopyAlbumMessages.forEach((message) => {
            transferRecordRepository.upsert({
              jobId: job.id,
              sourceMessageId: message.id,
              mediaGroupId: getGroupedIdKey(message),
              status: "skipped",
              errorReason: "Skipped because copy mode only copies one album message",
            });
          });

          const targetMessageId = await copyMessage(client, job, messageToCopy);
          transferRecordRepository.upsert({
            jobId: job.id,
            sourceMessageId: messageToCopy.id,
            targetMessageId,
            mediaGroupId: getGroupedIdKey(messageToCopy),
            status: "sent",
          });
          jobRepository.recordProgress(job.id, {
            nextMessageId: messageIds[index + 1] ?? null,
            succeededIncrement: 1,
            skippedIncrement: filteredMessages.skipped.length + skippedCopyAlbumMessages.length,
          });
        }
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
