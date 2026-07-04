import { describe, expect, it, vi } from "vitest";
import {
  partitionCaptionedAlbumMessages,
  type CaptionSelectableMessage,
} from "@/lib/telegram/album-policy";
import { getTelegramFloodWaitSeconds, waitForTelegramFloodWindow } from "@/lib/telegram/flood-wait";
import { resolveSyncJobFinalStatus } from "@/lib/telegram/service";

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

describe("waitForTelegramFloodWindow", () => {
  it("keeps heartbeats active while waiting for Telegram's required flood window", async () => {
    vi.useFakeTimers();
    const onHeartbeat = vi.fn();

    try {
      const waitPromise = waitForTelegramFloodWindow(61, onHeartbeat);
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(1_000);
      await waitPromise;

      expect(onHeartbeat).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
