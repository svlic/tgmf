import { describe, expect, it } from "vitest";
import {
  partitionCaptionedAlbumMessages,
  type CaptionSelectableMessage,
} from "@/lib/telegram/album-policy";
import { getTelegramFloodWaitSeconds } from "@/lib/telegram/flood-wait";
import {
  filterCopyMessagesPendingTransfer,
  mapForwardResponse,
  resolveSyncJobFinalStatus,
} from "@/lib/telegram/service";

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
