# Security & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two exploitable security vulnerabilities, remove a latent API key leak, and eliminate code duplication across constants and prop types.

**Architecture:** Changes span three layers — Cloud Functions (webhook debug endpoint, Firestore rules), the `geminiService` client module (dead client-side moderation path), and shared frontend constants/types. Each task is independent and can be reviewed/deployed separately.

**Tech Stack:** TypeScript, React 19, Firebase Cloud Functions v2, Firestore Security Rules, Vite

---

## File Map

| File | What changes |
|------|-------------|
| `functions/src/webhook.ts` | Add admin auth guard to `getWebhookDebugLogs` |
| `firestore.rules` | Tighten `/users/{userId}` write rule to field allowlist |
| `services/geminiService.ts` | Remove client-side `moderateReview` + `isGeminiAvailable`; stub them out |
| `pages/CreateReview.tsx` | Remove `moderateReview`/`isGeminiAvailable` import + call block |
| `package.json` | Remove `firebase-admin` from `devDependencies` |
| `src/constants/dealData.ts` | **New file** — single source of truth for DEPARTMENTS, TCV_BRACKETS, DURATION_BRACKETS |
| `pages/CreateReview.tsx` | Import constants from `src/constants/dealData.ts` |
| `pages/GlobalTrends.tsx` | Import constants from `src/constants/dealData.ts` |
| `mockReviews.ts` | Import constants from `src/constants/dealData.ts` |
| `pages/CompanyProfile.tsx` | `user: any` → `user: MappedUser \| null` |
| `pages/CreateReview.tsx` | `user: any` → `user: MappedUser \| null` |
| `pages/GlobalTrends.tsx` | `user: any` → `user: MappedUser \| null` |
| `pages/MyIntel.tsx` | `user: any` → `user: MappedUser \| null` |
| `pages/Home.tsx` | `user: any` → `user: MappedUser \| null` |
| `pages/Pricing.tsx` | `user: any` → `user: MappedUser \| null` |
| `src/hooks/useTracking.ts` | Remove writing `email`/`name` on track toggle |

---

## Task 1: Lock the `getWebhookDebugLogs` endpoint

This endpoint returns Stripe customer IDs, Firebase UIDs, and subscription data with no authentication. It was a debugging tool that was never secured before shipping.

**Files:**
- Modify: `functions/src/webhook.ts` (the `getWebhookDebugLogs` export at the bottom of the file)

- [ ] **Step 1: Open the file and locate the endpoint**

Open `functions/src/webhook.ts`. The `getWebhookDebugLogs` function starts at roughly line 375. It currently looks like:

```ts
export const getWebhookDebugLogs = onRequest(
  { cors: true },
  async (req, res) => {
    res.removeHeader("x-powered-by");
    try {
      const snap = await db
        .collection("webhooks_debug")
        .orderBy("startTime", "desc")
        .limit(20)
        .get();
      const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(logs);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  },
);
```

- [ ] **Step 2: Replace the endpoint with an admin-guarded version**

Replace the entire `getWebhookDebugLogs` export with this:

```ts
/**
 * Diagnostic endpoint — returns recent webhook debug logs.
 * Requires a valid Firebase ID token with role === 'admin'.
 */
export const getWebhookDebugLogs = onRequest(
  { cors: true },
  async (req, res) => {
    res.removeHeader("x-powered-by");

    // Verify Bearer token
    const authHeader = req.headers.authorization ?? "";
    const idToken = authHeader.replace("Bearer ", "").trim();
    if (!idToken) {
      res.status(401).send("Unauthorized: missing token");
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(idToken);
      if ((decoded as any).role !== "admin") {
        res.status(403).send("Forbidden: admin only");
        return;
      }
    } catch {
      res.status(401).send("Unauthorized: invalid token");
      return;
    }

    try {
      const snap = await db
        .collection("webhooks_debug")
        .orderBy("startTime", "desc")
        .limit(20)
        .get();
      const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(logs);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  },
);
```

Note: `auth` is already imported at the top of the file (`import { db, auth } from "./lib/firebaseAdmin"`).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho/functions
npm run build
```

Expected: exits with code 0 and outputs files to `lib/`. Fix any type errors before proceeding.

- [ ] **Step 4: Commit**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho
git add functions/src/webhook.ts
git commit -m "security: require admin token on getWebhookDebugLogs endpoint"
```

---

## Task 2: Tighten Firestore user write rules (privilege escalation fix)

Currently any authenticated user can write any field to their own `/users/{uid}` document — including `role` and `tier`. This means a user can set `role: "paid"` on their own document and the client-side `useAuth` hook will read it and grant them paid access.

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Open the file and locate the users rule**

Open `firestore.rules`. Find the `match /users/{userId}` block. It currently reads:

