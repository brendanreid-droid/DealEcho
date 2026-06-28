import { useState, FormEvent } from "react";

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 13 }}>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 6, marginTop: 2 }}
          required
        />
      </label>
      <label style={{ fontSize: 13 }}>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 6, marginTop: 2 }}
          required
        />
      </label>
      {error && <p style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ padding: "8px 12px", cursor: "pointer" }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
