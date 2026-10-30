import { afterAll, describe, expect, it, vi } from "vitest";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Api } from "telegram/tl";
import type { CustomFile } from "telegram/client/uploads";
import { getDb } from "@/lib/db/client";
import { accountRepository, jobRepository, transferRecordRepository } from "@/lib/db/repositories";
import {
  partitionCaptionedAlbumMessages,
  type CaptionSelectableMessage,
} from "@/lib/telegram/album-policy";
import { getTelegramFloodWaitSeconds } from "@/lib/telegram/flood-wait";
import {
  filterCopyMessagesPendingTransfer,
  mapForwardResponse,
  processJob,
  resolveSyncJobFinalStatus,
  shouldRecordTelegramSuccess,
} from "@/lib/telegram/service";

vi.mock("@/lib/telegram/client", () => ({ createTelegramClient: vi.fn() }));
import { createTelegramClient } from "@/lib/telegram/client";

describe("processJob album policy", () => {
  vi.stubEnv("DATABASE_URL", ":memory:");
  afterAll(() => {
    getDb().close();
    vi.unstubAllEnvs();
  });

  it.each(["connect", "fetch_messages", "forward"] as const)("bounds a hung %s and preserves uncertain album deliveries", async (phase) => {
    vi.useFakeTimers();
    try {
      let finishRequest!: (value: never) => void;
      const hangingRequest = new Promise<never>((resolve) => { finishRequest = resolve; });
      const messages = [
        { id: 10, groupedId: "album" }, { id: 11, groupedId: "album" }, { id: 12 },
      ].map((message) => Object.assign(Object.create(Api.Message.prototype), message) as Api.Message);
      const attempted: number[][] = [];
      const client = {
        connect: async () => phase === "connect" ? hangingRequest : undefined,
        disconnect: async () => undefined,
        getMessages: async () => phase === "fetch_messages" ? hangingRequest : messages,
        forwardMessages: async (_peer: string, options: { messages: number[] }) => {
          attempted.push(options.messages);
          return hangingRequest;
        },
      };
      vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
      const account = accountRepository.create({ label: "timeout", phoneNumber: "+10000000070" })!;
      const created = jobRepository.create({
        accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
        startMessageId: 10, endMessageId: 12, mode: "forward", jobOrder: "asc",
        albumStrategy: "full_group", delaySeconds: 0,
      })!;
      const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
      const heartbeats: unknown[] = [];
      const result = expect(processJob(job, "test-worker", (details) => heartbeats.push(details)))
        .rejects.toMatchObject({ code: "operation_timeout", phase });
      await vi.advanceTimersByTimeAsync(120_000);
      await result;
      jobRepository.failIfRunningByWorker({ jobId: job.id, workerId: "test-worker", errorMessage: "operation_timeout" });
      expect(heartbeats.length).toBeGreaterThan(1);
      expect(attempted).toEqual(phase === "forward" ? [[10, 11]] : []);
      for (const id of [10, 11]) {
        const record = transferRecordRepository.getByJobAndSourceMessageId(job.id, id);
        if (phase === "forward") {
          expect(record).toMatchObject({ status: "warn", target_message_id: null });
          expect(record?.error_reason).toContain("delivery is unknown");
        } else expect(record).toBeNull();
      }
      expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, 12)).toBeNull();
      // A late RPC response cannot turn an uncertain delivery into a local success or continue the job.
      finishRequest([{ id: 110 }, { id: 111 }] as never);
      await vi.advanceTimersByTimeAsync(0);
      expect(jobRepository.getById(job.id)?.succeeded_messages).toBe(0);
      expect(attempted).toHaveLength(phase === "forward" ? 1 : 0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops a hanging read after pause/resume and lets the queued run continue", async () => {
    vi.useFakeTimers();
    try {
      const message = Object.assign(Object.create(Api.Message.prototype), { id: 10, message: "text" }) as Api.Message;
      let reading = false;
      let hang = true;
      const deliveries: number[][] = [];
      const client = {
        connect: async () => undefined, disconnect: async () => undefined,
        getMessages: async () => {
          reading = true;
          return hang ? new Promise<never>(() => undefined) : [message];
        },
        forwardMessages: async (_peer: string, options: { messages: number[] }) => {
          deliveries.push(options.messages);
          return [{ id: 110 }];
        },
      };
      vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
      const account = accountRepository.create({ label: "resume-read", phoneNumber: "+10000000071" })!;
      const created = jobRepository.create({
        accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
        startMessageId: 10, endMessageId: 10, mode: "forward", jobOrder: "asc",
        albumStrategy: "full_group", delaySeconds: 0,
      })!;
      const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
      const running = processJob(job, "test-worker", () => undefined);
      await vi.advanceTimersByTimeAsync(0);
      expect(reading).toBe(true);
      jobRepository.requestPause(job.id);
      jobRepository.requestResume(job.id);
      await vi.advanceTimersByTimeAsync(1_000);
      await running;
      expect(jobRepository.getById(job.id)).toMatchObject({ status: "pending", processed_messages: 0 });
      expect(deliveries).toEqual([]);
      hang = false;
      const claimed = jobRepository.claimNext("test-worker")!;
      expect(claimed.id).toBe(job.id);
      await processJob(claimed, "test-worker", () => undefined);
      expect(deliveries).toEqual([[10]]);
      expect(jobRepository.getById(job.id)).toMatchObject({ status: "completed", succeeded_messages: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not send another copy album member after pause/resume during a send", async () => {
    const messages = [10, 11].map((id) => Object.assign(Object.create(Api.Message.prototype), {
      id, groupedId: "album", message: "text",
    }) as Api.Message);
    const account = accountRepository.create({ label: "resume-copy", phoneNumber: "+10000000072" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      startMessageId: 10, endMessageId: 11, mode: "copy", jobOrder: "asc",
      albumStrategy: "full_group", delaySeconds: 0,
    })!;
    let sends = 0;
    const client = {
      connect: async () => undefined, disconnect: async () => undefined,
      getMessages: async () => messages,
      sendMessage: async () => {
        sends += 1;
        jobRepository.requestPause(created.id);
        jobRepository.requestResume(created.id);
        return { id: 110 };
      },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    await processJob(job, "test-worker", () => undefined);
    expect(sends).toBe(1);
    expect(jobRepository.getById(job.id)).toMatchObject({ status: "pending", succeeded_messages: 1, processed_messages: 1 });
    expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, 10)?.status).toBe("sent");
    expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, 11)).toBeNull();
  });

  it("schedules FloodWait encountered during search before processing messages", async () => {
    const client = {
      connect: async () => undefined, disconnect: async () => undefined,
      getMessages: async () => { throw { errorCode: 420, seconds: 17, message: "FLOOD_WAIT_17" }; },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const account = accountRepository.create({ label: "search-wait", phoneNumber: "+10000000073" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      selection: "search", searchQuery: "private search phrase", mode: "forward", jobOrder: "asc",
      albumStrategy: "full_group", delaySeconds: 0,
    })!;
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    await processJob(job, "test-worker", () => undefined);
    expect(jobRepository.getById(job.id)).toMatchObject({
      status: "pending", flood_wait_events: 1, processed_messages: 0, send_attempts: 0,
    });
    expect(Date.parse(accountRepository.getById(account.id)!.flood_wait_until!)).toBeGreaterThan(Date.now());
  });

  it("allows a pacing wait longer than the network deadline", async () => {
    vi.useFakeTimers();
    try {
      const message = Object.assign(Object.create(Api.Message.prototype), { id: 10, message: "text" }) as Api.Message;
      const account = accountRepository.create({ label: "slow-pacing", phoneNumber: "+10000000074" })!;
      const created = jobRepository.create({
        accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
        startMessageId: 10, endMessageId: 10, mode: "forward", jobOrder: "asc",
        albumStrategy: "full_group", delaySeconds: 150,
      })!;
      const client = {
        connect: async () => undefined, disconnect: async () => undefined,
        getMessages: async () => [message], forwardMessages: async () => [{ id: 110 }],
      };
      vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
      const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
      const result = processJob(job, "test-worker", () => undefined);
      await vi.advanceTimersByTimeAsync(150_000);
      await result;
      expect(jobRepository.getById(job.id)).toMatchObject({ status: "completed", succeeded_messages: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    { allowedMediaTypes: [] as const, sentIds: [10, 11, 12] },
    { allowedMediaTypes: ["photo"] as const, sentIds: [10] },
    { allowedMediaTypes: ["text"] as const, sentIds: [11] },
  ])("filters standalone messages with $allowedMediaTypes without applying album policy", async ({ allowedMediaTypes, sentIds }) => {
    const messages = [
      { id: 10, message: "", media: new Api.MessageMediaPhoto({}) },
      { id: 11, message: "standalone text" },
      { id: 12, message: "" },
    ].map((message) => Object.assign(Object.create(Api.Message.prototype), message) as Api.Message);
    const deliveries: number[][] = [];
    const client = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      getMessages: async () => messages,
      forwardMessages: async (_peer: string, options: { messages: number[] }) => {
        deliveries.push(options.messages);
        return options.messages.map((id) => ({ id: id + 100 }));
      },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const account = accountRepository.create({ label: "standalone-filter", phoneNumber: "+10000000004" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      startMessageId: 10, endMessageId: 12, mode: "forward", jobOrder: "asc",
      albumStrategy: "captioned_only", delaySeconds: 0, allowedMediaTypes: [...allowedMediaTypes],
    })!;
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    await processJob(job, "test-worker", () => undefined);
    expect(deliveries).toEqual(sentIds.map((id) => [id]));
    expect(jobRepository.getById(job.id)).toMatchObject({
      status: "completed", processed_messages: 3, failed_messages: 0,
      succeeded_messages: sentIds.length, skipped_messages: 3 - sentIds.length,
    });
    for (const message of messages) {
      expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, message.id)).toMatchObject({
        status: sentIds.includes(message.id) ? "sent" : "skipped",
        error_reason: sentIds.includes(message.id) ? null : "Skipped by media type filter",
      });
    }
  });

  it.each([
    { name: "photo", photo: true, streaming: false, failUpload: false },
    { name: "streamable video", photo: false, streaming: true, failUpload: false },
    { name: "non-streamable video", photo: false, streaming: false, failUpload: false },
    { name: "failed video upload", photo: false, streaming: true, failUpload: true },
  ])("preserves copy upload metadata and temporary cleanup for $name", async (scenario) => {
    const attributes = [
      new Api.DocumentAttributeFilename({ fileName: "clip.mp4" }),
      new Api.DocumentAttributeVideo({ duration: 1, w: 64, h: 48, supportsStreaming: scenario.streaming }),
    ];
    const document = Object.assign(Object.create(Api.Document.prototype), { mimeType: "video/mp4", attributes }) as Api.Document;
    const entities = [new Api.MessageEntityBold({ offset: 0, length: 7 })];
    const message = Object.assign(Object.create(Api.Message.prototype), {
      id: 10, message: "caption", entities,
      media: scenario.photo ? new Api.MessageMediaPhoto({}) : new Api.MessageMediaDocument({ document }),
    }) as Api.Message;
    let temporaryPath = "";
    let upload: unknown;
    const client = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      getMessages: async () => [message],
      downloadMedia: async (_message: Api.Message, options: { outputFile: string }) => {
        temporaryPath = options.outputFile;
        await writeFile(temporaryPath, "fixture-media");
        return temporaryPath;
      },
      sendFile: async (peer: string, options: {
        file: CustomFile; caption: string; formattingEntities: Api.TypeMessageEntity[];
        attributes?: Api.TypeDocumentAttribute[]; supportsStreaming: boolean; workers: number;
      }) => {
        upload = {
          peer, name: options.file.name, size: options.file.size, content: await readFile(options.file.path, "utf8"),
          caption: options.caption, entities: options.formattingEntities, attributes: options.attributes,
          supportsStreaming: options.supportsStreaming, workers: options.workers,
        };
        if (scenario.failUpload) throw new Error("upload failed");
        return { id: 913 };
      },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const account = accountRepository.create({ label: "copy-metadata", phoneNumber: "+10000000005" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      startMessageId: 10, endMessageId: 10, mode: "copy", jobOrder: "asc", albumStrategy: "full_group", delaySeconds: 0,
    })!;
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    await processJob(job, "test-worker", () => undefined);
    expect(upload).toEqual({
      peer: "target", name: scenario.photo ? "telegram-photo-10.jpg" : "clip.mp4", size: 13, content: "fixture-media",
      caption: "caption", entities, attributes: scenario.photo ? undefined : attributes,
      supportsStreaming: scenario.streaming, workers: 1,
    });
    expect(jobRepository.getById(job.id)).toMatchObject({
      status: scenario.failUpload ? "failed" : "completed", processed_messages: 1,
      succeeded_messages: scenario.failUpload ? 0 : 1, failed_messages: scenario.failUpload ? 1 : 0, skipped_messages: 0,
    });
    expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, 10)).toMatchObject({
      status: scenario.failUpload ? "failed" : "sent", target_message_id: scenario.failUpload ? null : 913,
      error_reason: scenario.failUpload ? "upload failed" : null,
    });
    expect(temporaryPath).not.toBe("");
    await expect(access(dirname(temporaryPath))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    { name: "mixed media rejected as a whole", allowedMediaTypes: ["photo"] as const, start: 10, end: 12, sent: false },
    { name: "mixed media accepted as a whole", allowedMediaTypes: ["photo", "other"] as const, start: 10, end: 12, sent: true },
    { name: "lower ID boundary", allowedMediaTypes: [] as const, start: 11, end: 12, sent: false },
    { name: "upper ID boundary", allowedMediaTypes: [] as const, start: 10, end: 11, sent: false },
  ])("forward/full_group is indivisible: $name", async (scenario) => {
    const messages = [
      { id: 10, groupedId: "a", message: "caption", media: new Api.MessageMediaPhoto({}) },
      { id: 11, groupedId: "a", message: "", media: new Api.MessageMediaUnsupported() },
      { id: 12, groupedId: "a", message: "", media: new Api.MessageMediaPhoto({}) },
    ].map((message) => Object.assign(Object.create(Api.Message.prototype), message) as Api.Message);
    const deliveries: number[][] = [];
    const client = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      getMessages: async (_peer: string, options: { ids?: number[] }) =>
        messages.filter((message) => !options.ids || options.ids.includes(message.id)),
      forwardMessages: async (_peer: string, options: { messages: number[] }) => {
        deliveries.push(options.messages);
        return options.messages.map((id) => ({ id: id + 100 }));
      },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const account = accountRepository.create({ label: "atomic-group", phoneNumber: "+10000000003" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      startMessageId: scenario.start, endMessageId: scenario.end, mode: "forward", jobOrder: "asc",
      albumStrategy: "full_group", delaySeconds: 0, allowedMediaTypes: [...scenario.allowedMediaTypes],
    })!;
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    await processJob(job, "test-worker", () => undefined);
    expect(deliveries).toEqual(scenario.sent ? [[10, 11, 12]] : []);
    const count = scenario.end - scenario.start + 1;
    expect(jobRepository.getById(job.id)).toMatchObject({
      status: "completed", total_messages: count, processed_messages: count, failed_messages: 0,
      succeeded_messages: scenario.sent ? count : 0, skipped_messages: scenario.sent ? 0 : count,
    });
    for (const message of messages) {
      const record = transferRecordRepository.getByJobAndSourceMessageId(job.id, message.id);
      if (message.id < scenario.start || message.id > scenario.end) {
        expect(record).toBeNull();
      } else {
        expect(record).toMatchObject({ status: scenario.sent ? "sent" : "skipped" });
      }
    }
  });

  for (const mode of ["forward", "copy"] as const) {
    it.each([
      { name: "keyword blacklist", captions: ["", "spam", ""], keywordBlacklist: ["spam"], allowed: false },
      { name: "regex blacklist", captions: ["", "spam", ""], regexBlacklist: ["^spam$"], allowed: false },
      { name: "keyword whitelist", captions: ["", "keep", ""], keywordWhitelist: ["keep"], allowed: true },
      { name: "regex whitelist", captions: ["", "keep", ""], regexWhitelist: ["^keep$"], allowed: true },
      { name: "blacklist precedence across captions", captions: ["keep", "spam", ""], keywordWhitelist: ["keep"], keywordBlacklist: ["spam"], allowed: false },
      { name: "captionless blacklist", captions: ["", "", ""], keywordBlacklist: ["spam"], allowed: true },
      { name: "captionless whitelist", captions: ["", "", ""], keywordWhitelist: ["keep"], allowed: false },
    ])(`${mode}/full_group filters the whole album: $name`, async (scenario) => {
      const messages = [...scenario.captions.map((message, index) => ({ id: 10 + index, groupedId: "a", message })),
        { id: 13, message: "keep" }, { id: 14, message: "spam" },
      ].map((message) => Object.assign(Object.create(Api.Message.prototype), message) as Api.Message);
      const deliveries: number[][] = [];
      const copiedTexts: string[] = [];
      const client = {
        connect: async () => undefined,
        disconnect: async () => undefined,
        getMessages: async (_peer: string, options: { ids?: number[] }) =>
          messages.filter((message) => !options.ids || options.ids.includes(message.id)),
        forwardMessages: async (_peer: string, options: { messages: number[] }) => {
          deliveries.push(options.messages);
          return options.messages.map((id) => ({ id: id + 100 }));
        },
        sendMessage: async (_peer: string, options: { message: string }) => {
          copiedTexts.push(options.message);
          return { id: 200 + copiedTexts.length };
        },
      };
      vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
      const account = accountRepository.create({ label: "group-filter", phoneNumber: "+10000000002" })!;
      const created = jobRepository.create({
        accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
        startMessageId: 10, endMessageId: 14, mode, jobOrder: "desc", albumStrategy: "full_group", delaySeconds: 0,
        keywordWhitelist: scenario.keywordWhitelist, keywordBlacklist: scenario.keywordBlacklist,
        regexWhitelist: scenario.regexWhitelist, regexBlacklist: scenario.regexBlacklist,
      })!;
      const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
      await processJob(job, "test-worker", () => undefined);
      const sentIds = scenario.allowed ? [10, 11, 12, 13] : [13];
      expect(jobRepository.getById(job.id)).toMatchObject({
        status: "completed", succeeded_messages: sentIds.length, skipped_messages: 5 - sentIds.length, failed_messages: 0,
      });
      for (const message of messages) {
        expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, message.id)).toMatchObject({
          status: sentIds.includes(message.id) ? "sent" : "skipped",
          error_reason: sentIds.includes(message.id) ? null : "Skipped by text filter",
        });
      }
      if (mode === "forward") {
        expect(deliveries).toEqual(scenario.allowed ? [[13], [10, 11, 12]] : [[13]]);
      } else {
        expect(copiedTexts).toEqual(scenario.allowed ? ["keep", ...scenario.captions] : ["keep"]);
      }
    });
  }

  it("preserves source mapping, warnings and diagnostics for a partially mapped album", async () => {
    const messages = [21, 22, 23].map((id) =>
      Object.assign(Object.create(Api.Message.prototype), { id, groupedId: "album", message: "caption" }) as Api.Message,
    );
    const deliveries: number[][] = [];
    const client = {
      connect: async () => undefined,
      disconnect: async () => undefined,
      getMessages: async () => messages,
      forwardMessages: async (_peer: string, options: { messages: number[] }) => {
        deliveries.push(options.messages);
        return [{ id: 901 }, {}, { id: 703 }];
      },
    };
    vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
    const account = accountRepository.create({ label: "partial", phoneNumber: "+10000000001" })!;
    const created = jobRepository.create({
      accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
      startMessageId: 21, endMessageId: 23, mode: "forward", jobOrder: "asc", albumStrategy: "full_group", delaySeconds: 0,
    })!;
    const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await processJob(job, "test-worker", () => undefined);
      expect(deliveries).toEqual([[21, 22, 23]]);
      expect(jobRepository.getById(job.id)).toMatchObject({
        status: "completed", succeeded_messages: 2, skipped_messages: 1, failed_messages: 0,
        local_skips: 0, forward_confirmed: 2, forward_unmapped: 1, send_attempts: 1,
      });
      for (const [id, targetId] of [[21, 901], [22, null], [23, 703]]) {
        expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, id!)).toMatchObject({
          target_message_id: targetId, media_group_id: "album", status: targetId === null ? "warn" : "sent",
          error_reason: targetId === null ? "Telegram did not return a target message id" : null,
        });
      }
      expect(warning.mock.calls.map(([line]) => JSON.parse(line as string))).toMatchObject([{
        event: "forward_mapping_incomplete", level: "warn",
        jobId: job.id, sourceCount: 3, responseCount: 3, mappedCount: 2, unmappedCount: 1,
        sourceMessageIdSample: [21, 22, 23], sourceMessageIdsOmitted: 0,
        mappedTargetMessageIdSample: [901, 703], mappedTargetMessageIdsOmitted: 0,
      }]);
      await processJob(job, "test-worker", () => undefined);
      expect(deliveries).toEqual([[21, 22, 23]]);
    } finally {
      warning.mockRestore();
    }
  });

  for (const mode of ["forward", "copy"] as const) {
    for (const jobOrder of ["asc", "desc"] as const) {
      it.each(["captioned_only", "full_group"] as const)(`${mode}/${jobOrder}/%s preserves transfers and progress`, async (albumStrategy) => {
        const messages = [
          { id: 10, groupedId: "a", message: "" },
          { id: 11, groupedId: "a", message: "caption" },
          { id: 12, groupedId: "a", message: "" },
          { id: 13, groupedId: "b", message: "" },
          { id: 14, groupedId: "b", message: "   " },
          { id: 15, message: "standalone" },
          { id: 16, message: "" },
        ].map((message) => Object.assign(Object.create(Api.Message.prototype), message) as Api.Message);
        const deliveries: number[][] = [];
        const client = {
          connect: async () => undefined,
          disconnect: async () => undefined,
          getMessages: async (_peer: string, options: { ids?: number[] }) =>
            messages.filter((message) => !options.ids || options.ids.includes(message.id)),
          forwardMessages: async (_peer: string, options: { messages: number[] }) => {
            deliveries.push(options.messages);
            return options.messages.map((id) => ({ id: id + 100 }));
          },
          sendMessage: async (_peer: string, options: { message: string }) => {
            // Copy sends text, so retain that observable payload rather than infer source IDs.
            copiedTexts.push(options.message);
            return { id: 200 + copiedTexts.length };
          },
        };
        const copiedTexts: string[] = [];
        vi.mocked(createTelegramClient).mockResolvedValue({ client } as unknown as Awaited<ReturnType<typeof createTelegramClient>>);
        const account = accountRepository.create({ label: "ablation", phoneNumber: "+10000000000" })!;
        const created = jobRepository.create({
          accountId: account.id, sourceChannelRef: "source", targetChannelRef: "target",
          startMessageId: 10, endMessageId: 16, mode, jobOrder, albumStrategy, delaySeconds: 0,
        })!;
        const job = jobRepository.setStatus(created.id, "running", { worker_id: "test-worker" })!;
        await processJob(job, "test-worker", () => undefined);

        const captionedOnly = albumStrategy === "captioned_only";
        const sentIds = captionedOnly ? [11, 15, 16] : [10, 11, 12, 13, 14, 15, 16];
        expect(jobRepository.getById(job.id)).toMatchObject({
          status: "completed", next_message_id: null, failed_messages: 0,
          succeeded_messages: sentIds.length, skipped_messages: 7 - sentIds.length,
          send_attempts: mode === "copy" ? sentIds.length : captionedOnly ? 3 : 4,
        });
        for (const message of messages) {
          const sent = sentIds.includes(message.id);
          expect(transferRecordRepository.getByJobAndSourceMessageId(job.id, message.id)).toMatchObject({
            status: sent ? "sent" : "skipped",
            media_group_id: message.groupedId ?? null,
            error_reason: sent ? null : "Skipped by captioned_only policy",
          });
        }
        if (mode === "forward") {
          const expected = captionedOnly ? [[11], [15], [16]] : [[10, 11, 12], [13, 14], [15], [16]];
          expect(deliveries).toEqual(jobOrder === "asc" ? expected : expected.reverse());
        } else {
          const expected = captionedOnly ? ["caption", "standalone", ""] : ["", "caption", "", "", "   ", "standalone", ""];
          expect(copiedTexts).toEqual(jobOrder === "asc" ? expected : captionedOnly ? ["", "standalone", "caption"] : ["", "standalone", "", "   ", "", "caption", ""]);
        }
      });
    }
  }
});

