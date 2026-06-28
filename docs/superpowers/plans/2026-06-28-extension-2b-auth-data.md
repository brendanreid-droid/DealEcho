# Extension Plan 2B — Auth + Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Side Panel show real DealEcho data: the rep signs in with email/password, the panel calls the deployed `lookupCompanyReviews` endpoint with the captured `{domain, name}`, and renders the aggregate summary, the AI persona, and (for Pro users) the 3 most recent reviews — with a non-Pro upgrade CTA and a "view full card" link.

**Architecture:** Builds directly on Plan 2A (same `extension/` project, branch `feat/extension-app`). Adds a Firebase singleton (`auth` + `functions` in `australia-southeast1`), a typed callable wrapper, a thin auth client, and two leaf React components (login form, reviews view) that are unit-tested with React Testing Library. `App.tsx` is rewired to: subscribe to auth → if signed out show the login form → if signed in, take the captured page context, call the endpoint, and render the result. Firebase web config (public client keys) comes from `extension/.env` (gitignored), mirroring the web app.

**Tech Stack:** firebase JS SDK v12 (auth + functions), React 19, vitest + @testing-library/react (already in the project from 2A).

**Depends on:** Plan 2A (scaffold/plumbing) merged or stacked on the same branch; the Plan-1 `lookupCompanyReviews` function deployed to `australia-southeast1`.

---

## File Structure (added/changed in 2B)

```
extension/
  .env                      # CREATE (gitignored) — VITE_FIREBASE_* values
  .env.example              # CREATE (committed) — keys only
  .gitignore                # MODIFY — add .env
  package.json              # MODIFY — add firebase dep
  src/
    lib/
      firebase.ts           # CREATE — app + auth + functions singletons
      api.ts                # CREATE — typed lookupCompanyReviews wrapper + result types
      query.ts              # CREATE (PURE) — PageContext → {domain?, name?}
      query.test.ts         # CREATE
      authClient.ts         # CREATE — signIn / signOut / subscribe wrappers
    sidepanel/
      LoginForm.tsx         # CREATE
      LoginForm.test.tsx    # CREATE
      ReviewsView.tsx       # CREATE
      ReviewsView.test.tsx  # CREATE
      App.tsx               # MODIFY — auth gate + lookup + render
  manifest.config.ts        # MODIFY — host_permissions for Firebase auth + functions
```

---

### Task 1: Add Firebase + environment config

**Files:**
- Modify: `extension/package.json`, `extension/.gitignore`
- Create: `extension/.env`, `extension/.env.example`

- [ ] **Step 1: Add the firebase dependency**

Edit `extension/package.json` — add to `dependencies`:
```json
    "firebase": "^12.9.0"
```

- [ ] **Step 2: Create `extension/.env`** (these are public Firebase client values, but kept out of git to mirror the web app):

```
VITE_FIREBASE_API_KEY=AIzaSyD_ZeZZt0Nwk6b5dryx9EgxVVukz0rENhc
VITE_FIREBASE_AUTH_DOMAIN=www.dealecho.io
VITE_FIREBASE_PROJECT_ID=dealecho-io-sales-intel-hub
VITE_FIREBASE_STORAGE_BUCKET=dealecho-io-sales-intel-hub.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=888604652941
VITE_FIREBASE_APP_ID=888604652941:web:5c6fc7a5704b17a10a39c4
VITE_FIREBASE_MEASUREMENT_ID=G-CETKQYB467
```

- [ ] **Step 3: Create `extension/.env.example`** (committed, keys only):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

- [ ] **Step 4: Add `.env` to `extension/.gitignore`**

Append a line `.env` to `extension/.gitignore` (keep existing lines).

- [ ] **Step 5: Install**

Run: `npm install --prefix extension`
Expected: `firebase` resolves and installs with no errors.

