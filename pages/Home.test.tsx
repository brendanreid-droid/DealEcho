import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";

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
