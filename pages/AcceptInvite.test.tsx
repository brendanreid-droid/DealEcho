import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AcceptInvite from "./AcceptInvite";

const signInWithPopup = vi.fn();
const signOut = vi.fn(async () => {});
const createUserWithEmailAndPassword = vi.fn();
const signInWithEmailAndPassword = vi.fn();
const accept = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...(a as [])),
  signOut: (...a: unknown[]) => signOut(...(a as [])),
  createUserWithEmailAndPassword: (...a: unknown[]) => createUserWithEmailAndPassword(...(a as [])),
  signInWithEmailAndPassword: (...a: unknown[]) => signInWithEmailAndPassword(...(a as [])),
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => accept,
}));
vi.mock("../src/firebase/config", () => ({ auth: {}, googleProvider: {} }));

let authState: { user: { email: string } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};
vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({ ...authState, refreshClaims: async () => {} }),
}));

const renderAt = (search = "?token=tok123") =>
  render(
    <MemoryRouter initialEntries={[`/invite/accept${search}`]}>
      <AcceptInvite />
    </MemoryRouter>,
  );

describe("AcceptInvite", () => {
  beforeEach(() => {
    authState = { user: null, isLoading: false };
    signInWithPopup.mockReset().mockResolvedValue({});
    signOut.mockClear();
    accept.mockReset().mockResolvedValue({});
  });

  it("rejects a link with no token", () => {
    renderAt("");
    expect(screen.getByText(/invalid invite link/i)).toBeInTheDocument();
  });

  it("offers Google as well as a password to a signed-out invitee", () => {
    renderAt();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/invited email address/i)).toBeInTheDocument();
  });

  it("starts a Google sign-in when asked", async () => {
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(signInWithPopup).toHaveBeenCalled();
  });

  it("says nothing when the user just closes the Google popup", async () => {
    // Closing the popup is a decision, not an error worth reporting.
    signInWithPopup.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(signInWithPopup).toHaveBeenCalled());
    expect(screen.queryByText(/could not sign in with google/i)).not.toBeInTheDocument();
  });

  it("reports a real Google failure", async () => {
    signInWithPopup.mockRejectedValue({ code: "auth/network-request-failed" });
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByText(/could not sign in with google/i)).toBeInTheDocument();
  });

  it("accepts the invite once signed in", async () => {
    authState = { user: { email: "invited@acme.com" }, isLoading: false };
    renderAt();
    expect(await screen.findByText(/you're in!/i)).toBeInTheDocument();
    expect(accept).toHaveBeenCalledWith({ token: "tok123" });
  });

  it("shows a wrong-account screen naming the signed-in address on a mismatch", async () => {
    // Reachable in one click now that Google signs you in as whoever the
    // browser last used, so it needs to read as identity, not breakage.
    authState = { user: { email: "someone.else@gmail.com" }, isLoading: false };
    accept.mockRejectedValue(new Error("This invite was sent to a different email address."));
    renderAt();

    expect(await screen.findByText(/wrong account/i)).toBeInTheDocument();
    expect(screen.getByText("someone.else@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out and try again/i })).toBeInTheDocument();
  });

  it("does not reveal who the invite was addressed to", async () => {
    // The server never returns the invited address, and echoing one would tell
    // anybody holding a stolen token who the target was.
    authState = { user: { email: "someone.else@gmail.com" }, isLoading: false };
    accept.mockRejectedValue(new Error("This invite was sent to a different email address."));
    const { container } = renderAt();

    await screen.findByText(/wrong account/i);
    expect(container.textContent).not.toContain("invited@acme.com");
  });

  it("signs out from the wrong-account screen", async () => {
    authState = { user: { email: "someone.else@gmail.com" }, isLoading: false };
    accept.mockRejectedValue(new Error("This invite was sent to a different email address."));
    renderAt();

    await userEvent.click(await screen.findByRole("button", { name: /sign out and try again/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("offers a way out of any other failure too", async () => {
    authState = { user: { email: "invited@acme.com" }, isLoading: false };
    accept.mockRejectedValue(new Error("This invite has already been used."));
    renderAt();

    expect(await screen.findByText(/couldn't accept invite/i)).toBeInTheDocument();
    expect(screen.getByText(/already been used/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out and try again/i })).toBeInTheDocument();
  });
});
