import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const callable = vi.fn();

vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => callable,
}));

import { searchCompanies, SEARCH_CACHE_PREFIX, SEARCH_CACHE_TTL_MS } from "./geminiService";

const QUERY = "Country Road Group";
const KEY = `${SEARCH_CACHE_PREFIX}country road group`;

function respondWith(results: any[]) {
  callable.mockResolvedValue({ data: { results } });
}

describe("searchCompanies session cache", () => {
  beforeEach(() => {
    sessionStorage.clear();
    callable.mockReset();
    respondWith([{ name: "Country Road Group", domain: "countryroadgroup.com.au" }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the function once, then serves the cache", async () => {
    const first = await searchCompanies(QUERY);
    const second = await searchCompanies(QUERY);

    expect(callable).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("stores under a versioned key, so a deploy that bumps the version misses", () => {
    // The key the pre-version build wrote to. Its contents must not be trusted:
    // they hold values derived by the old code (a logoUrl, in the case that
    // prompted this), and a shipped fix would otherwise never reach an open tab.
    expect(KEY).not.toBe(`dealecho_search_cache:country road group`);
  });

  it("ignores a cache entry written by an older version of the app", async () => {
    sessionStorage.setItem(
      "dealecho_search_cache:country road group",
      JSON.stringify([{ name: "Stale Co", logoUrl: "https://example.com/dead.png" }]),
    );

    const results = await searchCompanies(QUERY);

    expect(callable).toHaveBeenCalledTimes(1);
    expect(results[0].name).toBe("Country Road Group");
  });

  it("ignores an entry that is not a cache envelope rather than throwing", async () => {
    sessionStorage.setItem(KEY, JSON.stringify([{ name: "Bare Array Co" }]));

    const results = await searchCompanies(QUERY);

    expect(callable).toHaveBeenCalledTimes(1);
    expect(results[0].name).toBe("Country Road Group");
  });

  it("refetches once the entry is older than the TTL", async () => {
    const start = Date.UTC(2026, 7, 3, 9, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(start);
    await searchCompanies(QUERY);

    vi.setSystemTime(start + SEARCH_CACHE_TTL_MS + 1);
    await searchCompanies(QUERY);

    expect(callable).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the cache up to the TTL", async () => {
    const start = Date.UTC(2026, 7, 3, 9, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(start);
    await searchCompanies(QUERY);

    vi.setSystemTime(start + SEARCH_CACHE_TTL_MS - 1000);
    await searchCompanies(QUERY);

    expect(callable).toHaveBeenCalledTimes(1);
  });

  it("drops an expired entry instead of leaving it to rot in storage", async () => {
    const start = Date.UTC(2026, 7, 3, 9, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(start);
    await searchCompanies(QUERY);

    vi.setSystemTime(start + SEARCH_CACHE_TTL_MS + 1);
    callable.mockRejectedValueOnce(new Error("offline"));
    const results = await searchCompanies(QUERY);

    // The failed refetch returns nothing AND the stale entry is gone, so the
    // next attempt calls the function again rather than resurrecting old data.
    expect(results).toEqual([]);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
