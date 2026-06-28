# Extension Backend — `lookupCompanyReviews` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one callable Cloud Function, `lookupCompanyReviews`, that resolves a website domain or a company name to DealEcho's review data and returns an aggregate summary, an AI buyer persona, and (Pro only) the 3 most recent reviews.

**Architecture:** Pure, dependency-injected resolver modules (`domains`, `matching`, `resolver`) that are unit-tested with vitest and fakes, plus a thin `onCall` wiring layer that supplies real Firestore + Gemini implementations and enforces Pro gating. A `company_domains` Firestore collection caches domain→company so repeat domain lookups skip Gemini. Personas are cached in `personas/{companyId}`.

**Tech Stack:** Firebase Cloud Functions v2 (Node 22, `onCall`), Firestore (Admin SDK), `@google/genai` (Gemini, reused), vitest (new in `functions/`).

**Companion plan (separate):** the browser extension itself is planned after this endpoint is built and its interface is locked.

---

## Data Reality (read before starting)

- `reviews/{reviewId}` — full reviews, Pro-gated by `firestore.rules`. Fields per `types.ts`: `companyId`, `companyName`, ratings (`communicationRating`, `negotiationLevel`, `timeWasterLevel`, `clarityOfScope`), `content`, `createdAt` (ISO string), etc.
- `review_summaries/{reviewId}` — public, sanitized per-review copy (NOT a per-company aggregate). Fields per `src/hooks/useReviewSummaries.ts`: `companyId`, `companyName`, ratings, `excerpt`, `createdAt`. Written by `functions/src/reviewModeration.ts`.
- `companies` — effectively unused; do not rely on it.
- `isPro` roles (from `firestore.rules`): `['paid','admin','free_full']`.
- Existing AI helpers in `functions/src/searchCompanies.ts`: `searchCompanyEntities` (domain/name → company list via Gemini+Search) and `getAICompanyPersona` (reviews → MEDDPICC persona). Reuse their patterns; do not duplicate the Gemini setup wholesale.

## File Structure

- Create `functions/vitest.config.ts` — vitest config for functions.
- Create `functions/src/extension/domains.ts` — `registrableDomain`, `isCrmHost` (pure).
- Create `functions/src/extension/domains.test.ts`
- Create `functions/src/extension/matching.ts` — `normalizeName`, `bestNameMatch` (pure).
- Create `functions/src/extension/matching.test.ts`
- Create `functions/src/extension/gating.ts` — `isProRole` (pure).
- Create `functions/src/extension/gating.test.ts`
- Create `functions/src/extension/resolver.ts` — `resolveCompany(input, deps)` + types (pure orchestration).
- Create `functions/src/extension/resolver.test.ts`
- Create `functions/src/extension/personaCache.ts` — `getOrCreatePersona(deps)`.
- Create `functions/src/extension/personaCache.test.ts`
- Create `functions/src/extension/lookupCompanyReviews.ts` — `onCall` wiring (real deps + gating).
- Modify `functions/src/index.ts` — export `lookupCompanyReviews`.
- Modify `functions/package.json` — add `test` script + vitest devDep.

---

### Task 1: Add vitest to the functions workspace

**Files:**
- Modify: `functions/package.json`
- Create: `functions/vitest.config.ts`

- [ ] **Step 1: Add vitest dev dependency and test scripts**

Edit `functions/package.json` — add to `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Add to `devDependencies`:

```json
    "vitest": "^4.1.9"
```

- [ ] **Step 2: Install**

Run: `npm install -w functions`
Expected: vitest added under `functions/node_modules` (or hoisted to root), no errors.

- [ ] **Step 3: Create vitest config**

Create `functions/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner starts (no tests yet)**

Run: `npm test -w functions`
Expected: vitest runs and reports "No test files found" (exit non-zero is fine at this point).

- [ ] **Step 5: Commit**

```bash
git add functions/package.json functions/vitest.config.ts
git commit -m "chore(functions): add vitest test runner"
```

