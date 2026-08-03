import { describe, it, expect, beforeEach } from "vitest";
import {
  rotateWindow,
  readFeedOffset,
  advanceFeedOffset,
  HOME_FEED_SIZE,
  HOME_FEED_POOL,
} from "./rotatingFeed";

const KEY = "test_feed_offset";
const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

describe("rotateWindow", () => {
  it("takes a window of the requested size", () => {
    expect(rotateWindow(items, 6, 0)).toHaveLength(6);
  });

  it("returns everything when there is nothing to rotate", () => {
    expect(rotateWindow(["a", "b"], 6, 3)).toEqual(["a", "b"]);
  });

  it("returns [] for an empty pool", () => {
    expect(rotateWindow([], 6, 2)).toEqual([]);
  });

  it("shows a different set at a different offset", () => {
    const first = rotateWindow(items, 6, 0);
    const second = rotateWindow(items, 6, 6);
    expect(second).not.toEqual(first);
    // 9 items, 6 shown: the three the first visit missed must all be present.
    expect(second).toEqual(expect.arrayContaining(["g", "h", "i"]));
  });

  it("wraps past the end rather than running short", () => {
    expect(rotateWindow(items, 6, 6)).toHaveLength(6);
  });

  it("never repeats an item within one window", () => {
    const window = rotateWindow(items, 6, 7);
    expect(new Set(window).size).toBe(window.length);
  });

  // The section is called "Recent intelligence", so a wrapped window must not
  // put older cards above newer ones - only which cards show should change.
  it("keeps the pool's own order, so the newest still lead", () => {
    expect(rotateWindow(items, 6, 6)).toEqual(["a", "b", "c", "g", "h", "i"]);
  });

  it("survives a nonsense offset", () => {
    expect(rotateWindow(items, 6, -4)).toHaveLength(6);
    expect(rotateWindow(items, 6, Number.NaN)).toEqual(rotateWindow(items, 6, 0));
  });

  it("covers the whole pool across successive visits", () => {
    const seen = new Set([
      ...rotateWindow(items, 6, 0),
      ...rotateWindow(items, 6, 6),
    ]);
    expect(seen.size).toBe(items.length);
  });
});

describe("feed offset storage", () => {
  beforeEach(() => localStorage.clear());

  it("starts at zero", () => {
    expect(readFeedOffset(KEY)).toBe(0);
  });

  it("advances by the step, and reading does not advance", () => {
    advanceFeedOffset(KEY, 6);
    expect(readFeedOffset(KEY)).toBe(6);
    expect(readFeedOffset(KEY)).toBe(6);
  });

  it("keeps advancing across visits", () => {
    advanceFeedOffset(KEY, 6);
    advanceFeedOffset(KEY, 6);
    expect(readFeedOffset(KEY)).toBe(12);
  });

  it("treats a corrupt stored value as zero", () => {
    localStorage.setItem(KEY, "not a number");
    expect(readFeedOffset(KEY)).toBe(0);
  });

  it("is independent per key", () => {
    advanceFeedOffset(KEY, 6);
    expect(readFeedOffset("other_feed_offset")).toBe(0);
  });
});

describe("home feed constants", () => {
  it("shows fewer cards than the pool it draws from, or nothing rotates", () => {
    expect(HOME_FEED_SIZE).toBeLessThan(HOME_FEED_POOL);
  });

  it("fills whole rows of three", () => {
    expect(HOME_FEED_SIZE % 3).toBe(0);
  });
});
