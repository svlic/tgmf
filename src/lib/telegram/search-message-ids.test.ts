import { describe, expect, it, vi } from "vitest";
import { collectSearchMessageIds, orderSearchMessageIds } from "@/lib/telegram/search-message-ids";

describe("orderSearchMessageIds", () => {
  it("deduplicates and sorts ascending", () => {
    expect(orderSearchMessageIds([5, 1, 5, 3, 0, -1, 2.5], "asc")).toEqual([1, 3, 5]);
  });

  it("deduplicates and sorts descending", () => {
    expect(orderSearchMessageIds([2, 9, 2, 4], "desc")).toEqual([9, 4, 2]);
  });
});

describe("collectSearchMessageIds", () => {
  it("widens min/max for exclusive GramJS bounds and keeps IDs inside the inclusive range", async () => {
    const fetchMessages = vi.fn(async () => [
      { id: 9 },
      { id: 10 },
      { id: 15 },
      { id: 20 },
      { id: 21 },
      { id: undefined },
    ]);

    const ids = await collectSearchMessageIds({
      searchQuery: "hello",
      startMessageId: 10,
      endMessageId: 20,
      jobOrder: "asc",
      fetchMessages,
    });

    expect(fetchMessages).toHaveBeenCalledWith({
      search: "hello",
      minId: 9,
      maxId: 21,
      reverse: true,
    });
    expect(ids).toEqual([10, 15, 20]);
  });

  it("searches without ID bounds when both bounds are omitted", async () => {
    const fetchMessages = vi.fn(async () => [{ id: 2 }, { id: 9 }]);

    const ids = await collectSearchMessageIds({
      searchQuery: "unbounded",
      startMessageId: 0,
      endMessageId: 0,
      jobOrder: "asc",
      fetchMessages,
    });

    expect(fetchMessages).toHaveBeenCalledWith({
      search: "unbounded",
      minId: 0,
      maxId: 0,
      reverse: true,
    });
    expect(ids).toEqual([2, 9]);
  });

  it("orders descending when job order is desc", async () => {
    const ids = await collectSearchMessageIds({
      searchQuery: "world",
      startMessageId: 1,
      endMessageId: 5,
      jobOrder: "desc",
      fetchMessages: async () => [{ id: 1 }, { id: 3 }, { id: 5 }],
    });

    expect(ids).toEqual([5, 3, 1]);
  });

  it("rejects an empty search query", async () => {
    await expect(
      collectSearchMessageIds({
        searchQuery: "   ",
        startMessageId: 1,
        endMessageId: 10,
        jobOrder: "asc",
        fetchMessages: async () => [],
      }),
    ).rejects.toThrow(/searchQuery is required/i);
  });
});
