import type { JobOrder } from "@/lib/types";

export type SearchMessageLike = {
  id?: number;
};

export type SearchMessagesFetcher = (params: {
  search: string;
  minId: number;
  maxId: number;
  reverse: boolean;
}) => Promise<readonly SearchMessageLike[]>;

/**
 * Deduplicate positive integer IDs and order them for job processing.
 */
export function orderSearchMessageIds(ids: readonly number[], order: JobOrder): number[] {
  const unique = new Set<number>();
  for (const id of ids) {
    if (Number.isInteger(id) && id > 0) {
      unique.add(id);
    }
  }

  const values = [...unique];
  values.sort((left, right) => (order === "asc" ? left - right : right - left));
  return values;
}

/**
 * Collect message IDs matching a Telegram server-side search within [start, end].
 * GramJS minId/maxId are exclusive of the bound values, so we widen by one.
 */
export async function collectSearchMessageIds(input: {
  searchQuery: string;
  startMessageId: number;
  endMessageId: number;
  jobOrder: JobOrder;
  fetchMessages: SearchMessagesFetcher;
}): Promise<number[]> {
  const searchQuery = input.searchQuery.trim();
  if (!searchQuery) {
    throw new Error("searchQuery is required when collecting search message IDs");
  }
  if (input.startMessageId > input.endMessageId) {
    throw new Error("startMessageId must be less than or equal to endMessageId");
  }

  const messages = await input.fetchMessages({
    search: searchQuery,
    minId: Math.max(0, input.startMessageId - 1),
    maxId: input.endMessageId + 1,
    reverse: input.jobOrder === "asc",
  });

  const ids: number[] = [];
  for (const message of messages) {
    if (typeof message.id !== "number") {
      continue;
    }
    if (message.id < input.startMessageId || message.id > input.endMessageId) {
      continue;
    }
    ids.push(message.id);
  }

  return orderSearchMessageIds(ids, input.jobOrder);
}
