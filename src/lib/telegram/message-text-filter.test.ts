import { describe, expect, it } from "vitest";
import {
  filterMessagesByTextFilter,
  parseMessageTextFilterFromLists,
} from "@/lib/telegram/message-text-filter";

describe("filterMessagesByTextFilter", () => {
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