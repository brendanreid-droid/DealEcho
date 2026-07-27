import { describe, it, expect, beforeEach } from "vitest";
import {
  getConsent,
  setConsent,
  hasChoice,
  ACCEPT_ALL,
  NECESSARY_ONLY,
} from "./consent";

// jsdom starts each test with a clean document.cookie via resetModules? No —
// cookies persist within the jsdom document, so clear them explicitly.
function clearCookies() {
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

describe("consent", () => {
  beforeEach(clearCookies);

  it("returns null until a choice is made (signals show-the-banner)", () => {
    expect(getConsent()).toBeNull();
    expect(hasChoice()).toBe(false);
  });

  it("persists and reads back an accept-all choice", () => {
    setConsent(ACCEPT_ALL);
    expect(getConsent()).toEqual({ analytics: true, marketing: true });
    expect(hasChoice()).toBe(true);
  });

  it("persists a necessary-only choice as all-false", () => {
    setConsent(NECESSARY_ONLY);
    expect(getConsent()).toEqual({ analytics: false, marketing: false });
  });

  it("stores a partial choice", () => {
    setConsent({ analytics: true, marketing: false });
    expect(getConsent()).toEqual({ analytics: true, marketing: false });
  });

  it("treats a stale version cookie as no-choice", () => {
    document.cookie = `dealecho_consent=${encodeURIComponent(
      JSON.stringify({ v: 0, analytics: true, marketing: true }),
    )}; Path=/`;
    expect(getConsent()).toBeNull();
  });

  it("treats an unparseable cookie as no-choice, not a crash", () => {
    document.cookie = "dealecho_consent=not-json; Path=/";
    expect(getConsent()).toBeNull();
  });

  it("clears the attribution cookie when marketing is declined", () => {
    document.cookie = "dealecho_attribution=%7B%7D; Path=/";
    setConsent(NECESSARY_ONLY);
    expect(document.cookie).not.toContain("dealecho_attribution");
  });

  it("dispatches a consent-changed event on save", () => {
    let fired = false;
    const handler = () => {
      fired = true;
    };
    window.addEventListener("dealecho:consent-changed", handler);
    setConsent(ACCEPT_ALL);
    window.removeEventListener("dealecho:consent-changed", handler);
    expect(fired).toBe(true);
  });
});
