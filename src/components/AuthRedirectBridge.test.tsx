import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AuthRedirectBridge from "./AuthRedirectBridge";

describe("AuthRedirectBridge", () => {
  it("opens the sign-in modal when routed with openSignIn state", () => {
    const onOpenSignIn = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/", state: { openSignIn: true } }]}>
        <AuthRedirectBridge onOpenSignIn={onOpenSignIn} postAuthPath={null} onConsumePostAuth={() => {}} />
      </MemoryRouter>,
    );
    expect(onOpenSignIn).toHaveBeenCalledTimes(1);
  });

  it("navigates to postAuthPath and consumes it", () => {
    const onConsume = vi.fn();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthRedirectBridge onOpenSignIn={() => {}} postAuthPath="/search" onConsumePostAuth={onConsume} />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/search" element={<div>search page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("search page")).toBeInTheDocument();
    expect(onConsume).toHaveBeenCalledTimes(1);
  });
});