```
match /users/{userId} {
  allow read: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
  allow write: if isAdmin() || (isSignedIn() && request.auth.uid == userId);
}
```

- [ ] **Step 2: Replace with a field-allowlist rule**

The write rule must be split: admins retain full write access (they need to set `role`, `tier`, etc. from the backend via Admin SDK which bypasses rules anyway). Regular users may only write safe preference fields.

Replace the `match /users/{userId}` block with:

```
// ── Users ──────────────────────────────────────────────────────────────────
// Users can read their own profile; admins can read all.
// Users can ONLY update safe preference fields — billing/role fields are
// written exclusively by Cloud Functions via the Admin SDK (bypasses rules).
match /users/{userId} {
  allow read: if isAdmin() || (isSignedIn() && request.auth.uid == userId);

  // Full write for admins (Admin SDK bypasses rules anyway, but this covers
  // any future admin panel writes that use the client SDK).
  allow write: if isAdmin();

  // Users can update only their own safe fields.
  allow update: if isSignedIn()
    && request.auth.uid == userId
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['trackedCompanies', 'notificationPreferences', 'updatedAt']);
}
```

- [ ] **Step 3: Verify rules deploy without errors**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho
firebase deploy --only firestore:rules
```

Expected output ends with `✔  Deploy complete!`. If you see a rules syntax error, re-check indentation — Firestore rules are whitespace-sensitive.

- [ ] **Step 4: Smoke-test the rules manually**

Open the Firebase Console → Firestore → Rules → "Rules playground". Test these two scenarios:

**Should PASS (allowed):** Authenticated user updating their own `trackedCompanies`
- Auth: provide a valid UID
- Operation: `update`
- Path: `/databases/(default)/documents/users/<that-uid>`
- Data: `{ "trackedCompanies": ["company-1"] }`

**Should FAIL (blocked):** Same user trying to set their own `role`
- Same auth/path
- Data: `{ "role": "paid" }`
- Expected result: DENIED

- [ ] **Step 5: Commit**

```bash
git add firestore.rules
git commit -m "security: restrict user self-write to safe preference fields only"
```

---

## Task 3: Remove client-side Gemini moderation (API key leak risk)

`services/geminiService.ts` contains `moderateReview()` and `isGeminiAvailable()` which attempt to call the Gemini API client-side using `process.env.API_KEY`. Vite doesn't expose this variable today, but if it were ever defined (via CI env injection or a `.env` file), it would be bundled into the public JS. The Cloud Function `onReviewWritten` is already the authoritative moderation layer — the client path is dead weight.

**Files:**
- Modify: `services/geminiService.ts`
- Modify: `pages/CreateReview.tsx`

- [ ] **Step 1: Stub out the two functions in `geminiService.ts`**

Open `services/geminiService.ts`. Find and replace the `isGeminiAvailable` function and the entire `moderateReview` function.

Replace `isGeminiAvailable`:
```ts
/** @deprecated Moderation runs server-side in Cloud Functions. Always returns false. */
export const isGeminiAvailable = (): boolean => false;
```

Replace the entire `moderateReview` function (it currently instantiates `GoogleGenAI` with `process.env.API_KEY`):
```ts
/**
 * @deprecated Client-side moderation removed — the Cloud Function onReviewWritten
 * is the authoritative moderation layer. Reviews are held as 'pending' until approved.
 */
export const moderateReview = async (
  _content: string,
): Promise<AIModerationResult> => {
  return { isSafe: true };
};
```

Do NOT remove the function signatures — `CreateReview.tsx` imports them and we'll clean that up in the next step.

- [ ] **Step 2: Remove the moderation call block from `CreateReview.tsx`**

Open `pages/CreateReview.tsx`. Find this block inside `handleSubmit` (around line 145):

```ts
    if (isGeminiAvailable()) {
      const moderation = await moderateReview(content);
      if (!moderation.isSafe) {
        setError(
          `Flagged: ${moderation.reason}. Please ensure no personal names are included.`,
        );
        setIsSubmitting(false);
        return;
      }
    }
```

Delete the entire block. The submit flow should proceed directly to building `newReview` after the existing validation check.

- [ ] **Step 3: Clean up the import in `CreateReview.tsx`**

At the top of `pages/CreateReview.tsx`, find:

```ts
import {
  searchCompanies,
  moderateReview,
  isGeminiAvailable,
} from "../services/geminiService";
```

Remove `moderateReview` and `isGeminiAvailable` from the import. Leave `searchCompanies`:

```ts
import { searchCompanies } from "../services/geminiService";
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho
npx tsc --noEmit
```

Expected: no errors. If you see "moderateReview is not exported", the stub in step 1 is missing — add it back.

- [ ] **Step 5: Commit**

```bash
git add services/geminiService.ts pages/CreateReview.tsx
git commit -m "security: remove client-side Gemini moderation path, server is authoritative"
```

---

## Task 4: Remove `firebase-admin` from frontend `devDependencies`

`firebase-admin` is a Node.js-only package that has no place in the frontend `package.json`. It's only used by `admin/adminConfig.ts` (local admin scripts) and the Cloud Functions.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove the dependency**

Open `package.json` at the root of the project. In `devDependencies`, remove this line:

```json
"firebase-admin": "^13.6.1",
```

- [ ] **Step 2: Reinstall to update lockfile**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho
npm install
```

