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
    const hiddenCharacters = [
      "\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF",
      "\uFE0E", "\uFE0F", "\u{E0100}", "\u{E01EF}", // Variation selectors.
      "\u034F", "\u00AD", "\u061C", "\u180E", // Grapheme joiner, soft hyphen, format controls.
      "\u200E", "\u202E", "\u2066", "\u2069", // Direction controls.
      "\u115F", "\u3164", "\uFFA0", "\u{E0061}", // Fillers and emoji tags.
      "\u0600", "\u{13430}", "\u{1D173}", // Other Unicode format controls.
      "\u0000", "\u0008", "\u001B", "\u007F", "\u009F", // Non-whitespace controls.
    ];
    const matchingMessages = hiddenCharacters.map((character) => ({
      message: `${character} 广${character}告 ${character}`,
    }));
    const otherMessages = [
      { message: "广 告" },
      { message: "广\n告" },
      { message: "广\t告" },
      { message: "广\r\n告" },
      { message: "广\u00A0告" },
      { message: "广\u0301告" }, // Visible combining accents are not stripped.
      { message: "普通消息" },
    ];
    const messages = [...matchingMessages, ...otherMessages];
    const originals = messages.map((message) => ({ ...message }));
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: [],
      keywordBlacklist: [],
      regexWhitelist: [],
      regexBlacklist: [],
      [rule]: [rule.startsWith("regex") ? "^广告$" : "广告"],
    });

    const result = filterMessagesByTextFilter(messages, filter);

    expect(result.allowed).toEqual(isWhitelist ? matchingMessages : otherMessages);
    expect(result.skipped).toEqual(isWhitelist ? otherMessages : matchingMessages);
    expect(messages).toEqual(originals);
  });

  it("blocks the reported caption with interspersed variation selectors and joiners", () => {
    const blocked = { message: "能否\uFE05去其他\uFE04省份\uFE0E:可以\uFE03\u2060\u200C\u034F" };
    const allowed = { message: "能否去其他省份:不可以" };
    const filter = parseMessageTextFilterFromLists({
      keywordWhitelist: [], keywordBlacklist: [], regexWhitelist: [],
      regexBlacklist: ["省份\\s*[:：]\\s*[是行能可🉑o]"],
    });

    const result = filterMessagesByTextFilter([blocked, allowed], filter);

    expect(result.skipped).toEqual([blocked]);
    expect(result.allowed).toEqual([allowed]);
    expect(blocked.message).toBe("能否\uFE05去其他\uFE04省份\uFE0E:可以\uFE03\u2060\u200C\u034F");
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
