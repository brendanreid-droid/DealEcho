import { describe, it, expect } from "vitest";
import { extractContext } from "./extractContext";

function fakeWin(hostname: string, selectionText: string): Window {
  return {
    location: { hostname } as Location,
    getSelection: () => ({ toString: () => selectionText }) as Selection,
  } as unknown as Window;
}

describe("extractContext", () => {
  it("captures hostname and trimmed selection", () => {
    const ctx = extractContext(fakeWin("www.acme.com", "  Datadog Inc  "), 1000);
    expect(ctx.hostname).toBe("www.acme.com");
    expect(ctx.selection).toBe("Datadog Inc");
    expect(ctx.capturedAt).toBe(1000);
  });

  it("returns empty selection when nothing is highlighted", () => {
    const ctx = extractContext(fakeWin("acme.com", ""), 5);
    expect(ctx.selection).toBe("");
  });

  it("tolerates a null selection", () => {
    const win = { location: { hostname: "acme.com" }, getSelection: () => null } as unknown as Window;
    const ctx = extractContext(win, 5);
    expect(ctx.selection).toBe("");
    expect(ctx.hostname).toBe("acme.com");
  });
});
