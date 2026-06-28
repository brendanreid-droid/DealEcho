import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewsView } from "./ReviewsView";
import { LookupResult } from "../lib/api";

const base: LookupResult = {
  matched: true,
  isPro: true,
  companyId: "c1",
  companyName: "Datadog Inc",
  summary: { companyId: "c1", companyName: "Datadog Inc", reviewCount: 4, rating: 3.5, healthIndex: 70 },
  persona: { summary: "Technical-led buyer." },
  recentReviews: [
    {
      id: "r1", companyName: "Datadog Inc", status: "Won", content: "Smooth deal.",
      createdAt: "2026-01-01", communicationRating: 4, negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
    },
  ],
};

describe("ReviewsView", () => {
  it("shows a no-match message when nothing matched", () => {
    render(<ReviewsView result={{ matched: false, isPro: true }} />);
    expect(screen.getByText(/no reviews yet/i)).toBeTruthy();
  });

  it("shows company name, rating and persona on a match", () => {
    render(<ReviewsView result={base} />);
    expect(screen.getByText(/datadog inc/i)).toBeTruthy();
    expect(screen.getByText(/technical-led buyer/i)).toBeTruthy();
    expect(screen.getByText(/70/)).toBeTruthy();
  });

  it("renders reviews for a Pro user", () => {
    render(<ReviewsView result={base} />);
    expect(screen.getByText(/smooth deal/i)).toBeTruthy();
  });

  it("shows an upgrade CTA instead of reviews for a non-Pro user", () => {
    render(<ReviewsView result={{ ...base, isPro: false, recentReviews: undefined }} />);
    expect(screen.queryByText(/smooth deal/i)).toBeNull();
    expect(screen.getByText(/upgrade/i)).toBeTruthy();
  });
});