---

### Task 2: Domain utilities — `registrableDomain` + `isCrmHost`

**Files:**
- Create: `functions/src/extension/domains.ts`
- Test: `functions/src/extension/domains.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/extension/domains.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registrableDomain, isCrmHost } from "./domains";

describe("registrableDomain", () => {
  it("strips www and protocol", () => {
    expect(registrableDomain("https://www.acme.com/path")).toBe("acme.com");
  });
  it("drops subdomains to the registrable domain", () => {
    expect(registrableDomain("careers.acme.com")).toBe("acme.com");
  });
  it("handles a bare hostname", () => {
    expect(registrableDomain("acme.com")).toBe("acme.com");
  });
  it("returns empty string for junk", () => {
    expect(registrableDomain("")).toBe("");
  });
});

describe("isCrmHost", () => {
  it("flags salesforce", () => {
    expect(isCrmHost("acme.lightning.force.com")).toBe(true);
    expect(isCrmHost("salesforce.com")).toBe(true);
  });
  it("flags hubspot", () => {
    expect(isCrmHost("app.hubspot.com")).toBe(true);
  });
  it("does not flag a normal prospect site", () => {
    expect(isCrmHost("acme.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w functions -- domains`
Expected: FAIL — cannot find module `./domains`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/extension/domains.ts`:

```ts
// Known CRM / SaaS hosts where the page domain is NOT the prospect company.
const CRM_HOSTS = [
  "salesforce.com",
  "force.com",
  "lightning.force.com",
  "hubspot.com",
  "pipedrive.com",
  "zoho.com",
  "dynamics.com",
];

/** Normalize any URL or hostname to its registrable domain (no protocol, no www, no subdomain). */
export function registrableDomain(input: string): string {
  if (!input) return "";
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, ""); // strip protocol
  host = host.split("/")[0]; // strip path
  host = host.split("?")[0];
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  // Keep the last two labels (good enough for .com/.io/.co; refine later if needed).
  return parts.slice(-2).join(".");
}

/** True when the host belongs to a CRM/SaaS app rather than a prospect's own site. */
export function isCrmHost(input: string): boolean {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split("/")[0];
  return CRM_HOSTS.some((crm) => host === crm || host.endsWith("." + crm));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w functions -- domains`
Expected: PASS (all 7 assertions).

- [ ] **Step 5: Commit**

```bash
git add functions/src/extension/domains.ts functions/src/extension/domains.test.ts
git commit -m "feat(extension-api): domain normalization + CRM-host detection"
```

---

### Task 3: Name matching — `normalizeName` + `bestNameMatch`

**Files:**
- Create: `functions/src/extension/matching.ts`
- Test: `functions/src/extension/matching.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/extension/matching.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeName, bestNameMatch } from "./matching";

const candidates = [
  { companyId: "c1", companyName: "Datadog Inc" },
  { companyId: "c2", companyName: "Palantir Technologies" },
  { companyId: "c3", companyName: "Snowflake" },
];

describe("normalizeName", () => {
  it("lowercases and strips suffixes/punctuation", () => {
    expect(normalizeName("Datadog, Inc.")).toBe("datadog");
    expect(normalizeName("Palantir Technologies")).toBe("palantir technologies");
  });
});

