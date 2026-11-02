import { describe, expect, it } from "vitest";
import { webNavigationCopy } from "./navigation";

describe("website navigation credentials", () => {
  it("copies the account when both account and password exist", () => {
    expect(
      webNavigationCopy({ username: "user@example.com", password: "secret" }),
    ).toEqual({ label: "账号", value: "user@example.com" });
  });
  it("copies the password when no account exists", () => {
    expect(webNavigationCopy({ username: "", password: "secret" })).toEqual({
      label: "密码",
      value: "secret",
    });
  });
  it("copies an account-only credential and leaves the clipboard alone without usable credentials", () => {
    expect(webNavigationCopy({ username: "user" })).toEqual({
      label: "账号",
      value: "user",
    });
    expect(webNavigationCopy({})).toBeNull();
    expect(webNavigationCopy(undefined)).toBeNull();
  });
});
