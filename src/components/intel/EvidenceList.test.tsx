import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EvidenceList from "./EvidenceList";
import { Review } from "../../../types";

const review: Review = {
  id: "r1", companyId: "c1", companyName: "Acme", userId: "u1",
  userName: "Verified", currency: "USD", tcvBracket: "$50k - $100k",
  cycleDuration: "3-6 Months", status: "Won", isTender: false,
  buyingTeam: ["Procurement"], location: "US",
  communicationRating: 4, negotiationLevel: 3, timeWasterLevel: 5,
  clarityOfScope: 4, industry: "SaaS", country: "US",
  content: "Smooth, technical-led deal.", createdAt: "2026-03-01T00:00:00.000Z",
};

describe("EvidenceList", () => {
  it("renders review content and the count", () => {
    render(<EvidenceList reviews={[review]} />);
    expect(screen.getByText(/Smooth, technical-led deal\./)).toBeInTheDocument();
    expect(screen.getByText(/1 verified report/i)).toBeInTheDocument();
  });
});