describe("filterCopyMessagesPendingTransfer", () => {
  it("excludes album members that already reached a terminal transfer status", () => {
    const messages = [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }];
    const records = new Map<number, { status: string }>([
      [10, { status: "sent" }],
      [11, { status: "failed" }],
      [12, { status: "skipped" }],
      [13, { status: "warn" }],
    ]);

    const pending = filterCopyMessagesPendingTransfer(messages, (id) => records.get(id) ?? null);

    expect(pending).toEqual([{ id: 11 }]);
  });

  it("keeps messages with no record or non-terminal status", () => {
    const messages = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const records = new Map<number, { status: string }>([[2, { status: "failed" }]]);

    const pending = filterCopyMessagesPendingTransfer(messages, (id) => records.get(id) ?? null);

    expect(pending).toEqual(messages);
  });
});

describe("mapForwardResponse", () => {
  it.each([
    { response: [], responseCount: 0, targetIds: [null, null, null] },
    { response: [[{ id: 901 }, {}], [], { id: 703 }], responseCount: 3, targetIds: [901, null, 703] },
  ])("preserves missing IDs and order for $response", ({ response, responseCount, targetIds }) => {
    const sourceMessages = [{ id: 21 }, { id: 22 }, { id: 23 }];
    expect(mapForwardResponse(sourceMessages, response)).toEqual({
      responseCount,
      sent: targetIds.map((targetMessageId, index) => ({ sourceMessage: sourceMessages[index], targetMessageId })),
    });
  });

  it("reports the raw response count when Telegram returns fewer messages than requested", () => {
    // Given
    const sourceMessages = [{ id: 10 }, { id: 11 }, { id: 12 }];

    // When
    const result = mapForwardResponse(sourceMessages, [{ id: 100 }]);

    // Then
    expect(result.responseCount).toBe(1);
    expect(result.sent).toEqual([
      { sourceMessage: sourceMessages[0], targetMessageId: 100 },
      { sourceMessage: sourceMessages[1], targetMessageId: null },
      { sourceMessage: sourceMessages[2], targetMessageId: null },
    ]);
  });

  it("maps GramJS nested batch responses to their source messages", () => {
    // Given
    const sourceMessages = [{ id: 10 }, { id: 11 }];
    const gramJsResponse = [[{ id: 100 }, { id: 101 }]];

    // When
    const result = mapForwardResponse(sourceMessages, gramJsResponse);

    // Then
    expect(result.responseCount).toBe(2);
    expect(result.sent).toEqual([
      { sourceMessage: sourceMessages[0], targetMessageId: 100 },
      { sourceMessage: sourceMessages[1], targetMessageId: 101 },
    ]);
  });
});

