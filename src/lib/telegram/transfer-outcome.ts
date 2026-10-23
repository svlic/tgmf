export type ForwardDeliveryRow = {
  sourceMessageId: number;
  targetMessageId: number | null;
};

export type ForwardDeliveryPartition<T = ForwardDeliveryRow> = {
  delivered: T[];
  undelivered: T[];
};

export const MISSING_TARGET_MESSAGE_ERROR = "Telegram did not return a target message id";

export function partitionForwardDeliveries<T extends { targetMessageId: number | null }>(rows: readonly T[]): ForwardDeliveryPartition<T> {
  const delivered: T[] = [];
  const undelivered: T[] = [];

  for (const row of rows) {
    if (row.targetMessageId !== null) {
      delivered.push(row);
    } else {
      undelivered.push(row);
    }
  }

  return { delivered, undelivered };
}

export type CopyDeliveryClassification =
  | { outcome: "sent"; targetMessageId: number }
  | { outcome: "warn"; errorReason: string };

export function classifyCopyDelivery(targetMessageId: number | null): CopyDeliveryClassification {
  if (typeof targetMessageId === "number") {
    return { outcome: "sent", targetMessageId };
  }

  return { outcome: "warn", errorReason: MISSING_TARGET_MESSAGE_ERROR };
}