- [ ] **Step 6: Commit** (note: `.env` is gitignored and will NOT be staged — that's correct):

```bash
git add extension/package.json extension/package-lock.json extension/.gitignore extension/.env.example
git commit -m "chore(extension): add firebase SDK + env config"
```

---

### Task 2: Firebase singletons

**Files:**
- Create: `extension/src/lib/firebase.ts`

- [ ] **Step 1: Implement**

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// Callable region must match the deployed functions (see functions/src/index.ts).
export const functions = getFunctions(app, "australia-southeast1");
export default app;
```

- [ ] **Step 2: Add Vite env typings** — create `extension/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm --prefix extension exec tsc -- --noEmit -p extension/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add extension/src/lib/firebase.ts extension/src/vite-env.d.ts
git commit -m "feat(extension): firebase app/auth/functions singletons"
```

---

### Task 3: Result types + pure query builder (TDD)

**Files:**
- Create: `extension/src/lib/api.ts` (types + callable wrapper)
- Create: `extension/src/lib/query.ts`, `extension/src/lib/query.test.ts`

Test command: `npm --prefix extension test -- query`

- [ ] **Step 1: Define result types + callable wrapper in `extension/src/lib/api.ts`**

```ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export interface LookupSummary {
  companyId: string;
  companyName: string;
  reviewCount: number;
  rating: number;
  healthIndex: number;
}

export interface LookupReview {
  id: string;
  companyName: string;
  status: string;
  content: string;
  createdAt: string;
  communicationRating: number;
  negotiationLevel: number;
  timeWasterLevel: number;
  clarityOfScope: number;
}

export interface LookupResult {
  matched: boolean;
  isPro: boolean;
  companyId?: string;
  companyName?: string;
  summary?: LookupSummary;
  persona?: { summary?: string } | null;
  recentReviews?: LookupReview[];
}

export interface LookupInput {
  domain?: string;
  name?: string;
}

const callable = httpsCallable<LookupInput, LookupResult>(functions, "lookupCompanyReviews");

export async function lookupCompany(input: LookupInput): Promise<LookupResult> {
  const res = await callable(input);
  return res.data;
}
```

- [ ] **Step 2: Write the failing test for the pure query builder `extension/src/lib/query.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildLookupInput } from "./query";

describe("buildLookupInput", () => {
  it("uses hostname as domain and selection as name", () => {
    expect(buildLookupInput({ hostname: "www.acme.com", selection: "Datadog", capturedAt: 1 }))
      .toEqual({ domain: "www.acme.com", name: "Datadog" });
  });

  it("omits name when nothing is selected", () => {
    expect(buildLookupInput({ hostname: "acme.com", selection: "", capturedAt: 1 }))
      .toEqual({ domain: "acme.com" });
  });

  it("omits domain when hostname is empty", () => {
    expect(buildLookupInput({ hostname: "", selection: "Snowflake", capturedAt: 1 }))
      .toEqual({ name: "Snowflake" });
  });

  it("returns empty object when both are empty", () => {
    expect(buildLookupInput({ hostname: "", selection: "", capturedAt: 1 })).toEqual({});
  });
});
```

- [ ] **Step 3: Run → confirm FAIL** (`npm --prefix extension test -- query`)

- [ ] **Step 4: Implement `extension/src/lib/query.ts`**

```ts
import { PageContext } from "../shared/messages";
import { LookupInput } from "./api";

/** Turn captured page context into the endpoint's lookup input, omitting empty fields. */
export function buildLookupInput(ctx: PageContext): LookupInput {
  const input: LookupInput = {};
  if (ctx.hostname) input.domain = ctx.hostname;
  if (ctx.selection) input.name = ctx.selection;
  return input;
}
```

- [ ] **Step 5: Run → confirm 4 PASS**

- [ ] **Step 6: Commit**

```bash
git add extension/src/lib/api.ts extension/src/lib/query.ts extension/src/lib/query.test.ts
git commit -m "feat(extension): lookup endpoint client + pure query builder"
```

---

### Task 4: Auth client + Login form (with component test)

**Files:**
- Create: `extension/src/lib/authClient.ts`
- Create: `extension/src/sidepanel/LoginForm.tsx`, `extension/src/sidepanel/LoginForm.test.tsx`

Test command: `npm --prefix extension test -- LoginForm`

- [ ] **Step 1: Implement `extension/src/lib/authClient.ts`**

```ts
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

export function signIn(email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(auth, email, password).then(() => undefined);
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
```

- [ ] **Step 2: Write the failing test `extension/src/sidepanel/LoginForm.test.tsx`**

```tsx
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
```

- [ ] **Step 3: Run → confirm FAIL** (`npm --prefix extension test -- LoginForm`)

- [ ] **Step 4: Implement `extension/src/sidepanel/LoginForm.tsx`**

```tsx
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
```

- [ ] **Step 5: Run → confirm 2 PASS**

- [ ] **Step 6: Commit**

```bash
git add extension/src/lib/authClient.ts extension/src/sidepanel/LoginForm.tsx extension/src/sidepanel/LoginForm.test.tsx
git commit -m "feat(extension): email/password auth client + login form"
```

---

### Task 5: ReviewsView component (with state tests)

**Files:**
- Create: `extension/src/sidepanel/ReviewsView.tsx`, `extension/src/sidepanel/ReviewsView.test.tsx`

Renders the lookup result. Pure presentational — takes a `LookupResult`, no network. States: no-match, matched (summary + persona always), Pro (reviews list) vs non-Pro (upgrade CTA).

Test command: `npm --prefix extension test -- ReviewsView`

- [ ] **Step 1: Write the failing test `extension/src/sidepanel/ReviewsView.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewsView } from "./ReviewsView";
import { LookupResult } from "../lib/api";

