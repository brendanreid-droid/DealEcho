import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ResetPassword from "./ResetPassword";

const verifyPasswordResetCode = vi.fn();
const confirmPasswordReset = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const navigate = vi.fn();

vi.mock("firebase/auth", () => ({
  verifyPasswordResetCode: (...a: unknown[]) => verifyPasswordResetCode(...(a as [])),
  confirmPasswordReset: (...a: unknown[]) => confirmPasswordReset(...(a as [])),
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPassword(...(a as [])),
}));
vi.mock("../src/firebase/config", () => ({ auth: {} }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const withCode = (code: string | null) => {
  const search = code === null ? "" : `?oobCode=${code}`;
  window.history.replaceState(null, "", `/reset${search}`);
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>,
  );

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyPasswordResetCode.mockResolvedValue("invited@acme.com");
    confirmPasswordReset.mockResolvedValue(undefined);
    signInWithEmailAndPassword.mockResolvedValue({});
    withCode("good-code");
  });

  it("verifies the code and names the account being set", async () => {
    renderPage();
    expect(await screen.findByText("invited@acme.com")).toBeInTheDocument();
    expect(verifyPasswordResetCode).toHaveBeenCalledWith({}, "good-code");
  });

  it("scrubs the code from the URL before doing anything async", async () => {
    // The oobCode is a credential - it must not survive in history, a
    // screenshot, or a copied address bar.
    renderPage();
    await screen.findByText("invited@acme.com");
    expect(window.location.search).toBe("");
  });

  it("rejects a link with no code at all", async () => {
    withCode(null);
    renderPage();
    expect(await screen.findByText(/that link has expired/i)).toBeInTheDocument();
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
  });

  it("shows the expired state when the code does not verify", async () => {
    verifyPasswordResetCode.mockRejectedValue({ code: "auth/invalid-action-code" });
    renderPage();
    expect(await screen.findByText(/that link has expired/i)).toBeInTheDocument();
  });

  it("sets the password and signs the user straight in", async () => {
    renderPage();
    await screen.findByText("invited@acme.com");

    await userEvent.type(screen.getByPlaceholderText(/new password/i), "correct-horse");
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith({}, "good-code", "correct-horse"));
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, "invited@acme.com", "correct-horse");
    expect(navigate).toHaveBeenCalledWith("/search", { replace: true });
  });

  it("refuses mismatched confirmations without spending the code", async () => {
    renderPage();
    await screen.findByText("invited@acme.com");

    await userEvent.type(screen.getByPlaceholderText(/new password/i), "correct-horse");
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), "different-horse");
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("refuses a short password without spending the code", async () => {
    // A single-use code burned on a client-side validation failure would leave
    // the user unable to retry.
    renderPage();
    await screen.findByText("invited@acme.com");

    await userEvent.type(screen.getByPlaceholderText(/new password/i), "short");
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("still reports success when the password saved but sign-in failed", async () => {
    // The password IS set at that point; showing an error would be a lie that
    // sends them to request another link they do not need.
    signInWithEmailAndPassword.mockRejectedValue(new Error("network"));
    renderPage();
    await screen.findByText("invited@acme.com");

    await userEvent.type(screen.getByPlaceholderText(/new password/i), "correct-horse");
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(await screen.findByText(/password set/i)).toBeInTheDocument();
  });

  it("shows the expired state when the code is spent on submit", async () => {
    confirmPasswordReset.mockRejectedValue({ code: "auth/invalid-action-code" });
    renderPage();
    await screen.findByText("invited@acme.com");

    await userEvent.type(screen.getByPlaceholderText(/new password/i), "correct-horse");
    await userEvent.type(screen.getByPlaceholderText(/confirm password/i), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(await screen.findByText(/that link has expired/i)).toBeInTheDocument();
  });
});
