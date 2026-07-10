import { MAX_FILTER_ITEMS } from "@/lib/filter-limits";
import type { SyncJobRow } from "@/lib/types";

const MAX_REGEX_TEXT_LENGTH = 4096;

export type MessageTextFilter = {
  keywordWhitelist: string[];
  keywordBlacklist: string[];
  regexWhitelist: RegExp[];
  regexBlacklist: RegExp[];
};

export type TextFilterableMessage = {
  message?: string;
};

function parseStringList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_FILTER_ITEMS);
  } catch {
    return [];
  }
}

function hasNestedQuantifier(pattern: string) {
  return /\([^)]*[+*][^)]*\)\s*(?:[+*]|\{\d*,?\d*\})/.test(pattern);
}

function compileRegexFilters(patterns: string[]) {
  const filters: RegExp[] = [];
  for (const pattern of patterns) {
    if (hasNestedQuantifier(pattern)) {
      continue;
    }

    try {
      filters.push(new RegExp(pattern, "i"));
    } catch {
      continue;
    }
  }

  return filters;
}

export function parseMessageTextFilterFromLists(input: {
  keywordWhitelist: string[];
  keywordBlacklist: string[];
  regexWhitelist: string[];
  regexBlacklist: string[];
}): MessageTextFilter {
  return {
    keywordWhitelist: input.keywordWhitelist.map((keyword) => keyword.toLowerCase()),
    keywordBlacklist: input.keywordBlacklist.map((keyword) => keyword.toLowerCase()),
    regexWhitelist: compileRegexFilters(input.regexWhitelist),
    regexBlacklist: compileRegexFilters(input.regexBlacklist),
  };
}

export function parseMessageTextFilterFromJob(job: SyncJobRow): MessageTextFilter {
  return parseMessageTextFilterFromLists({
    keywordWhitelist: parseStringList(job.keyword_whitelist),
    keywordBlacklist: parseStringList(job.keyword_blacklist),
    regexWhitelist: parseStringList(job.regex_whitelist),
    regexBlacklist: parseStringList(job.regex_blacklist),
  });
}

function getMessageText(message: TextFilterableMessage) {
  return (message.message ?? "").trim();
}

function matchesAnyKeyword(text: string, keywords: string[]) {
  if (keywords.length === 0) {
    return false;
  }

  const normalizedText = text.toLowerCase();
  return keywords.some((keyword) => normalizedText.includes(keyword));
}

function matchesAnyRegex(text: string, patterns: RegExp[]) {
  const matchText = text.slice(0, MAX_REGEX_TEXT_LENGTH);

  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(matchText);
  });
}

function isMessageAllowedByTextFilter(message: TextFilterableMessage, filter: MessageTextFilter) {
  const text = getMessageText(message);
  if (matchesAnyKeyword(text, filter.keywordBlacklist) || matchesAnyRegex(text, filter.regexBlacklist)) {
    return false;
  }

  const hasWhitelist = filter.keywordWhitelist.length > 0 || filter.regexWhitelist.length > 0;
  if (!hasWhitelist) {
    return true;
  }

  return matchesAnyKeyword(text, filter.keywordWhitelist) || matchesAnyRegex(text, filter.regexWhitelist);
}

export function filterMessagesByTextFilter<T extends TextFilterableMessage>(messages: T[], filter: MessageTextFilter) {
  const allowed: T[] = [];
  const skipped: T[] = [];

  for (const message of messages) {
    if (isMessageAllowedByTextFilter(message, filter)) {
      allowed.push(message);
    } else {
      skipped.push(message);
    }
  }

  return { allowed, skipped };
}