import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits entered credentials", async () => {
    const onSignIn = vi.fn(async () => {});
    render(<LoginForm onSignIn={onSignIn} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith("a@b.com", "secret"));
  });

  it("shows an error message when sign-in rejects", async () => {
    const onSignIn = vi.fn(async () => {
      throw new Error("Invalid password");
    });
    render(<LoginForm onSignIn={onSignIn} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid password/i)).toBeTruthy();
  });
});