const base: LookupResult = {
  matched: true,
  isPro: true,
  companyId: "c1",
  companyName: "Datadog Inc",
  summary: { companyId: "c1", companyName: "Datadog Inc", reviewCount: 4, rating: 3.5, healthIndex: 70 },
  persona: { summary: "Technical-led buyer." },
  recentReviews: [
    {
      id: "r1", companyName: "Datadog Inc", status: "Won", content: "Smooth deal.",
      createdAt: "2026-01-01", communicationRating: 4, negotiationLevel: 3, timeWasterLevel: 5, clarityOfScope: 4,
    },
  ],
};

describe("ReviewsView", () => {
  it("shows a no-match message when nothing matched", () => {
    render(<ReviewsView result={{ matched: false, isPro: true }} />);
    expect(screen.getByText(/no reviews yet/i)).toBeTruthy();
  });

  it("shows company name, rating and persona on a match", () => {
    render(<ReviewsView result={base} />);
    expect(screen.getByText(/datadog inc/i)).toBeTruthy();
    expect(screen.getByText(/technical-led buyer/i)).toBeTruthy();
    expect(screen.getByText(/70/)).toBeTruthy();
  });

  it("renders reviews for a Pro user", () => {
    render(<ReviewsView result={base} />);
    expect(screen.getByText(/smooth deal/i)).toBeTruthy();
  });

  it("shows an upgrade CTA instead of reviews for a non-Pro user", () => {
    render(<ReviewsView result={{ ...base, isPro: false, recentReviews: undefined }} />);
    expect(screen.queryByText(/smooth deal/i)).toBeNull();
    expect(screen.getByText(/upgrade/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → confirm FAIL**

- [ ] **Step 3: Implement `extension/src/sidepanel/ReviewsView.tsx`**

```tsx
import { LookupResult } from "../lib/api";

const CARD_URL = "https://www.dealecho.io";

export function ReviewsView({ result }: { result: LookupResult }) {
  if (!result.matched) {
    return <p style={{ fontSize: 14 }}>No reviews yet for this company on DealEcho.</p>;
  }

  const { companyName, summary, persona, isPro, recentReviews, companyId } = result;

  return (
    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>{companyName}</h2>

      {summary && (
        <p style={{ margin: "0 0 8px", color: "#374151" }}>
          Rating <strong>{summary.rating.toFixed(1)}</strong> · Health{" "}
          <strong>{summary.healthIndex}</strong> · {summary.reviewCount} review
          {summary.reviewCount === 1 ? "" : "s"}
        </p>
      )}

      {persona?.summary && (
        <p style={{ background: "#f3f4f6", padding: 8, borderRadius: 6, margin: "0 0 8px" }}>
          {persona.summary}
        </p>
      )}

      {isPro ? (
        <div style={{ display: "grid", gap: 8 }}>
          {(recentReviews ?? []).map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {r.status} · {r.createdAt}
              </div>
              <div>{r.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <a
          href="https://www.dealecho.io/pricing"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", color: "#4f46e5", fontWeight: 600 }}
        >
          Upgrade to see reviews →
        </a>
      )}

      <p style={{ marginTop: 12 }}>
        <a
          href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#4f46e5" }}
        >
          View full company card →
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run → confirm 4 PASS**

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/ReviewsView.tsx extension/src/sidepanel/ReviewsView.test.tsx
git commit -m "feat(extension): reviews view with Pro gating + upgrade CTA"
```

---

### Task 6: Wire App.tsx (auth gate → lookup → render)

**Files:**
- Modify: `extension/src/sidepanel/App.tsx`

Replaces the 2A debug view. Subscribes to auth; signed-out → LoginForm; signed-in → read captured context, call `lookupCompany`, render `ReviewsView` with loading/error handling. Keeps a sign-out button.

- [ ] **Step 1: Replace `extension/src/sidepanel/App.tsx` with:**

```tsx
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
        console.error("DealEcho lookup failed", err);
        setStatus("error");
      });
  }, [user, context]);

  const wrap = { fontFamily: "system-ui, sans-serif", padding: 16, minWidth: 280 } as const;

  if (!authReady) return <div style={wrap}><p>Loading…</p></div>;

  if (!user) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 16, margin: "0 0 12px" }}>DealEcho</h1>
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
        <h1 style={{ fontSize: 16, margin: 0 }}>DealEcho</h1>
        <button onClick={() => signOut()} style={{ fontSize: 12, cursor: "pointer" }}>Sign out</button>
      </div>

      {!context && <p style={{ fontSize: 14 }}>Click the DealEcho icon on a company page to begin.</p>}
      {context && status === "loading" && <p style={{ fontSize: 14 }}>Looking up {context.selection || context.hostname}…</p>}
      {context && status === "error" && <p style={{ fontSize: 14, color: "#b91c1c" }}>Lookup failed. Try again.</p>}
      {context && status === "idle" && result && <ReviewsView result={result} />}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build --prefix extension`
Expected: builds with no TypeScript errors; `extension/dist/` regenerated.

- [ ] **Step 3: Full test suite**

Run: `npm --prefix extension test`
Expected: all suites pass — extractContext (3), query (4), LoginForm (2), ReviewsView (4) = 13 tests.

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/App.tsx
git commit -m "feat(extension): wire auth gate, lookup, and reviews rendering"
```

---

### Task 7: Manifest host permissions for Firebase

**Files:**
- Modify: `extension/manifest.config.ts`

Firebase Auth and the callable are fetched from the Side Panel (an extension page). Add the specific hosts so requests aren't blocked. These are narrow hosts (not `<all_urls>`), so the store warning stays mild.

- [ ] **Step 1: Add `host_permissions`** — edit `extension/manifest.config.ts`, adding this key to the manifest object (after `permissions`):

```ts
  host_permissions: [
    "https://identitytoolkit.googleapis.com/*",
    "https://securetoken.googleapis.com/*",
    "https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net/*",
  ],
```

- [ ] **Step 2: Build**

Run: `npm run build --prefix extension`
Expected: `extension/dist/manifest.json` now includes the three `host_permissions`.

- [ ] **Step 3: Commit**

```bash
git add extension/manifest.config.ts
git commit -m "feat(extension): host permissions for Firebase auth + functions"
```

---

### Task 8: Manual end-to-end verification

Requires Chrome + a deployed `lookupCompanyReviews` function + a Pro test account.

- [ ] **Step 1: Build & reload**

Run: `npm run build --prefix extension`. In `chrome://extensions`, click the reload ⟳ on the DealEcho card (re-pick `extension/dist` if needed).

- [ ] **Step 2: Sign in**

Open the panel (click icon on any page). Expected: a login form. Sign in with a Pro account (role paid/admin/free_full).
Expected: form disappears, panel shows the signed-in view with a "Sign out" button.

- [ ] **Step 3: Look up a seeded company**

Navigate anywhere, highlight a seeded company name (e.g. "Datadog", "Snowflake", "Palantir"), click the icon.
Expected: panel shows the company name, a rating/health/review-count line, the AI persona paragraph, and up to 3 recent reviews. A "View full company card" link appears.

- [ ] **Step 4: Verify gating + states**

- Sign out, sign in with a non-Pro account → look up the same company → expect summary + persona + an "Upgrade to see reviews" CTA, no review text.
- Highlight a made-up company / visit a site with no reviews → expect "No reviews yet…".
- Open the Side Panel's devtools (right-click panel → Inspect) and the service-worker console → confirm no uncaught errors. If a request to identitytoolkit or cloudfunctions is blocked by CORS/permission, note the exact error — the fix is confirming the Task 7 host_permissions are present in `dist/manifest.json` and reloading.

- [ ] **Step 5: Record result**

If sign-in works and a seeded company renders summary + persona + (Pro) reviews, this plan is complete.

---

## Self-Review

**Spec coverage (vs `2026-06-28-browser-extension-design.md`, 2B scope):**
- Firebase login inside the panel (email/password) → Tasks 2, 4. ✅ (Google → 2C.)
- Call `lookupCompanyReviews` with `{domain, name}` → Tasks 3, 6. ✅
- Always-shown summary + persona; Pro-only 3 reviews; non-Pro upgrade CTA → Task 5. ✅
- "View full company card" link to dealecho.io → Task 5. ✅
- No-match / loading / error states → Tasks 5, 6. ✅
- Server-side gating already enforced by Plan 1; the UI honors `isPro` from the payload. ✅

**Placeholders:** none — all code complete. `.env` values are the real public Firebase client config.

**Type consistency:** `LookupResult`/`LookupInput`/`LookupSummary`/`LookupReview` defined once in `api.ts` and imported by `query.ts`, `ReviewsView.tsx`, `App.tsx`. `PageContext`/`CONTEXT_STORAGE_KEY` reused from 2A's `shared/messages.ts`. `buildLookupInput` returns the same `LookupInput` the callable accepts.

**Risk notes:**
- Firebase Auth from an MV3 extension page can be sensitive to host permissions / CSP. Task 7 adds the specific hosts; if a runtime block still occurs, the Task 8 step documents how to diagnose. `authDomain` is `www.dealecho.io`; email/password sign-in does not use the OAuth redirect, so no hosted handler is required (that machinery is only needed for Google sign-in in 2C).
- End-to-end success depends on the Plan-1 function being deployed and seeded review data existing for the looked-up company; both are external to this plan and called out in Task 8.
