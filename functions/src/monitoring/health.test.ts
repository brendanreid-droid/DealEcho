import { describe, it, expect } from "vitest";
import {
  WEBHOOK_SILENCE_MS,
  STUCK_REWARDING_MS,
  isWebhookSilent,
  hoursSince,
  isStuckRewarding,
} from "./health";

const now = new Date("2026-07-29T12:00:00.000Z");
const agoMs = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("isWebhookSilent", () => {
  it("is quiet when a webhook succeeded recently", () => {
    expect(isWebhookSilent(agoMs(2 * 3_600_000), now)).toBe(false);
  });

  it("is quiet just inside the threshold", () => {
    expect(isWebhookSilent(agoMs(WEBHOOK_SILENCE_MS - 60_000), now)).toBe(false);
  });

  it("alerts just outside the threshold", () => {
    expect(isWebhookSilent(agoMs(WEBHOOK_SILENCE_MS + 60_000), now)).toBe(true);
  });

  it("alerts on the two-month outage that actually happened", () => {
    expect(isWebhookSilent("2026-05-26T00:34:27.815Z", now)).toBe(true);
  });

  it("alerts when there has never been a successful webhook", () => {
    expect(isWebhookSilent(null, now)).toBe(true);
  });

  it("alerts on an unparseable timestamp rather than assuming health", () => {
    expect(isWebhookSilent("not-a-date", now)).toBe(true);
  });
});

describe("hoursSince", () => {
  it("counts whole hours", () => {
    expect(hoursSince(agoMs(3 * 3_600_000), now)).toBe(3);
    expect(hoursSince(agoMs(90 * 60_000), now)).toBe(1);
  });

  it("returns null for missing or unparseable input", () => {
    expect(hoursSince(null, now)).toBeNull();
    expect(hoursSince("nope", now)).toBeNull();
  });
});

describe("isStuckRewarding", () => {
  it("leaves a payout that just started alone", () => {
    expect(isStuckRewarding(agoMs(30_000), now)).toBe(false);
  });

  it("flags one that has sat there past the threshold", () => {
    expect(isStuckRewarding(agoMs(STUCK_REWARDING_MS + 60_000), now)).toBe(true);
  });

  it("flags a missing timestamp rather than assuming health", () => {
    expect(isStuckRewarding(undefined, now)).toBe(true);
  });
});
