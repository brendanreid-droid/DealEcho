import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { CONTEXT_STORAGE_KEY, PageContext } from "../shared/messages";
import { subscribeToAuth, signIn, signOut } from "../lib/authClient";
import { buildLookupInput } from "../lib/query";
import { lookupCompany, LookupResult } from "../lib/api";
import { LoginForm } from "./LoginForm";
import { ReviewsView } from "./ReviewsView";

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

  const wrap = { fontFamily: "system-ui, sans-serif", padding: 16, minWidth: 280 } as const;

  if (!authReady) return <div style={wrap}><p>Loading…</p></div>;

  if (!user) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>Dealecho</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
          Sign in to see company intelligence.
        </p>
        <LoginForm onSignIn={signIn} />
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 16, margin: 0 }}>Dealecho</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => chrome.runtime.sendMessage({ type: "dealecho:refresh" })}
            title="Refresh from the current tab"
            style={{ fontSize: 12, cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
          <button onClick={() => signOut()} style={{ fontSize: 12, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      {!context && <p style={{ fontSize: 14 }}>Click the Dealecho icon on a company page to begin.</p>}
      {context && status === "loading" && <p style={{ fontSize: 14 }}>Looking up {context.selection || context.hostname}…</p>}
      {context && status === "error" && <p style={{ fontSize: 14, color: "#b91c1c" }}>Lookup failed. Try again.</p>}
      {context && status === "idle" && result && (
        <ReviewsView result={result} companyHint={context.selection || context.hostname} />
      )}
    </div>
  );
}
