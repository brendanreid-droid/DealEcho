import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "./Shell";

const noop = () => {};

describe("Navigation", () => {
  it("shows Get Pro CTA for logged-out visitors", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Get Pro/ })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the app nav for logged-in users", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={true} onSignInClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText("My Intel")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Get Pro/ })).not.toBeInTheDocument();
  });
});
