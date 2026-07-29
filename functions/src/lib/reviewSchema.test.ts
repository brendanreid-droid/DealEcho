import { describe, it, expect } from "vitest";
import { normalizeDomain } from "./reviewSchema";

describe("normalizeDomain", () => {
  it("accepts a plain hostname", () => {
    expect(normalizeDomain("crownresorts.com.au")).toBe("crownresorts.com.au");
  });
  it("lowercases and trims", () => {
    expect(normalizeDomain("  Atlassian.COM  ")).toBe("atlassian.com");
  });
  it("strips a leading www.", () => {
    expect(normalizeDomain("www.auspost.com.au")).toBe("auspost.com.au");
  });
  it("accepts an http(s) URL and keeps only the host", () => {
    expect(normalizeDomain("https://www.victra.com/stores?id=3")).toBe("victra.com");
  });
  it("drops a port", () => {
    expect(normalizeDomain("example.com:8443")).toBe("example.com");
  });

  it("rejects a non-http scheme", () => {
    expect(normalizeDomain("javascript://evil.com")).toBe("");
    expect(normalizeDomain("data:text/html,x")).toBe("");
  });
  it("rejects anything carrying userinfo", () => {
    // "google.com@evil.com" resolves to evil.com in a browser.
    expect(normalizeDomain("https://google.com@evil.com")).toBe("");
    expect(normalizeDomain("google.com@evil.com")).toBe("");
  });
  it("rejects a bare hostname with no dot", () => {
    expect(normalizeDomain("localhost")).toBe("");
  });
  it("rejects a numeric or too-short TLD", () => {
    expect(normalizeDomain("192.168.0.1")).toBe("");
    expect(normalizeDomain("example.c")).toBe("");
  });
  it("rejects malformed labels", () => {
    expect(normalizeDomain("exa mple.com")).toBe("");
    expect(normalizeDomain("-bad.com")).toBe("");
    expect(normalizeDomain("bad-.com")).toBe("");
    expect(normalizeDomain("double..com")).toBe("");
  });
  it("rejects empty, oversized and non-string input", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("a".repeat(250) + ".com")).toBe("");
    expect(normalizeDomain(undefined)).toBe("");
    expect(normalizeDomain(42)).toBe("");
  });
});
