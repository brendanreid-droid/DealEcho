import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation, Footer } from "./Shell";

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
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("points the logged-out Search link at the home landing page", () => {
    render(
      <MemoryRouter>
        <Navigation user={null} isAdmin={false} isPaid={false} onSignInClick={noop} onSignUpClick={noop} onLogout={noop} notificationCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/");
  });
});

describe("Footer", () => {
  // /trends is unfinished and admin-gated at the route. The footer link is the
  // only way in, so it must not advertise a page every other user is bounced
  // off, and it must stay visible to Brendan as a reminder it is still WIP.
  it("hides the analytics link from non-admins", () => {
    render(
      <MemoryRouter>
        <Footer isAdmin={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: /Analytics/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Search Accounts" })).toBeInTheDocument();
  });

  it("shows admins the analytics link, labelled as admin-only", () => {
    render(
      <MemoryRouter>
        <Footer isAdmin />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Analytics Admin Only" })).toHaveAttribute(
      "href",
      "/trends",
    );
  });

  it("hides it when no admin flag is passed at all", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: /Analytics/ })).toBeNull();
  });
});
