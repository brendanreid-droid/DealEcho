import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Button from "./Button";

describe("Button", () => {
  it("fires onClick when used as a button", async () => {
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Get Pro</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Get Pro" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders as a link when `to` is provided", () => {
    render(
      <MemoryRouter>
        <Button variant="primary" to="/pricing">Start trial</Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Start trial" })).toHaveAttribute("href", "/pricing");
  });
});
