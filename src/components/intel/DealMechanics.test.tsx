import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DealMechanicsPanel from "./DealMechanics";
import { DealMechanics } from "../../../services/dealMechanics";

const mechanics: DealMechanics = {
  sampleSize: 9,
  friction: [
    { event: "Security questionnaire", count: 7, total: 9, reviewIds: ["a"] },
    { event: "Legal redlines on MSA", count: 6, total: 9, reviewIds: ["b"] },
  ],
  procurementEntry: { value: "Early (before shortlist)", count: 6, total: 8 },
  verbalToSignature: { value: "1-3 Months", count: 5, total: 8 },
  paymentTerms: { value: "Net 60", count: 5, total: 7 },
  stakeholderCount: { value: "6-10", count: 4, total: 8 },
  ghostRate: { count: 3, total: 9, reviewIds: ["a", "b", "c"] },
  slippageRate: { count: 4, total: 9, reviewIds: ["a"] },
  medianCycle: "6-12 Months",
  outcomeMix: [{ outcome: "Lost", count: 5 }, { outcome: "Won", count: 4 }],
};

describe("DealMechanicsPanel", () => {
  it("shows the friction gauntlet with counts out of the answering sample", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("Security questionnaire")).toBeInTheDocument();
    expect(screen.getByText("7 of 9")).toBeInTheDocument();
  });

  it("shows the modal stats", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("Early (before shortlist)")).toBeInTheDocument();
    expect(screen.getByText("Net 60")).toBeInTheDocument();
    expect(screen.getByText("6-12 Months")).toBeInTheDocument();
  });

  it("renders rates as percentages of the answering sample", () => {
    render(<DealMechanicsPanel mechanics={mechanics} />);
    expect(screen.getByText("33% of deals")).toBeInTheDocument(); // ghost 3/9
    expect(screen.getByText("44% of deals")).toBeInTheDocument(); // slippage 4/9
  });

  it("omits a stat entirely when there is no data for it", () => {
    render(<DealMechanicsPanel mechanics={{ ...mechanics, paymentTerms: null }} />);
    expect(screen.queryByText("Payment terms")).not.toBeInTheDocument();
  });

  it("omits the friction section when no friction was reported", () => {
    render(<DealMechanicsPanel mechanics={{ ...mechanics, friction: [] }} />);
    expect(screen.queryByText("Procurement gauntlet")).not.toBeInTheDocument();
  });
});
