import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CompanyProfile from "./CompanyProfile";
import { Review } from "../types";

// The free-text flags are the only network call on this page. Stub them so the
// spine tests stay offline; the structured flags carry the panel without them.
vi.mock("../services/aiFlags", () => ({
  getAiFlags: vi.fn().mockResolvedValue([]),
}));

const review: Review = {
  id: "r1", companyId: "comp-1", companyName: "Snowflake", userId: "u1", userName: "Verified",
  currency: "USD", tcvBracket: "$50k - $100k", cycleDuration: "3-6 Months", status: "Lost",
  isTender: false, buyingTeam: ["Procurement"], location: "US",
  communicationRating: 1, negotiationLevel: 2, timeWasterLevel: 2, clarityOfScope: 2,
  industry: "Data", country: "US", content: "They ghosted us after the POC.",
  createdAt: "2026-03-01T00:00:00.000Z",
};

const company = { id: "comp-1", name: "Snowflake", industry: "Data", country: "US" };

function renderPage(isPaid: boolean) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/company/comp-1", state: { company } }]}>
      <CompanyProfile
        user={{ id: "u1" } as any}
        isPaid={isPaid}
        onSignInClick={() => {}}
        reviews={[review]}
        allTrackedIds={[]}
        onToggleTrack={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("CompanyProfile spine", () => {
  it("shows the flags section and evidence to logged-in free users, but gates the brief", async () => {
    renderPage(false);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    // One review is below MIN_MECHANICS_REVIEWS, so there is nothing to flag -
    // the section still renders, it just says so.
    expect(screen.getByRole("heading", { name: /^Flags$/ })).toBeInTheDocument();
    expect(screen.getByText(/No red flags detected/)).toBeInTheDocument();
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    expect(screen.getByText(/Unlock deal mechanics/)).toBeInTheDocument();
  });

  it("shows evidence and drops the upsell for Pro users", async () => {
    renderPage(true);
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/Unlock deal mechanics/)).not.toBeInTheDocument(),
    );
  });

  it("hides evidence from logged-out visitors", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/company/comp-1", state: { company } }]}>
        <CompanyProfile
          user={null}
          isPaid={false}
          onSignInClick={() => {}}
          reviews={[review]}
          allTrackedIds={[]}
          onToggleTrack={() => {}}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.queryByText(/They ghosted us/)).not.toBeInTheDocument();
  });
});

/**
 * Layer A floors at MIN_MECHANICS_REVIEWS (3), and the security-review rule
 * needs the friction event on at least 2 reports, so the brief only has
 * anything to render above those thresholds. The third review carries an empty
 * frictionEvents array - that is a real "no friction observed" answer, so it
 * counts toward the denominator and the rationale reads "2 of 3".
 */
const briefReviews: Review[] = [
  {
    ...review,
    id: "r1",
    content: "Security review ran after the commercial evaluation, not alongside it.",
    cycleDuration: "6-12 Months",
    frictionEvents: ["Security questionnaire", "Legal redlines on MSA"],
    procurementEntry: "Early (before shortlist)",
    paymentTerms: "Net 60",
    stakeholderCount: "6-10",
    wentDark: true,
    closeSlippage: "Pushed 3+ times",
    verbalToSignature: "< 1 Week",
  },
  {
    ...review,
    id: "r2",
    userId: "u2",
    status: "Won",
    content: "Long questionnaire but a clean close once legal signed off.",
    cycleDuration: "6-12 Months",
    frictionEvents: ["Security questionnaire"],
    procurementEntry: "Early (before shortlist)",
    paymentTerms: "Net 60",
    stakeholderCount: "6-10",
    wentDark: false,
    closeSlippage: "Never pushed",
    verbalToSignature: "< 1 Week",
  },
  {
    ...review,
    id: "r3",
    userId: "u3",
    content: "Straightforward renewal with no procurement gauntlet.",
    frictionEvents: [],
  },
];

function renderBrief(isPaid: boolean) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/company/comp-1", state: { company } }]}>
      <CompanyProfile
        user={{ id: "u1" } as any}
        isPaid={isPaid}
        onSignInClick={() => {}}
        reviews={briefReviews}
        allTrackedIds={[]}
        onToggleTrack={() => {}}
      />
    </MemoryRouter>,
  );
}

describe("CompanyProfile deal mechanics brief", () => {
  it("mounts the mechanics panel and the flags it derives for Pro users", async () => {
    renderBrief(true);

    // Layer A: gated on getDealMechanics returning non-null, which needs 3+ reviews.
    expect(await screen.findByRole("heading", { name: /How this buyer buys/ })).toBeInTheDocument();
    expect(screen.getByText("6-12 Months")).toBeInTheDocument();
    expect(screen.getByText("Early (before shortlist)")).toBeInTheDocument();

    // The flag engine: the security-review rule fired off the repeated friction
    // event, and its stat carries the real denominator through the memo chain.
    expect(screen.getByRole("heading", { name: /^Flags$/ })).toBeInTheDocument();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 deals")).toBeInTheDocument();

    // Both reports with a verbal-to-signature answer said "< 1 Week", so the
    // strength group renders alongside the risk group for Pro users.
    expect(screen.getByText("In your favour")).toBeInTheDocument();
    expect(screen.getByText("Signature follows the verbal quickly")).toBeInTheDocument();
    expect(screen.getByText("< 1 Week typical, across 2 reports")).toBeInTheDocument();
  });

  it("gates the mechanics panel and the flag detail behind Sales Pro", async () => {
    renderBrief(false);
    expect(await screen.findByText(/Unlock deal mechanics/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /How this buyer buys/ })).not.toBeInTheDocument();

    // The flags themselves stay visible to free users - the upsell is the point
    // of the section - but the stats and qualification points do not.
    expect(screen.getByRole("heading", { name: /^Flags$/ })).toBeInTheDocument();
    expect(screen.getByText("Security review is a gate")).toBeInTheDocument();
    expect(screen.getByText(/Unlock \d+ flags with Sales Pro/)).toBeInTheDocument();
    expect(screen.queryByText("2 of 3 deals")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    // The strength group and its label are the advert for Sales Pro too - a
    // free user should see that the product has real "good news" data, not
    // just a complaints board - but the stat and qualification points behind
    // it stay gated exactly like the risk group's.
    expect(screen.getByText("In your favour")).toBeInTheDocument();
    expect(screen.getByText("Signature follows the verbal quickly")).toBeInTheDocument();
    expect(screen.queryByText("< 1 Week typical, across 2 reports")).not.toBeInTheDocument();
  });
});

describe("CompanyProfile flag evidence deep-link", () => {
  it("narrows the evidence list to the reviews backing a flag, then restores it", async () => {
    renderBrief(true);
    await screen.findByRole("heading", { name: /^Flags$/ });

    // All three reviews are listed before any flag is clicked through.
    expect(screen.getByText("3 verified reports")).toBeInTheDocument();

    // The security flag is backed by the two reviews reporting a questionnaire.
    fireEvent.click(screen.getByRole("button", { name: "2 reports" }));

    expect(screen.getByText("2 verified reports")).toBeInTheDocument();
    expect(screen.getByText(/Showing the 2 reports behind one flag/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByText("3 verified reports")).toBeInTheDocument();
    expect(screen.queryByText(/Showing the 2 reports/)).not.toBeInTheDocument();
  });
});
