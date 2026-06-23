import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Playbook from "./Playbook";
import { CompanyPersona } from "../../../services/geminiService";

const persona: CompanyPersona = {
  summary: "Technical-led account.",
  keyTraits: [],
  strategicAdvice: "Win the architect.",
  teamPlaybooks: [],
  meddpicc: {
    metrics: "ROI on infra spend", economicBuyer: "CFO holds veto",
    decisionCriteria: "Security", decisionProcess: "Committee",
    paperProcess: "Custom MSA", identifyPain: "Cost overruns",
    champion: "VP Eng", competition: "Incumbent",
  },
};

describe("Playbook", () => {
  it("renders the MEDDPICC fields", () => {
    render(<Playbook persona={persona} />);
    expect(screen.getByText("CFO holds veto")).toBeInTheDocument();
    expect(screen.getByText("VP Eng")).toBeInTheDocument();
  });
});
