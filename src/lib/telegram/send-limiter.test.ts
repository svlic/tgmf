import { describe, expect, it, vi } from "vitest";
import { AccountSendLimiter } from "@/lib/telegram/send-limiter";

describe("AccountSendLimiter", () => {
  it("spaces the next attempt even when the previous result is unmapped", async () => {
    // Given
    let now = 1_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const limiter = new AccountSendLimiter(() => now, sleep);
    const attemptTimes: number[] = [];

    // When
    await limiter.run("account-1", 2_000, async () => {
      attemptTimes.push(now);
      return null;
    });
    await limiter.run("account-1", 2_000, async () => {
      attemptTimes.push(now);
      return 42;
    });

    // Then
    expect(attemptTimes).toEqual([1_000, 3_000]);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("releases the next attempt when a queued wait rejects", async () => {
    // Given
    const limiter = new AccountSendLimiter(
      () => 1_000,
      vi.fn().mockRejectedValueOnce(new Error("wait cancelled")),
    );
    await limiter.run("account-1", 2_000, async () => null);

    // When
    await expect(limiter.run("account-1", 2_000, async () => null)).rejects.toThrow("wait cancelled");

    // Then
    await expect(limiter.run("account-1", 0, async () => 42)).resolves.toBe(42);
  });

  it("does not delay the first attempt or attempts from another account", async () => {
    // Given
    const sleep = vi.fn(async () => undefined);
    const limiter = new AccountSendLimiter(() => 1_000, sleep);

    // When
    await limiter.run("account-1", 2_000, async () => null);
    await limiter.run("account-2", 2_000, async () => null);

    // Then
    expect(sleep).not.toHaveBeenCalled();
  });
});
