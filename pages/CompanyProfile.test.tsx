import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CompanyProfile from "./CompanyProfile";
import { Review } from "../types";

// Layer B is the only network call on this page. Stub it so the spine tests
// stay offline; the panel itself is covered by ThemeList's own suite.
vi.mock("../services/accountThemes", () => ({
  getAccountThemes: vi.fn().mockResolvedValue([]),
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
  it("shows flags gate and evidence to logged-in free users, but gates the brief", async () => {
    renderPage(false);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText(/unlock \d+ flags/i)).toBeInTheDocument();
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
  it("mounts the mechanics panel and the questions it derives for Pro users", async () => {
    renderBrief(true);

    // Layer A: gated on getDealMechanics returning non-null, which needs 3+ reviews.
    expect(await screen.findByRole("heading", { name: /How this buyer buys/ })).toBeInTheDocument();
    expect(screen.getByText("6-12 Months")).toBeInTheDocument();
    expect(screen.getByText("Early (before shortlist)")).toBeInTheDocument();

    // Layer C: the security-review rule fired off the repeated friction event,
    // and its rationale carries the real denominator through the memo chain.
    expect(screen.getByRole("heading", { name: /Ask this account/ })).toBeInTheDocument();
    expect(screen.getByText(/Which security review tier/)).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 sellers hit a security questionnaire/)).toBeInTheDocument();
  });

  it("gates both panels behind Sales Pro", async () => {
    renderBrief(false);
    expect(await screen.findByText(/Unlock deal mechanics/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /How this buyer buys/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Ask this account/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Which security review tier/)).not.toBeInTheDocument();
  });
});
