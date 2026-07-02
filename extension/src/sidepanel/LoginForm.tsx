import { useState, FormEvent, CSSProperties } from "react";
import { theme } from "./theme";

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignInWithGoogle?: () => Promise<void>;
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

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

export function LoginForm({ onSignIn, onSignInWithGoogle }: Props) {
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

  async function handleGoogle() {
    if (!onSignInWithGoogle) return;
    setError(null);
    setBusy(true);
    try {
      await onSignInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {onSignInWithGoogle && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 12px",
              background: theme.white,
              color: "#3c4043",
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${theme.border}` }} />
            <span style={{ fontSize: 11, color: theme.faint }}>or</span>
            <hr style={{ flex: 1, border: "none", borderTop: `1px solid ${theme.border}` }} />
          </div>
        </>
      )}
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
    </div>
  );
}
