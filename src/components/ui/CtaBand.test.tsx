import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("renders a button and fires onClick when no route is given", () => {
    const spy = vi.fn();
    render(
      <MemoryRouter>
        <CtaBand headline="Ready?" ctaLabel="Start free trial" onClick={spy} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start free trial/ }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
