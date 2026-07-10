import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation } from "./Shell";

const noop = () => {};

describe("Navigation", () => {
  it("shows Sign up and Pricing for logged-out visitors", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("shows the app nav for logged-in users", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={true} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Control Centre")).toBeInTheDocument();
    expect(screen.getByText("Write Review")).toBeInTheDocument();
  });

  it("gives logged-in users Search, and Pricing when not paid", () => {
    render(
      <MemoryRouter>
        <Navigation user={{ name: "Sam", avatar: "" } as any} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("points the logged-out Search link at /search", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
  });
});
