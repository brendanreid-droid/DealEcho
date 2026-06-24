import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CtaBand from "./CtaBand";

describe("CtaBand", () => {
  it("renders the headline and a CTA link", () => {
    render(
      <MemoryRouter>
        <CtaBand headline="Stop walking into deals blind." subtext="Cancel anytime." ctaLabel="Start your 7-day trial" to="/pricing" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Stop walking into deals blind.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start your 7-day trial/ })).toHaveAttribute("href", "/pricing");
  });
});
