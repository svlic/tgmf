import { describe, expect, it } from "vitest";
import {
  classifyCopyDelivery,
  missingTargetMessageErrorReason,
  partitionForwardDeliveries,
} from "@/lib/telegram/transfer-outcome";

describe("partitionForwardDeliveries", () => {
  it("treats rows with a target message id as delivered", () => {
    const result = partitionForwardDeliveries([
      { sourceMessageId: 1, targetMessageId: 101 },
      { sourceMessageId: 2, targetMessageId: 102 },
    ]);

    expect(result.delivered).toEqual([
      { sourceMessageId: 1, targetMessageId: 101 },
      { sourceMessageId: 2, targetMessageId: 102 },
    ]);
    expect(result.undelivered).toEqual([]);
  });

  it("treats null target message ids as undelivered instead of success", () => {
    const result = partitionForwardDeliveries([
      { sourceMessageId: 10, targetMessageId: 1000 },
      { sourceMessageId: 11, targetMessageId: null },
      { sourceMessageId: 12, targetMessageId: null },
    ]);

    expect(result.delivered).toEqual([{ sourceMessageId: 10, targetMessageId: 1000 }]);
    expect(result.undelivered).toEqual([
      { sourceMessageId: 11, targetMessageId: null },
      { sourceMessageId: 12, targetMessageId: null },
    ]);
  });
});

describe("classifyCopyDelivery", () => {
  it("classifies a numeric target id as sent", () => {
    expect(classifyCopyDelivery(42)).toEqual({ outcome: "sent", targetMessageId: 42 });
  });

  it("classifies a missing target id as failed", () => {
    expect(classifyCopyDelivery(null)).toEqual({
      outcome: "failed",
      errorReason: missingTargetMessageErrorReason(),
    });
  });
});