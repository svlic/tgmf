import { describe, expect, it } from "vitest";
import {
  filterMessagesByTextFilter,
  parseMessageTextFilterFromLists,
} from "@/lib/telegram/message-text-filter";

describe("filterMessagesByTextFilter", () => {
  it.each([
    "keywordWhitelist",
    "keywordBlacklist",
    "regexWhitelist",
    "regexBlacklist",
  ] as const)("removes zero-width characters before applying %s without changing messages", (rule) => {
    const isWhitelist = rule.endsWith("Whitelist");
    const messages = [
      ...["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"].map((character) => ({
        message: `${character} 广${character}告 ${character}`,
      })),
      { message: "广 告" },
      { message: "广\n告" },
      { message: "普通消息" },
    ];
    const originals = messages.map((message) => ({ ...message }));
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: [],
      keywordBlacklist: [],
      regexWhitelist: [],
      regexBlacklist: [],
      [rule]: [rule.startsWith("regex") ? "^广告$" : "广告"],
    });

    const result = filterMessagesByTextFilter(messages, filter);

    expect(result.allowed).toEqual(isWhitelist ? originals.slice(0, 5) : originals.slice(5));
    expect(result.skipped).toEqual(isWhitelist ? originals.slice(5) : originals.slice(0, 5));
    expect(messages).toEqual(originals);
  });

  it.each([
    { pattern: "(a+)+", allowed: ["abab", "keep"] },
    { pattern: "(ab*)*", allowed: ["abab", "keep"] },
    { pattern: "(a+){2,3}", allowed: ["abab", "keep"] },
    { pattern: "[", allowed: ["abab", "keep"] },
    { pattern: "(ab){2}", allowed: ["abab"] },
  ])("ignores unsafe or invalid regex but retains safe $pattern", ({ pattern, allowed }) => {
    const messages = [{ message: "abab" }, { message: "keep" }];
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: [], keywordBlacklist: [], regexWhitelist: [pattern], regexBlacklist: [],
    });
    expect(filterMessagesByTextFilter(messages, filter).allowed).toEqual(allowed.map((message) => ({ message })));
  });

  it("applies keyword blacklist before whitelist", () => {
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: ["keep"],
      keywordBlacklist: ["spam"],
      regexWhitelist: [],
      regexBlacklist: [],
    });

    const result = filterMessagesByTextFilter([{ message: "spam but keep" }, { message: "only keep" }], filter);

    expect(result.allowed).toEqual([{ message: "only keep" }]);
    expect(result.skipped).toEqual([{ message: "spam but keep" }]);
  });

  it("applies regex blacklist before whitelist", () => {
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: ["ok"],
      keywordBlacklist: [],
      regexWhitelist: [".*"],
      regexBlacklist: ["^blocked"],
    });

    const result = filterMessagesByTextFilter(
      [{ message: "blocked yet ok" }, { message: "fine ok" }],
      filter,
    );

    expect(result.allowed).toEqual([{ message: "fine ok" }]);
    expect(result.skipped).toEqual([{ message: "blocked yet ok" }]);
  });

  it("requires whitelist match when any whitelist rule is set", () => {
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: ["vip"],
      keywordBlacklist: [],
      regexWhitelist: [],
      regexBlacklist: [],
    });

    const result = filterMessagesByTextFilter([{ message: "hello" }, { message: "vip member" }], filter);

    expect(result.allowed).toEqual([{ message: "vip member" }]);
    expect(result.skipped).toEqual([{ message: "hello" }]);
  });
});
