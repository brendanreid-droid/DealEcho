import { describe, it, expect } from "vitest";
import { toOwnDomainActionLink } from "./authLinks";

const FIREBASE_LINK =
  "https://dealecho-io-sales-intel-hub.firebaseapp.com/__/auth/action" +
  "?mode=resetPassword&oobCode=ABC-123_xyz&apiKey=AIzaSyFake&continueUrl=https%3A%2F%2Fwww.dealecho.io&lang=en";

describe("toOwnDomainActionLink", () => {
  it("moves the link onto our own domain", () => {
    expect(toOwnDomainActionLink(FIREBASE_LINK)).toBe(
      "https://www.dealecho.io/reset?oobCode=ABC-123_xyz",
    );
  });

  it("drops everything except the code", () => {
    // apiKey and continueUrl are Firebase-handler plumbing; our page needs
    // neither, and a shorter link is a less alarming one.
    const out = toOwnDomainActionLink(FIREBASE_LINK);
    expect(out).not.toContain("apiKey");
    expect(out).not.toContain("continueUrl");
    expect(out).not.toContain("firebaseapp.com");
  });

  it("percent-encodes a code containing URL-significant characters", () => {
    const link = "https://x.firebaseapp.com/__/auth/action?oobCode=a%2Bb%2Fc%3D";
    expect(toOwnDomainActionLink(link)).toBe("https://www.dealecho.io/reset?oobCode=a%2Bb%2Fc%3D");
  });

  it("accepts a different destination path", () => {
    expect(toOwnDomainActionLink(FIREBASE_LINK, "/activate")).toBe(
      "https://www.dealecho.io/activate?oobCode=ABC-123_xyz",
    );
  });

  it("returns the original link when there is no oobCode", () => {
    // Fails open: a worse email beats a broken account.
    const noCode = "https://x.firebaseapp.com/__/auth/action?mode=resetPassword";
    expect(toOwnDomainActionLink(noCode)).toBe(noCode);
  });

  it("returns the original when the link cannot be parsed", () => {
    expect(toOwnDomainActionLink("not a url")).toBe("not a url");
    expect(toOwnDomainActionLink("")).toBe("");
  });
});
