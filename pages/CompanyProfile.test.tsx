import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CompanyProfile from "./CompanyProfile";
import { Review } from "../types";

vi.mock("../services/geminiService", () => ({
  getAICompanyPersona: vi.fn().mockResolvedValue({
    summary: "Technical-led account.", keyTraits: [], strategicAdvice: "", teamPlaybooks: [],
    meddpicc: { metrics: "m", economicBuyer: "CFO veto", decisionCriteria: "c", decisionProcess: "p",
      paperProcess: "MSA", identifyPain: "pain", champion: "VP Eng", competition: "incumbent" },
  }),
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
  it("shows the verdict and flags to free users but gates evidence", async () => {
    renderPage(false);
    expect(await screen.findByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText(/unlock \d+ flags/i)).toBeInTheDocument();
    expect(screen.queryByText(/They ghosted us/)).not.toBeInTheDocument();
  });

  it("shows evidence and playbook to Pro users", async () => {
    renderPage(true);
    expect(await screen.findByText(/They ghosted us/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("CFO veto")).toBeInTheDocument());
  });
});
