import { useEffect, useState, CSSProperties } from "react";
import type { User } from "firebase/auth";
import { CONTEXT_STORAGE_KEY, PageContext } from "../shared/messages";
import { subscribeToAuth, signIn, signOut } from "../lib/authClient";
import { buildLookupInput } from "../lib/query";
import { lookupCompany, LookupResult } from "../lib/api";
import { LoginForm } from "./LoginForm";
import { ReviewsView } from "./ReviewsView";
import { theme, Wordmark } from "./theme";

const ghostBtn: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: theme.sub,
  background: "transparent",
  border: `1px solid ${theme.border}`,
  borderRadius: 7,
  padding: "5px 9px",
  cursor: "pointer",
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [context, setContext] = useState<PageContext | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  // Auth subscription.
  useEffect(() => subscribeToAuth((u) => {
    setUser(u);
    setAuthReady(true);
  }), []);

  // Captured page context (from background, via session storage).
  useEffect(() => {
    chrome.storage.session.get(CONTEXT_STORAGE_KEY).then((data) => {
      setContext((data[CONTEXT_STORAGE_KEY] as PageContext | undefined) ?? null);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "session" && changes[CONTEXT_STORAGE_KEY]) {
        setContext((changes[CONTEXT_STORAGE_KEY].newValue as PageContext | undefined) ?? null);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  // Run the lookup whenever we have both a signed-in user and a captured context.
  useEffect(() => {
    if (!user || !context) return;
    const input = buildLookupInput(context);
    if (!input.domain && !input.name) return;
    setStatus("loading");
    setResult(null);
    lookupCompany(input)
      .then((r) => {
        setResult(r);
        setStatus("idle");
      })
      .catch((err) => {
        console.error("Dealecho lookup failed", err);
        setStatus("error");
      });
  }, [user, context]);

  const shell: CSSProperties = {
    fontFamily: theme.font,
    minWidth: 300,
    color: theme.ink,
    background: theme.white,
    minHeight: "100vh",
  };
  const header: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.border}`,
    position: "sticky",
    top: 0,
    background: theme.white,
  };
  const body: CSSProperties = { padding: 16 };

  if (!authReady) {
    return (
      <div style={shell}>
        <div style={header}><Wordmark /></div>
        <div style={body}><p style={{ color: theme.sub, fontSize: 13 }}>Loading…</p></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={shell}>
        <div style={header}><Wordmark /></div>
        <div style={body}>
          <p style={{ fontSize: 13, color: theme.sub, margin: "0 0 14px" }}>
            Sign in to see company intelligence.
          </p>
          <LoginForm onSignIn={signIn} />
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={header}>
        <Wordmark />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => chrome.runtime.sendMessage({ type: "dealecho:refresh" })}
            title="Refresh from the current tab"
            style={ghostBtn}
          >
            ↻ Refresh
          </button>
          <button onClick={() => signOut()} style={ghostBtn}>Sign out</button>
        </div>
      </div>

      <div style={body}>
        {!context && (
          <p style={{ fontSize: 13, color: theme.sub }}>
            Click the dealecho icon on a company page to begin.
          </p>
        )}
        {context && status === "loading" && (
          <p style={{ fontSize: 13, color: theme.sub }}>
            Looking up {context.selection || context.hostname}…
          </p>
        )}
        {context && status === "error" && (
          <p style={{ fontSize: 13, color: theme.risk }}>Lookup failed. Try again.</p>
        )}
        {context && status === "idle" && result && (
          <ReviewsView result={result} companyHint={context.selection || context.hostname} />
        )}
      </div>
    </div>
  );
}
