import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import { HOME_FEED_SIZE } from "../src/utils/rotatingFeed";

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {},
       addListener() {}, removeListener() {}, onchange: null,
       dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

const summary: ReviewSummary = {
  reviewId: "s1", companyId: "comp-1", companyName: "Snowflake", industry: "Data",
  location: "US", country: "US", status: "Won", createdAt: "2026-03-01T00:00:00.000Z",
  excerpt: "Technical-led, procurement-heavy.", communicationRating: 4,
  negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
};

describe("Home", () => {
  it("renders the hero headline and primary CTA, and lists a company", () => {
    render(
      <MemoryRouter>
        <Home user={null} isPaid={false} onSignInClick={() => {}} reviewSummaries={[summary]} trackedIds={[]} onToggleTrack={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/An intelligence layer/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Start your 30-day trial/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
  });

  it("uses the corrected hero copy", () => {
    render(
      <MemoryRouter>
        <Home user={null} isPaid={false} onSignInClick={() => {}} reviewSummaries={[summary]} trackedIds={[]} onToggleTrack={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "An intelligence layer for your sales cycle",
    );
    expect(
      screen.getByText(/Real intelligence from enterprise sales cycles/),
    ).toBeInTheDocument();
  });
});

describe("Home recent-intelligence feed", () => {
  // Nine companies, newest first, matching the live dataset this was built for.
  const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India"];
  const manySummaries: ReviewSummary[] = NAMES.map((name, i) => ({
    ...summary,
    reviewId: `s-${name}`,
    companyId: `comp-${name}`,
    companyName: name,
    // Descending dates so NAMES[0] is the most recent.
    createdAt: new Date(Date.UTC(2026, 6, 30 - i)).toISOString(),
  }));

  const renderHome = () =>
    render(
      <MemoryRouter>
        <Home user={null} isPaid={false} onSignInClick={() => {}} reviewSummaries={manySummaries} trackedIds={[]} onToggleTrack={() => {}} />
      </MemoryRouter>,
    );

  const shownNames = () => NAMES.filter((n) => screen.queryByText(n) !== null);

  beforeEach(() => localStorage.clear());

  it("caps the feed instead of listing every company", () => {
    renderHome();
    expect(shownNames()).toHaveLength(HOME_FEED_SIZE);
  });

  it("leads with the newest accounts on a first visit", () => {
    renderHome();
    expect(shownNames()).toEqual(NAMES.slice(0, HOME_FEED_SIZE));
  });

  it("shows a different set on the next visit", () => {
    renderHome();
    const first = shownNames();
    cleanup();

    renderHome();
    const second = shownNames();

    expect(second).not.toEqual(first);
    expect(second).toHaveLength(HOME_FEED_SIZE);
    // The three the first visit had no room for must all appear.
    expect(second).toEqual(expect.arrayContaining(["Golf", "Hotel", "India"]));
  });

  it("shows every company across two visits", () => {
    renderHome();
    const first = shownNames();
    cleanup();
    renderHome();
    const seen = new Set([...first, ...shownNames()]);

    expect(seen.size).toBe(NAMES.length);
  });

  it("still renders when storage is unavailable", () => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      renderHome();
      expect(shownNames()).toHaveLength(HOME_FEED_SIZE);
    } finally {
      Storage.prototype.getItem = getItem;
    }
  });
});
