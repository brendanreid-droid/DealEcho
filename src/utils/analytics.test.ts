import { describe, it, expect, vi, beforeEach } from "vitest";

const logEvent = vi.fn();
vi.mock("firebase/analytics", () => ({
  isSupported: vi.fn().mockResolvedValue(true),
  getAnalytics: vi.fn().mockReturnValue({ app: "stub" }),
  logEvent: (...args: unknown[]) => logEvent(...args),
}));
vi.mock("../firebase/config", () => ({ default: {} }));

// Consent is mocked per-test so we can assert analytics only fires on opt-in.
const consent = { analytics: true, marketing: true };
vi.mock("./consent", () => ({ getConsent: () => (consent.analytics === null ? null : consent) }));

describe("track", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-TEST123");
    logEvent.mockClear();
    consent.analytics = true;
    consent.marketing = true;
    vi.resetModules();
  });

  it("logs the event with params when analytics is consented and supported", async () => {
    const { track } = await import("./analytics");
    await track("page_view", { page_path: "/pricing" });
    expect(logEvent).toHaveBeenCalledWith(
      { app: "stub" },
      "page_view",
      { page_path: "/pricing" },
    );
  });

  it("does NOT initialise analytics or log when analytics consent is absent", async () => {
    consent.analytics = false;
    const { track } = await import("./analytics");
    await track("page_view", { page_path: "/pricing" });
    expect(logEvent).not.toHaveBeenCalled();
  });
});
