import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuestionList from "./QuestionList";
import { QualificationQuestion } from "../../../services/qualificationQuestions";

const questions: QualificationQuestion[] = [
  {
    id: "security-review",
    question: "Which security review tier applies at our contract size?",
    askOf: "Security / InfoSec",
    stage: "Discovery",
    why: "7 of 9 sellers hit a security questionnaire at this account.",
    reviewIds: ["a", "b"],
    priority: 90,
    strength: 7 / 9,
  },
  {
    id: "ghosting",
    question: "If we do not hear from you for two weeks, who should we contact?",
    askOf: "Procurement",
    stage: "Evaluation",
    why: "The buyer went silent mid-cycle in 4 of 9 reported deals.",
    reviewIds: ["c"],
    priority: 85,
    strength: 4 / 9,
  },
];

describe("QuestionList", () => {
  beforeEach(() => localStorage.clear());

  it("renders each question with who to ask, when, and why", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText(/Which security review tier/)).toBeInTheDocument();
    expect(screen.getByText("Security / InfoSec")).toBeInTheDocument();
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText(/7 of 9 sellers/)).toBeInTheDocument();
  });

  it("shows a progress count that starts at zero", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("persists a checked question to localStorage and updates progress", () => {
    render(<QuestionList companyId="c1" questions={questions} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(localStorage.getItem("dealecho_qq:c1")).toContain("security-review");
  });

  it("restores checked state from localStorage on mount", () => {
    localStorage.setItem("dealecho_qq:c1", JSON.stringify(["ghosting"]));
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });

  it("keeps state separate per company", () => {
    localStorage.setItem("dealecho_qq:other", JSON.stringify(["ghosting"]));
    render(<QuestionList companyId="c1" questions={questions} />);
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("renders nothing when there are no questions", () => {
    const { container } = render(<QuestionList companyId="c1" questions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