describe("bestNameMatch", () => {
  it("matches a short query to the fuller name", () => {
    expect(bestNameMatch("Datadog", candidates)?.companyId).toBe("c1");
  });
  it("matches case-insensitively", () => {
    expect(bestNameMatch("snowflake", candidates)?.companyId).toBe("c3");
  });
  it("returns null when nothing is close", () => {
    expect(bestNameMatch("Microsoft", candidates)).toBeNull();
  });
  it("returns null for empty query", () => {
    expect(bestNameMatch("", candidates)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w functions -- matching`
Expected: FAIL — cannot find module `./matching`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/extension/matching.ts`:

```ts
export interface CompanyRef {
  companyId: string;
  companyName: string;
}

const SUFFIXES = ["inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "plc", "co", "technologies", "group"];

/** Lowercase, strip punctuation and common corporate suffixes, collapse whitespace. */
export function normalizeName(name: string): string {
  const cleaned = (name || "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t && !SUFFIXES.includes(t));
  // If stripping suffixes removed everything (e.g. "Technologies"), fall back to cleaned.
  return (tokens.length ? tokens.join(" ") : cleaned).trim();
}

/**
 * Pick the best candidate for a free-text company query.
 * Strategy: normalize both sides; score by token overlap, with a containment bonus.
 * Returns null if the best score is below threshold.
 */
export function bestNameMatch(query: string, candidates: CompanyRef[]): CompanyRef | null {
  const q = normalizeName(query);
  if (!q) return null;
  const qTokens = new Set(q.split(" "));

  let best: CompanyRef | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const c = normalizeName(cand.companyName);
    if (!c) continue;
    const cTokens = c.split(" ");
    const overlap = cTokens.filter((t) => qTokens.has(t)).length;
    if (overlap === 0) continue;
    // Fraction of the shorter token set that overlaps — rewards "Datadog" ⊂ "Datadog Inc".
    const denom = Math.min(qTokens.size, cTokens.length);
    let score = overlap / denom;
    if (c === q || c.includes(q) || q.includes(c)) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return bestScore >= 0.75 ? best : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w functions -- matching`
Expected: PASS (all 6 assertions).

- [ ] **Step 5: Commit**

```bash
git add functions/src/extension/matching.ts functions/src/extension/matching.test.ts
git commit -m "feat(extension-api): normalized fuzzy company-name matching"
```

---

### Task 4: Pro gating helper — `isProRole`

**Files:**
- Create: `functions/src/extension/gating.ts`
- Test: `functions/src/extension/gating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/extension/gating.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isProRole } from "./gating";

describe("isProRole", () => {
  it("is true for paid/admin/free_full", () => {
    expect(isProRole("paid")).toBe(true);
    expect(isProRole("admin")).toBe(true);
    expect(isProRole("free_full")).toBe(true);
  });
  it("is false for free or undefined", () => {
    expect(isProRole("free")).toBe(false);
    expect(isProRole(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w functions -- gating`
Expected: FAIL — cannot find module `./gating`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/extension/gating.ts`:

```ts
// Mirrors isPro() in firestore.rules. Keep these in sync.
const PRO_ROLES = ["paid", "admin", "free_full"];

export function isProRole(role: string | undefined | null): boolean {
  return !!role && PRO_ROLES.includes(role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w functions -- gating`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/extension/gating.ts functions/src/extension/gating.test.ts
git commit -m "feat(extension-api): isProRole gating helper"
```

---

### Task 5: Resolver orchestration — `resolveCompany`

**Files:**
- Create: `functions/src/extension/resolver.ts`
- Test: `functions/src/extension/resolver.test.ts`

The resolver is pure: it takes the parsed input and a `deps` object of async functions. Real Firestore/Gemini implementations are injected by the wiring layer (Task 7); tests inject fakes.

- [ ] **Step 1: Write the failing test**

Create `functions/src/extension/resolver.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveCompany, ResolverDeps } from "./resolver";
import { CompanyRef } from "./matching";

const NAMES: CompanyRef[] = [
  { companyId: "c1", companyName: "Datadog Inc" },
  { companyId: "c2", companyName: "Snowflake" },
];

function makeDeps(overrides: Partial<ResolverDeps> = {}): ResolverDeps {
  return {
    lookupDomainCache: vi.fn(async () => null),
    saveDomainCache: vi.fn(async () => {}),
    listCompanyNames: vi.fn(async () => NAMES),
    canonicalizeViaAI: vi.fn(async () => null),
    ...overrides,
  };
}

describe("resolveCompany", () => {
  it("returns a cached domain hit without scanning names", async () => {
    const deps = makeDeps({
      lookupDomainCache: vi.fn(async () => ({ companyId: "c1", companyName: "Datadog Inc" })),
    });
    const res = await resolveCompany({ domain: "www.datadoghq.com" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.listCompanyNames).not.toHaveBeenCalled();
  });

  it("ignores a CRM host and matches on the highlighted name", async () => {
    const deps = makeDeps();
    const res = await resolveCompany({ domain: "acme.lightning.force.com", name: "Datadog" }, deps);
    expect(res?.companyId).toBe("c1");
    expect(deps.lookupDomainCache).not.toHaveBeenCalled();
  });

  it("fuzzy-matches a highlighted name", async () => {
    const deps = makeDeps();
    const res = await resolveCompany({ name: "Snowflake" }, deps);
    expect(res?.companyId).toBe("c2");
  });

  it("caches the domain after a successful prospect-site match", async () => {
    const deps = makeDeps();
    await resolveCompany({ domain: "datadog.com", name: "Datadog" }, deps);
    expect(deps.saveDomainCache).toHaveBeenCalledWith(
      "datadog.com",
      expect.objectContaining({ companyId: "c1" }),
    );
  });

  it("falls back to AI when no direct match, then re-matches", async () => {
    const deps = makeDeps({
      canonicalizeViaAI: vi.fn(async () => ({ name: "Snowflake" })),
    });
    const res = await resolveCompany({ domain: "snowflake.io" }, deps);
    expect(deps.canonicalizeViaAI).toHaveBeenCalled();
    expect(res?.companyId).toBe("c2");
  });

  it("returns null when nothing resolves", async () => {
    const deps = makeDeps({ canonicalizeViaAI: vi.fn(async () => ({ name: "Microsoft" })) });
    const res = await resolveCompany({ domain: "microsoft.com" }, deps);
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w functions -- resolver`
Expected: FAIL — cannot find module `./resolver`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/extension/resolver.ts`:

```ts
import { registrableDomain, isCrmHost } from "./domains";
import { bestNameMatch, CompanyRef } from "./matching";

export interface ResolverInput {
  domain?: string;
  name?: string;
}

export interface ResolverDeps {
  lookupDomainCache(domain: string): Promise<CompanyRef | null>;
  saveDomainCache(domain: string, ref: CompanyRef): Promise<void>;
  listCompanyNames(): Promise<CompanyRef[]>;
  canonicalizeViaAI(query: string): Promise<{ name: string; domain?: string } | null>;
}

/**
 * Resolve a website domain and/or company name to a known company.
 * Order: domain-cache → name match → AI canonicalize → re-match. Returns null on miss.
 */
export async function resolveCompany(
  input: ResolverInput,
  deps: ResolverDeps,
): Promise<CompanyRef | null> {
  const usableDomain =
    input.domain && !isCrmHost(input.domain) ? registrableDomain(input.domain) : "";

  // 1. Domain cache (cheap, exact).
  if (usableDomain) {
    const cached = await deps.lookupDomainCache(usableDomain);
    if (cached) return cached;
  }

  // 2. Direct name match against known companies.
  const names = await deps.listCompanyNames();
  const query = input.name?.trim() || usableDomain.split(".")[0] || "";
  if (query) {
    const match = bestNameMatch(query, names);
    if (match) {
      if (usableDomain) await deps.saveDomainCache(usableDomain, match);
      return match;
    }
  }

  // 3. AI fallback: canonicalize the raw query, then re-match.
  const aiQuery = input.name?.trim() || input.domain || "";
  if (aiQuery) {
    const ai = await deps.canonicalizeViaAI(aiQuery);
    if (ai?.name) {
      const match = bestNameMatch(ai.name, names);
      if (match) {
        if (usableDomain) await deps.saveDomainCache(usableDomain, match);
        return match;
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w functions -- resolver`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add functions/src/extension/resolver.ts functions/src/extension/resolver.test.ts
git commit -m "feat(extension-api): company resolver (domain cache, name match, AI fallback)"
```

---

### Task 6: Persona cache — `getOrCreatePersona`

**Files:**
- Create: `functions/src/extension/personaCache.ts`
- Test: `functions/src/extension/personaCache.test.ts`

Caches the AI persona per company so Gemini is only called on first use or when the review count changes / the cache goes stale.

- [ ] **Step 1: Write the failing test**

Create `functions/src/extension/personaCache.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getOrCreatePersona, PersonaCacheDeps } from "./personaCache";

const PERSONA = { summary: "x", keyTraits: [], strategicAdvice: "y", teamPlaybooks: [], meddpicc: {} };

function makeDeps(overrides: Partial<PersonaCacheDeps> = {}): PersonaCacheDeps {
  return {
    read: vi.fn(async () => null),
    write: vi.fn(async () => {}),
    generate: vi.fn(async () => PERSONA),
    now: () => 1_000_000,
    ttlMs: 1000,
    ...overrides,
  };
}

describe("getOrCreatePersona", () => {
  it("generates and writes on cache miss", async () => {
    const deps = makeDeps();
    const res = await getOrCreatePersona("c1", 3, deps);
    expect(res).toBe(PERSONA);
    expect(deps.generate).toHaveBeenCalledOnce();
    expect(deps.write).toHaveBeenCalled();
  });

  it("returns cache and skips generate when fresh and review count matches", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 999_500, reviewCount: 3 })),
    });
    const res = await getOrCreatePersona("c1", 3, deps);
    expect(res).toBe(PERSONA);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  it("regenerates when the review count changed", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 999_500, reviewCount: 2 })),
    });
    await getOrCreatePersona("c1", 5, deps);
    expect(deps.generate).toHaveBeenCalledOnce();
  });

  it("regenerates when the cache is stale", async () => {
    const deps = makeDeps({
      read: vi.fn(async () => ({ persona: PERSONA, generatedAt: 1, reviewCount: 3 })),
    });
    await getOrCreatePersona("c1", 3, deps);
    expect(deps.generate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w functions -- personaCache`
Expected: FAIL — cannot find module `./personaCache`.

- [ ] **Step 3: Write minimal implementation**

Create `functions/src/extension/personaCache.ts`:

```ts
export interface CachedPersona {
  persona: unknown;
  generatedAt: number;
  reviewCount: number;
}

export interface PersonaCacheDeps {
  read(companyId: string): Promise<CachedPersona | null>;
  write(companyId: string, entry: CachedPersona): Promise<void>;
  generate(companyId: string): Promise<unknown>;
  now(): number;
  ttlMs: number;
}

/** Return a cached persona when fresh and the review count is unchanged; otherwise regenerate. */
export async function getOrCreatePersona(
  companyId: string,
  reviewCount: number,
  deps: PersonaCacheDeps,
): Promise<unknown> {
  const cached = await deps.read(companyId);
  const fresh =
    cached &&
    cached.reviewCount === reviewCount &&
    deps.now() - cached.generatedAt < deps.ttlMs;
  if (fresh) return cached!.persona;

  const persona = await deps.generate(companyId);
  await deps.write(companyId, { persona, generatedAt: deps.now(), reviewCount });
  return persona;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w functions -- personaCache`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add functions/src/extension/personaCache.ts functions/src/extension/personaCache.test.ts
git commit -m "feat(extension-api): persona cache with TTL + review-count invalidation"
```

---

### Task 7: Wire the callable — `lookupCompanyReviews`

**Files:**
- Create: `functions/src/extension/lookupCompanyReviews.ts`
- Modify: `functions/src/index.ts`

This is the I/O layer: it builds real Firestore/Gemini `deps`, runs the resolver, computes the aggregate from `review_summaries`, gets the persona (cached), and gates `recentReviews` by role. Verified via the emulator (no unit test — it is thin wiring over already-tested pure modules).

- [ ] **Step 1: Implement the callable**

Create `functions/src/extension/lookupCompanyReviews.ts`:

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { resolveCompany, ResolverDeps } from "./resolver";
import { CompanyRef } from "./matching";
import { isProRole } from "./gating";
import { getOrCreatePersona } from "./personaCache";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const PERSONA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const lookupCompanyReviews = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use DealEcho.");
    }
    const domain = typeof request.data?.domain === "string" ? request.data.domain : undefined;
    const name = typeof request.data?.name === "string" ? request.data.name : undefined;
    if (!domain && !name) {
      throw new HttpsError("invalid-argument", "A domain or name is required.");
    }

    const apiKey = GEMINI_API_KEY.value();
    const ai = apiKey && !apiKey.includes("PLACEHOLDER") ? new GoogleGenAI({ apiKey }) : null;

    // ── Build real resolver deps ────────────────────────────────────────────
    const deps: ResolverDeps = {
      async lookupDomainCache(d) {
        const snap = await db.doc(`company_domains/${d}`).get();
        return snap.exists ? (snap.data() as CompanyRef) : null;
      },
      async saveDomainCache(d, ref) {
        await db.doc(`company_domains/${d}`).set(
          { ...ref, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      },
      async listCompanyNames() {
        // Distinct {companyId, companyName} from public review_summaries.
        const snap = await db.collection("review_summaries").get();
        const seen = new Map<string, CompanyRef>();
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.companyId && d.companyName && !seen.has(d.companyId)) {
            seen.set(d.companyId, { companyId: d.companyId, companyName: d.companyName });
          }
        });
        return [...seen.values()];
      },
      async canonicalizeViaAI(query) {
        if (!ai) return null;
        try {
          const resp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `What company is at or named "${query}"? Respond ONLY with minified JSON {"name": string, "domain": string}.`,
            config: { tools: [{ googleSearch: {} }] },
          });
          const text = (resp.text ?? "").replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(text || "{}");
          return parsed?.name ? { name: parsed.name, domain: parsed.domain } : null;
        } catch {
          return null;
        }
      },
    };

    const company = await resolveCompany({ domain, name }, deps);
    const isPro = isProRole(request.auth.token.role as string | undefined);
    if (!company) return { matched: false, isPro };

    // ── Aggregate from review_summaries for this company ────────────────────
    const sumSnap = await db
      .collection("review_summaries")
      .where("companyId", "==", company.companyId)
      .get();
    const sums = sumSnap.docs.map((d) => d.data());
    const reviewCount = sums.length;
    const avg = (key: string) =>
      reviewCount ? sums.reduce((a, s) => a + (s[key] || 0), 0) / reviewCount : 0;
    const ratingKeys = ["communicationRating", "negotiationLevel", "timeWasterLevel", "clarityOfScope"];
    const rating = reviewCount
      ? ratingKeys.reduce((a, k) => a + avg(k), 0) / ratingKeys.length
      : 0;
    const summary = {
      companyId: company.companyId,
      companyName: company.companyName,
      reviewCount,
      rating: Number(rating.toFixed(2)),
      healthIndex: Number((rating * 20).toFixed(0)), // 0–100 scale
    };

    // ── Persona (cached) ────────────────────────────────────────────────────
    let persona: unknown = null;
    if (ai && reviewCount > 0) {
      persona = await getOrCreatePersona(company.companyId, reviewCount, {
        ttlMs: PERSONA_TTL_MS,
        now: () => Date.now(),
        async read(id) {
          const s = await db.doc(`personas/${id}`).get();
          return s.exists ? (s.data() as any) : null;
        },
        async write(id, entry) {
          await db.doc(`personas/${id}`).set(entry, { merge: true });
        },
        async generate() {
          const resp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Summarize the B2B buyer behaviour for "${company.companyName}" in 2-3 sentences for a sales rep, based on ${reviewCount} reviews. Plain text.`,
          });
          return { summary: (resp.text ?? "").trim() };
        },
      });
    }

    // ── Recent reviews (Pro only) ───────────────────────────────────────────
    let recentReviews: any[] | undefined;
    if (isPro) {
      const revSnap = await db
        .collection("reviews")
        .where("companyId", "==", company.companyId)
        .get();
      recentReviews = revSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 3);
    }

    return {
      matched: true,
      isPro,
      companyId: company.companyId,
      companyName: company.companyName,
      summary,
      persona,
      recentReviews,
    };
  },
);
```

> Note: `reviews` has no composite index need here (single `where` + in-memory sort of ≤ a company's reviews). If review volume per company grows large, add `orderBy('createdAt','desc').limit(3)` and the matching Firestore index.

- [ ] **Step 2: Export from index**

Edit `functions/src/index.ts` — add after the `searchCompanyEntities` export line:

```ts
export { lookupCompanyReviews } from "./extension/lookupCompanyReviews";
```

- [ ] **Step 3: Build**

Run: `npm run build -w functions`
Expected: `tsc` compiles with no errors.

- [ ] **Step 4: Run the full functions test suite**

Run: `npm test -w functions`
Expected: PASS — all pure-module suites (domains, matching, gating, resolver, personaCache) green.

- [ ] **Step 5: Manual emulator smoke test**

Run: `npm run serve -w functions`
Then call `lookupCompanyReviews` from the emulator UI / a script with:
- `{ name: "Datadog" }` → expect `matched: true`, a `summary` with `reviewCount > 0`.
- `{ domain: "app.hubspot.com", name: "Snowflake" }` → CRM host ignored, matches Snowflake.
- As a non-Pro user → `recentReviews` is `undefined`, `isPro: false`.
Expected: payloads match; second identical domain call writes/reads `company_domains`.

- [ ] **Step 6: Commit**

```bash
git add functions/src/extension/lookupCompanyReviews.ts functions/src/index.ts
git commit -m "feat(extension-api): lookupCompanyReviews callable (resolve, aggregate, persona, gated reviews)"
```

---

### Task 8: Deploy

- [ ] **Step 1: Deploy the new function**

Per `.claude/memory/deploy-function-conflicts.md`, deploy the single new function to avoid 409 conflicts:

Run: `firebase deploy --only functions:lookupCompanyReviews`
Expected: function deploys to `australia-southeast1`. If it 409s, wait and retry once — do not rapid-fire redeploys.

- [ ] **Step 2: Verify region + reachability**

Confirm in the Firebase console the function is in `australia-southeast1` (matches `setGlobalOptions` in `index.ts`).

---

## Self-Review

**Spec coverage:**
- Lookup endpoint w/ CRM-skip → domain → fuzzy → AI fallback → Tasks 2,3,5,7. ✅
- Aggregate summary + persona + 3 Pro reviews → Task 7. ✅
- Pro gating server-side via `isPro` roles → Tasks 4,7. ✅
- Cost control via persona cache + domain cache → Tasks 5,6,7. ✅
- Region `australia-southeast1` (global option) → Task 8. ✅
- Domain capture in P1 → realized as `company_domains` cache (Task 7), populated on resolve (noted refinement vs spec's unused `companies.domain`). ✅
- Display/auth panel, manifest/permissions, store, P2/P3 scrape → **belong to the extension plan (separate), not this one.** ✅

**Placeholders:** none — every code step is complete.

**Type consistency:** `CompanyRef {companyId, companyName}` used consistently across `matching.ts`, `resolver.ts`, `lookupCompanyReviews.ts`. `ResolverDeps`, `PersonaCacheDeps` signatures match their call sites. Return payload shape matches the spec's `lookupCompanyReviews` output.

**Note on `listCompanyNames`:** reads all `review_summaries` (capped ~200s today) and de-dupes in memory — fine at current scale. A dedicated company-names index is a later optimization (flagged in the spec's Open Questions).
