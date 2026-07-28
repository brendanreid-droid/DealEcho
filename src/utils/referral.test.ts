import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  REFERRAL_STORAGE_KEY,
  captureInviteToken,
  storedInviteToken,
  clearInviteToken,
} from "./referral";

describe("referral invite capture", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("captures a token from the query string", () => {
    window.history.replaceState({}, "", "/?invite=ABC123");
    captureInviteToken();
    expect(storedInviteToken()).toBe("ABC123");
  });

  it("strips the invite parameter from the URL so it is not re-shared", () => {
    window.history.replaceState({}, "", "/?invite=ABC123&utm_source=email");
    captureInviteToken();
    expect(window.location.search).not.toContain("invite=");
    expect(window.location.search).toContain("utm_source=email");
  });

  it("does nothing when there is no invite parameter", () => {
    window.history.replaceState({}, "", "/?utm_source=email");
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("ignores a token that is the wrong shape", () => {
    window.history.replaceState({}, "", "/?invite=" + "x".repeat(200));
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("ignores a token containing characters we never generate", () => {
    window.history.replaceState({}, "", "/?invite=abc%20def");
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("does not overwrite an already-captured token", () => {
    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token: "FIRST", capturedAt: Date.now() }),
    );
    window.history.replaceState({}, "", "/?invite=SECOND");
    captureInviteToken();
    expect(storedInviteToken()).toBe("FIRST");
  });

  it("expires a token older than 60 days", () => {
    const sixtyOneDaysAgo = Date.now() - 61 * 86_400_000;
    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token: "OLD", capturedAt: sixtyOneDaysAgo }),
    );
    expect(storedInviteToken()).toBeNull();
  });

  it("clears the stored token", () => {
    window.history.replaceState({}, "", "/?invite=ABC123");
    captureInviteToken();
    clearInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("survives corrupt localStorage content", () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "not json");
    expect(storedInviteToken()).toBeNull();
  });

  it("never throws when localStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => storedInviteToken()).not.toThrow();
    expect(storedInviteToken()).toBeNull();
    spy.mockRestore();
  });
});
