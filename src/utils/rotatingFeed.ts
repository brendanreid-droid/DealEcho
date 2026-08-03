/**
 * rotatingFeed — show a slice of the recent-intelligence pool, and a different
 * slice next time.
 *
 * The home feed used to render every reviewed company, so the page grew without
 * limit and looked identical on every visit. Capping it fixes the length;
 * rotating the cap fixes the sameness, which matters most while the dataset is
 * small - nine companies read as a much livelier catalogue when a return visit
 * surfaces three that weren't there before.
 *
 * Rotation is a moving window over the pool rather than a shuffle. A shuffle
 * can deal the same hand twice by chance and can starve an item for several
 * visits; a window advancing by exactly the page size guarantees that every
 * company gets its turn, in order, and that consecutive visits share as little
 * as the pool allows.
 */

/** Cards on the home feed. A multiple of 3 so the lg:grid-cols-3 rows are full. */
export const HOME_FEED_SIZE = 6;

/**
 * How deep the rotation reaches. Rotating over *every* company ever reviewed
 * would eventually surface year-old accounts under a heading that says
 * "Recent intelligence", so the window only ever moves across this many of the
 * most recent.
 */
export const HOME_FEED_POOL = 18;

export const HOME_FEED_OFFSET_KEY = "dealecho_home_feed_offset";

/**
 * `size` items from `items`, starting at `offset` and wrapping past the end.
 *
 * The result keeps the pool's own ordering: the caller hands us a
 * newest-first list, and a wrapped window that returned 7,8,0,1 verbatim would
 * put older cards above newer ones under a "Recent" heading. Which cards show
 * rotates; the order they show in does not.
 */
export function rotateWindow<T>(items: T[], size: number, offset: number): T[] {
  const total = items.length;
  if (total === 0 || size <= 0) return [];
  if (total <= size) return items;

  const start = Number.isFinite(offset) ? ((offset % total) + total) % total : 0;

  const picked = new Set<number>();
  for (let i = 0; i < size; i++) picked.add((start + i) % total);

  return items.filter((_, i) => picked.has(i));
}

/** The stored offset. Reading never advances it, so a re-render is stable. */
export function readFeedOffset(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = Number(raw);
    return raw !== null && Number.isFinite(parsed) ? parsed : 0;
  } catch (e) {
    // Private mode, blocked storage, no window at all: rotation is a nicety,
    // never a reason to fail a render. Everyone just gets the newest slice.
    return 0;
  }
}

/**
 * Moves the window on by `step` for the *next* visit. localStorage rather than
 * sessionStorage on purpose: "come back to the page tomorrow and it looks
 * different" is the whole point, and sessionStorage dies with the tab.
 */
export function advanceFeedOffset(key: string, step: number): void {
  try {
    localStorage.setItem(key, String(readFeedOffset(key) + step));
  } catch (e) {
    // Same as above - a feed that cannot remember its place still renders.
  }
}