Expected: `package-lock.json` is updated and `firebase-admin` no longer appears under the root `node_modules` (it still exists inside `functions/node_modules/`).

- [ ] **Step 3: Verify the build still works**

```bash
npm run build
```

Expected: Vite builds successfully with no errors. If you see "Cannot find module 'firebase-admin'" it means something in the client bundle was accidentally importing it — search the non-`functions/` source files for `import.*firebase-admin` and remove those imports.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove firebase-admin from frontend devDependencies"
```

---

## Task 5: Extract shared constants to a single source of truth

`DEPARTMENTS`, `TCV_BRACKETS`/`TCV_ORDER`, and `DURATION_BRACKETS`/`DURATION_ORDER` are each defined in 2–3 places. A mismatch between them would cause silent data inconsistencies (e.g. a filter value that exists in analytics but not in the form dropdown).

**Files:**
- Create: `src/constants/dealData.ts`
- Modify: `pages/CreateReview.tsx`
- Modify: `pages/GlobalTrends.tsx`
- Modify: `mockReviews.ts`

- [ ] **Step 1: Create `src/constants/dealData.ts`**

Create a new file at `src/constants/dealData.ts` with this exact content:

```ts
export const DEPARTMENTS = [
  "IT / Engineering",
  "Security / InfoSec",
  "Data Privacy / DPO",
  "Procurement",
  "Finance / Treasury",
  "Legal / Compliance",
  "Executive Leadership (C-Suite)",
  "Marketing",
  "Sales / Business Development",
  "Operations / Enablement",
  "HR / People Ops",
  "Product Management",
  "Customer Success / Support",
  "Supply Chain / Logistics",
  "Facilities / Real Estate",
  "R&D / Innovation",
  "Strategy / Corporate Dev",
  "Quality Assurance / QA",
  "Regulatory / Gov Affairs",
  "External Consultants / Advisors",
  "Board of Directors",
].sort() as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Ordered smallest → largest. Used in forms and analytics matrix. */
export const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M+",
] as const;

export type TcvBracket = (typeof TCV_BRACKETS)[number];

/** Ordered shortest → longest. Used in forms and analytics matrix. */
export const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12+ Months",
] as const;

export type DurationBracket = (typeof DURATION_BRACKETS)[number];
```

- [ ] **Step 2: Update `pages/CreateReview.tsx`**

At the top of `pages/CreateReview.tsx`, add this import after the existing imports:

```ts
import { DEPARTMENTS, TCV_BRACKETS, DURATION_BRACKETS } from "../src/constants/dealData";
```

Then delete the three local constant definitions in the file:

- The `const DEPARTMENTS = [ ... ].sort();` block (around line 21)
- The `const TCV_BRACKETS = [ ... ];` block (around line 45)
- The `const DURATION_BRACKETS = [ ... ];` block (around line 56)

The rest of the file uses these names unchanged — no other edits needed.

- [ ] **Step 3: Update `pages/GlobalTrends.tsx`**

Add this import after the existing imports at the top:

```ts
import { DEPARTMENTS, TCV_BRACKETS as TCV_ORDER, DURATION_BRACKETS as DURATION_ORDER } from "../src/constants/dealData";
```

Then delete the three local constant definitions:
- `const DEPARTMENTS = [ ... ];` (around line 13)
- `const TCV_ORDER = [ ... ];` (around line 21)
- `const DURATION_ORDER = [ ... ];` (around line 22)

The rest of the file references `TCV_ORDER` and `DURATION_ORDER` — the import alias handles this, no other changes needed.

- [ ] **Step 4: Update `mockReviews.ts`**

Add this import after the existing imports:

```ts
import { DEPARTMENTS, TCV_BRACKETS } from "./src/constants/dealData";
```

Then delete the local definitions:
- `const DEPARTMENTS = [ ... ];` (around line 53)
- `const TCV_BRACKETS = [ ... ];` (around line 47)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/brendanreid/Documents/~Claude/dealecho
npx tsc --noEmit
```

Expected: no errors. Common issue: if `as const` causes type errors downstream (e.g. `useState(TCV_BRACKETS[0])` infers a too-narrow type), cast to `string` at the call site: `useState<string>(TCV_BRACKETS[0])`.

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exits with code 0.

