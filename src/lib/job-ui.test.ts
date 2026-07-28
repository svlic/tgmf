import { describe, expect, it } from "vitest";
import { formatMessageBounds } from "@/lib/job-ui";

describe("formatMessageBounds", () => {
  it.each([
    [0, 0, "All matching messages"],
    [10, 0, "From ID 10"],
    [0, 50, "Through ID 50"],
    [10, 50, "10–50"],
  ])("formats search bounds %i–%i as %s", (startMessageId, endMessageId, expected) => {
    expect(formatMessageBounds("search", startMessageId, endMessageId)).toBe(expected);
  });

  it("formats range bounds as an inclusive numeric range", () => {
    expect(formatMessageBounds("range", 10, 50)).toBe("10–50");
  });
});
