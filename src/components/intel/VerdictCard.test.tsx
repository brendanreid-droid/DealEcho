import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VerdictCard from "./VerdictCard";

describe("VerdictCard", () => {
  it("shows health, trend delta, headline and report count", () => {
    render(
      <VerdictCard
        name="Snowflake"
        meta="Data warehousing · United States"
        health={62}
        healthDelta={-8}
        headline="High-friction account."
        reportCount={14}
      />,
    );
    expect(screen.getByText("Snowflake")).toBeInTheDocument();
    expect(screen.getByText("High-friction account.")).toBeInTheDocument();
    expect(screen.getByText(/14 reports/i)).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });
});