- [ ] **Step 7: Commit**

```bash
git add src/constants/dealData.ts pages/CreateReview.tsx pages/GlobalTrends.tsx mockReviews.ts
git commit -m "refactor: extract DEPARTMENTS, TCV_BRACKETS, DURATION_BRACKETS to shared constants"
```

---

## Task 6: Replace `user: any` with `MappedUser | null` across all pages

Six page components accept `user: any` in their props interface. Using the already-exported `MappedUser` type catches bugs at compile time and makes IDE autocomplete work on user fields.

**Files:**
- Modify: `pages/CompanyProfile.tsx`
- Modify: `pages/CreateReview.tsx`
- Modify: `pages/GlobalTrends.tsx`
- Modify: `pages/MyIntel.tsx`
- Modify: `pages/Home.tsx`
- Modify: `pages/Pricing.tsx`

- [ ] **Step 1: Update `pages/CompanyProfile.tsx`**

Add this import near the top (after the existing `types` import):
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the `CompanyProfileProps` interface, change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 2: Update `pages/CreateReview.tsx`**

Add this import:
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the `CreateReviewProps` interface, change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 3: Update `pages/GlobalTrends.tsx`**

Add this import:
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the `GlobalTrendsProps` interface, change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 4: Update `pages/MyIntel.tsx`**

Add this import:
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the `MyIntelProps` interface, change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 5: Update `pages/Home.tsx`**

Add this import:
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the `HomeProps` interface (or wherever `user: any` appears), change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 6: Update `pages/Pricing.tsx`**

Add this import:
```ts
import { MappedUser } from "../src/hooks/useAuth";
```

In the props interface, change:
```ts
user: any;
```
to:
```ts
user: MappedUser | null;
```

- [ ] **Step 7: Fix any TypeScript errors that surface**

Run:
```bash
npx tsc --noEmit
```

The type change may surface places where code accesses `user.uid` (should be `user.id` per `MappedUser`) or other field name mismatches. Fix each one — these are real bugs the `any` type was hiding. Common fixes:
- `user.uid` → `user.id`
- `user?.uid` → `user?.id`

- [ ] **Step 8: Commit**

```bash
git add pages/CompanyProfile.tsx pages/CreateReview.tsx pages/GlobalTrends.tsx pages/MyIntel.tsx pages/Home.tsx pages/Pricing.tsx
git commit -m "refactor: replace user:any with MappedUser|null across all page props"
```

---

## Task 7: Fix `useTracking` to stop writing `email`/`name` on every toggle

Every time a user tracks or untracks a company, `useTracking` writes their `email` and `name` from the client into Firestore. With the tightened rules from Task 2, this write will now be **blocked** (those fields aren't in the allowlist). This task brings the hook into compliance.

**Files:**
- Modify: `src/hooks/useTracking.ts`

- [ ] **Step 1: Remove email/name from the `saveTracking` write**

Open `src/hooks/useTracking.ts`. Find the `saveTracking` callback. It currently calls:

```ts
await setDoc(userDocRef, { email: getAuth().currentUser?.email ?? "", name: getAuth().currentUser?.displayName ?? "", trackedCompanies: newTracked }, { merge: true });
```

Replace with:
```ts
await setDoc(userDocRef, { trackedCompanies: newTracked, updatedAt: new Date().toISOString() }, { merge: true });
```

- [ ] **Step 2: Remove the unused `getAuth` import**

At the top of `src/hooks/useTracking.ts`, find:
```ts
import { getAuth } from 'firebase/auth';
```

Delete that line — `getAuth` is no longer used.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTracking.ts
git commit -m "fix: remove email/name from useTracking Firestore write, comply with user field allowlist"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| CRITICAL-1: Lock `getWebhookDebugLogs` | Task 1 ✅ |
| CRITICAL-3: Tighten Firestore user write rules | Task 2 ✅ |
| CRITICAL-2: Remove client-side Gemini API key usage | Task 3 ✅ |
| HIGH-1: Remove `firebase-admin` from frontend deps | Task 4 ✅ |
| OPT-3: Extract shared constants | Task 5 ✅ |
| OPT-6: Replace `user: any` with `MappedUser \| null` | Task 6 ✅ |
| OPT-5: Fix `useTracking` writing email/name | Task 7 ✅ — Note: this task MUST run after Task 2 (the tighter rules will block the old write pattern) |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `MappedUser` is imported from `../src/hooks/useAuth` consistently across all 6 page files. `DEPARTMENTS`, `TCV_BRACKETS`, `DURATION_BRACKETS` match the names used by the import aliases in Task 5.

**Order dependency:** Task 7 must be committed before or alongside deploying Task 2 rules — if the tighter Firestore rules go live first, the old `useTracking` write will silently fail (console error only, no UX break). Safe to do in either order but note the dependency.
