import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Search from "./Search";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";

vi.mock("../services/geminiService", () => ({
  searchCompanies: vi.fn().mockResolvedValue([]),
}));

const summary: ReviewSummary = {
  reviewId: "s1", companyId: "comp-1", companyName: "Snowflake", industry: "Data",
  location: "US", country: "US", status: "Won", createdAt: "2026-03-01T00:00:00.000Z",
  excerpt: "Technical-led, procurement-heavy.", communicationRating: 4,
  negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
};

function renderSearch(user: any) {
  return render(
    <MemoryRouter initialEntries={["/search?q=snow"]}>
      <Search
        user={user}
        isPaid={false}
        onSignInClick={() => {}}
        reviewSummaries={[summary]}
        trackedIds={[]}
        onToggleTrack={() => {}}
        isLoading={false}
      />
    </MemoryRouter>,
  );
}

describe("Search gating", () => {
  it("blurs metrics for logged-out visitors (shows sign-in lock)", async () => {
    renderSearch(null);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText("Sign in to view")).toBeInTheDocument();
  });

  it("shows metrics for logged-in users (no lock)", async () => {
    renderSearch({ id: "u1", name: "Sam" });
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.queryByText("Sign in to view")).not.toBeInTheDocument();
  });
});
