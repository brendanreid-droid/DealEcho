import { describe, it, expect, vi, beforeEach } from "vitest";

const logEvent = vi.fn();
vi.mock("firebase/analytics", () => ({
  isSupported: vi.fn().mockResolvedValue(true),
  getAnalytics: vi.fn().mockReturnValue({ app: "stub" }),
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("../firebase/config", () => ({ default: {} }));

describe("track", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-TEST123");
    logEvent.mockClear();
    vi.resetModules();
  });

  it("logs the event with params when analytics is supported", async () => {
    const { track } = await import("./analytics");
    await track("page_view", { page_path: "/pricing" });
    expect(logEvent).toHaveBeenCalledWith(
      { app: "stub" },
      "page_view",
      { page_path: "/pricing" },
    );
  });
});
