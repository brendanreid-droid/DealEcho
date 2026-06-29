import { useState, FormEvent, CSSProperties } from "react";
import { theme } from "./theme";

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  marginTop: 4,
  fontSize: 13,
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  outline: "none",
  background: theme.white,
};

const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: theme.sub };

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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <label style={labelStyle}>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
        />
      </label>
      <label style={labelStyle}>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
        />
      </label>
      {error && <p style={{ color: theme.risk, fontSize: 12, margin: 0 }}>{error}</p>}
      <button
        type="submit"
        disabled={busy}
        style={{
          padding: "10px 12px",
          background: theme.navy,
          color: theme.white,
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
