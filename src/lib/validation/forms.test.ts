import { describe, expect, it } from "vitest";
import { jobSchema } from "@/lib/validation/forms";

const baseJob = {
  accountId: "account",
  sourceChannelRef: "source",
  targetChannelRef: "target",
  jobOrder: "asc",
  mode: "forward",
  albumStrategy: "full_group",
};

describe("jobSchema message selection", () => {
  it("accepts empty message IDs for Telegram search", () => {
    const result = jobSchema.parse({
      ...baseJob,
      selection: "search",
      searchQuery: "keyword",
      startMessageId: "",
      endMessageId: "",
    });

    expect(result).toMatchObject({
      selection: "search",
      startMessageId: undefined,
      endMessageId: undefined,
    });
  });

  it("rejects empty message IDs for an ID range", () => {
    expect(() =>
      jobSchema.parse({
        ...baseJob,
        selection: "range",
        startMessageId: "",
        endMessageId: "",
      }),
    ).toThrow(/startMessageId is required/i);
  });

  it("trims whitespace from channel refs", () => {
    const result = jobSchema.parse({
      ...baseJob,
      sourceChannelRef: "  @source  ",
      targetChannelRef: "\t-100123\n",
      selection: "search",
      searchQuery: "keyword",
    });

    expect(result.sourceChannelRef).toBe("@source");
    expect(result.targetChannelRef).toBe("-100123");
  });
});
