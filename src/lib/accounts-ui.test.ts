import { describe, expect, it } from "vitest";
import { loginStateVariant } from "@/lib/accounts-ui";

describe("loginStateVariant", () => {
  it("marks ready as green", () => {
    expect(loginStateVariant("ready")).toBe("green");
  });

  it("marks reauth_required and logged_out as red", () => {
    expect(loginStateVariant("reauth_required")).toBe("red");
    expect(loginStateVariant("logged_out")).toBe("red");
  });

  it("marks in-progress login states as amber", () => {
    expect(loginStateVariant("awaiting_code")).toBe("amber");
    expect(loginStateVariant("awaiting_password")).toBe("amber");
  });

  it("does not treat legacy failed string as a distinct red branch", () => {
    expect(loginStateVariant("failed")).toBe("amber");
  });
});