describe("shouldRecordTelegramSuccess", () => {
  it("does not record adaptive pacing success after a read", () => {
    // Given
    const attemptKind = "read";

    // When
    const shouldRecord = shouldRecordTelegramSuccess(attemptKind);

    // Then
    expect(shouldRecord).toBe(false);
  });

  it.each(["send", "forward"] as const)("records adaptive pacing success after a successful %s", (attemptKind) => {
    // Given / When
    const shouldRecord = shouldRecordTelegramSuccess(attemptKind);

    // Then
    expect(shouldRecord).toBe(true);
  });
});

describe("resolveSyncJobFinalStatus", () => {
  it("returns completed when no messages failed", () => {
    expect(resolveSyncJobFinalStatus(0)).toBe("completed");
  });

  it("returns failed when at least one message failed", () => {
    expect(resolveSyncJobFinalStatus(1)).toBe("failed");
    expect(resolveSyncJobFinalStatus(3)).toBe("failed");
  });
});

describe("partitionCaptionedAlbumMessages", () => {
  it("selects the captioned album message and marks the rest as skipped", () => {
    const messages: CaptionSelectableMessage[] = [
      { id: 10, message: "" },
      { id: 11, message: "caption" },
      { id: 12 },
    ];

    const result = partitionCaptionedAlbumMessages(messages);

    expect(result.selected).toEqual(messages[1]);
    expect(result.skipped).toEqual([messages[0], messages[2]]);
  });

  it("skips the entire album when no message has a caption", () => {
    const messages: CaptionSelectableMessage[] = [
      { id: 20 },
      { id: 21, message: "   " },
    ];

    const result = partitionCaptionedAlbumMessages(messages);

    expect(result.selected).toBeNull();
    expect(result.skipped).toEqual(messages);
  });
});

describe("getTelegramFloodWaitSeconds", () => {
  it("returns seconds from error object with errorCode 420 and seconds", () => {
    const err = {
      errorCode: 420,
      seconds: 120,
      message: "FLOOD_WAIT_120",
    };
    expect(getTelegramFloodWaitSeconds(err)).toBe(120);
  });

  it("returns seconds from error message containing FLOOD_WAIT_ pattern", () => {
    const err = new Error("RPCError: FLOOD_WAIT_300: A wait of 300 seconds is required");
    expect(getTelegramFloodWaitSeconds(err)).toBe(300);
  });

  it("returns seconds from error message containing ForwardMessages and wait pattern", () => {
    const err = new Error("A wait of 45 seconds is required (caused by ForwardMessagesRequest)");
    expect(getTelegramFloodWaitSeconds(err)).toBe(45);
  });

  it("returns null for non-flood errors", () => {
    const err = new Error("Some other error");
    expect(getTelegramFloodWaitSeconds(err)).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(getTelegramFloodWaitSeconds(null)).toBeNull();
    expect(getTelegramFloodWaitSeconds(undefined)).toBeNull();
  });
});
