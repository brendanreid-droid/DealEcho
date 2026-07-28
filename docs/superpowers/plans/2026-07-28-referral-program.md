# Referral Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro members invite colleagues by email; when an invitee subscribes to Pro and their first real payment succeeds, the referrer gets one month of Stripe account credit.

**Architecture:** A single Firestore collection `referral_invites/{token}` carries the whole lifecycle. Three callables handle sending, claiming and reading status. The reward is granted from a new `invoice.payment_succeeded` case in the existing `stripeWebhook`, gated on `amount_paid > 0` so the 30-day trial cannot be farmed. All business rules that can be expressed as pure functions live in `functions/src/referrals/logic.ts` and are unit-tested directly, matching the existing `accountFlags.ts` / `accountFlags.test.ts` pattern.

**Tech Stack:** Firebase Cloud Functions v2 (Node 22, TypeScript), Firestore, Stripe SDK 17.7.0 (API `2025-01-27.acacia`), Resend + React Email, React 19 + Vite + Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-referral-program-design.md`

---

## Three deliberate refinements to the spec

Note these before starting; they are improvements agreed during planning, not drift.

1. **Directory instead of one file.** The spec said `functions/src/referrals.ts`. This plan uses `functions/src/referrals/` (`logic.ts`, `callables.ts`, `grantCredit.ts`) so the pure, testable rules stay separate from the Firebase-coupled code.
2. **Extra `rewarding` status.** The spec's transition was `signed_up -> rewarded`. This plan inserts a short-lived `rewarding` status held across the Stripe call. Without it there is a window where Firestore claims `rewarded` but the Stripe credit does not exist yet.
3. **Counter doc instead of counting invites.** The spec enforced invite rate limits by counting documents. This plan uses a `referral_quota/{uid}` counter updated inside a Firestore transaction, because a count query cannot be made atomic against concurrent calls.

4. **Fourth index.** The spec listed three composite indexes. The duplicate-invite check in `sendReferralInvites` needs a fourth (`referrerUid` + `email` + `status`), so Task 7 adds four.

## Test coverage boundary

This repo's function tests are pure unit tests with no Firestore emulator or Admin SDK mocking (see `functions/src/accountFlags.test.ts`). Task 1 therefore covers every rule that can be expressed as a pure function: reward qualification, the cap, expiry, quota maths, token shape, email validation.

Three behaviours the spec listed as tests are **transaction semantics, not logic**, and cannot be unit-tested under the current setup:

- duplicate `invoice.payment_succeeded` crediting exactly once
- self-referral and already-paid claims being rejected
- second claim on a used token being a no-op

The correctness of these rests on the Firestore transaction guards in Tasks 4 and 6 plus the Stripe idempotency key. They are covered by the manual Stripe test-mode walkthrough at the end of this plan, steps 4, 6 and 7. Do not claim them as automated coverage.

---

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `functions/src/referrals/logic.ts` | Pure rules: token generation, email validation, expiry, reward qualification, cap and quota maths. No Firebase or Stripe imports. |
| `functions/src/referrals/logic.test.ts` | Unit tests for all of the above. |
| `functions/src/referrals/callables.ts` | `sendReferralInvites`, `claimReferral`, `getReferralStatus`. |
| `functions/src/referrals/grantCredit.ts` | `grantReferralCredit` - the payout path, called by the webhook. |
| `functions/src/emails/ReferralInviteEmail.tsx` | Invite email. |
| `functions/src/emails/ReferralRewardEmail.tsx` | "You earned a free month" email. |
| `src/utils/referral.ts` | Frontend `?invite=` capture, localStorage persistence, clearing. |
| `src/utils/referral.test.ts` | Unit tests for the above. |
| `pages/Referrals.tsx` | The `/referrals` page. |
| `pages/Referrals.test.tsx` | Render tests for eligible / ineligible / at-cap states. |

**Modify:**
| File | Change |
|---|---|
| `functions/src/webhook.ts` | Add `invoice.payment_succeeded` case. |
| `functions/src/index.ts` | Export the three new callables. |
| `firestore.rules` | Deny all client access to `referral_invites` and `referral_quota`. |
| `firestore.indexes.json` | Three composite indexes. |
| `App.tsx` | `/referrals` route; call `claimReferral` in both signup branches. |
| `pages/MyIntel.tsx` | Entry card linking to `/referrals`. |
| `.github/workflows/deploy-functions.yml` | Deploy step for the new functions. |

---

## Task 1: Pure referral logic

**Files:**
- Create: `functions/src/referrals/logic.ts`
- Test: `functions/src/referrals/logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `functions/src/referrals/logic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  REWARD_CAP_PER_YEAR,
  DAILY_INVITE_LIMIT,
  LIFETIME_INVITE_LIMIT,
  MAX_EMAILS_PER_CALL,
  INVITE_EXPIRY_DAYS,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  isInviteExpired,
  expiryFor,
  qualifiesForReward,
  isCapReached,
  dayKeyFor,
  nextQuotaState,
} from "./logic";

describe("generateInviteToken", () => {
  it("produces a 32-character URL-safe token", () => {
    const token = generateInviteToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("does not repeat across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateInviteToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("normaliseEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseEmail("  Bob@Acme.COM ")).toBe("bob@acme.com");
  });

  it("returns an empty string for non-string input", () => {
    expect(normaliseEmail(undefined as unknown as string)).toBe("");
    expect(normaliseEmail(42 as unknown as string)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary work addresses", () => {
    expect(isValidEmail("bob@acme.com")).toBe(true);
    expect(isValidEmail("bob.smith+tag@sub.acme.co.uk")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("bob")).toBe(false);
    expect(isValidEmail("bob@")).toBe(false);
    expect(isValidEmail("@acme.com")).toBe(false);
    expect(isValidEmail("bob@acme")).toBe(false);
    expect(isValidEmail("bob acme@test.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects absurdly long addresses", () => {
    expect(isValidEmail(`${"a".repeat(250)}@acme.com`)).toBe(false);
  });
});

describe("expiryFor / isInviteExpired", () => {
  const sentAt = "2026-01-01T00:00:00.000Z";

  it("sets expiry INVITE_EXPIRY_DAYS after sending", () => {
    const expiresAt = expiryFor(sentAt);
    const days = (Date.parse(expiresAt) - Date.parse(sentAt)) / 86_400_000;
    expect(days).toBe(INVITE_EXPIRY_DAYS);
  });

  it("is not expired one day before the deadline", () => {
    expect(isInviteExpired({ expiresAt: expiryFor(sentAt) }, new Date("2026-02-28T00:00:00.000Z"))).toBe(false);
  });

  it("is expired one day after the deadline", () => {
    expect(isInviteExpired({ expiresAt: expiryFor(sentAt) }, new Date("2026-03-05T00:00:00.000Z"))).toBe(true);
  });

  it("treats a missing or unparseable expiry as expired", () => {
    expect(isInviteExpired({ expiresAt: undefined }, new Date())).toBe(true);
    expect(isInviteExpired({ expiresAt: "not-a-date" }, new Date())).toBe(true);
  });
});

describe("qualifiesForReward", () => {
  const invoice = (over: Record<string, unknown> = {}) => ({
    subscription: "sub_123",
    amount_paid: 2900,
    billing_reason: "subscription_cycle",
    ...over,
  });

  it("qualifies a paid renewal invoice", () => {
    expect(qualifiesForReward(invoice())).toBe(true);
  });

  it("qualifies a paid first invoice when the trial was skipped", () => {
    expect(qualifiesForReward(invoice({ billing_reason: "subscription_create" }))).toBe(true);
  });

  it("rejects a zero-amount trial invoice", () => {
    expect(qualifiesForReward(invoice({ amount_paid: 0 }))).toBe(false);
  });

  it("rejects an invoice with no subscription", () => {
    expect(qualifiesForReward(invoice({ subscription: null }))).toBe(false);
  });

  it("rejects mid-cycle updates and manual invoices", () => {
    expect(qualifiesForReward(invoice({ billing_reason: "subscription_update" }))).toBe(false);
    expect(qualifiesForReward(invoice({ billing_reason: "manual" }))).toBe(false);
  });

  it("reads the subscription from invoice.parent when the API moves it", () => {
    expect(
      qualifiesForReward({
        amount_paid: 2900,
        billing_reason: "subscription_cycle",
        parent: { subscription_details: { subscription: "sub_456" } },
      }),
    ).toBe(true);
  });
});

describe("isCapReached", () => {
  it("allows rewards below the cap", () => {
    expect(isCapReached(0)).toBe(false);
    expect(isCapReached(REWARD_CAP_PER_YEAR - 1)).toBe(false);
  });

  it("blocks at and beyond the cap", () => {
    expect(isCapReached(REWARD_CAP_PER_YEAR)).toBe(true);
    expect(isCapReached(REWARD_CAP_PER_YEAR + 5)).toBe(true);
  });
});

describe("dayKeyFor", () => {
  it("returns a UTC calendar day key", () => {
    expect(dayKeyFor(new Date("2026-07-28T23:59:59.000Z"))).toBe("2026-07-28");
    expect(dayKeyFor(new Date("2026-07-29T00:00:01.000Z"))).toBe("2026-07-29");
  });
});

describe("nextQuotaState", () => {
  const now = new Date("2026-07-28T10:00:00.000Z");

  it("starts a fresh counter when there is no prior state", () => {
    const out = nextQuotaState(undefined, 3, now);
    expect(out.allowed).toBe(3);
    expect(out.state).toEqual({ dayKey: "2026-07-28", sentToday: 3, sentLifetime: 3 });
  });

  it("accumulates within the same day", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 5, sentLifetime: 40 };
    const out = nextQuotaState(prior, 2, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(7);
    expect(out.state.sentLifetime).toBe(42);
  });

  it("resets the daily counter on a new day", () => {
    const prior = { dayKey: "2026-07-27", sentToday: DAILY_INVITE_LIMIT, sentLifetime: 40 };
    const out = nextQuotaState(prior, 2, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(2);
    expect(out.state.sentLifetime).toBe(42);
  });

  it("clamps a request that would exceed the daily limit", () => {
    const prior = { dayKey: "2026-07-28", sentToday: DAILY_INVITE_LIMIT - 2, sentLifetime: 40 };
    const out = nextQuotaState(prior, 5, now);
    expect(out.allowed).toBe(2);
    expect(out.state.sentToday).toBe(DAILY_INVITE_LIMIT);
  });

  it("allows nothing once the daily limit is spent", () => {
    const prior = { dayKey: "2026-07-28", sentToday: DAILY_INVITE_LIMIT, sentLifetime: 40 };
    expect(nextQuotaState(prior, 3, now).allowed).toBe(0);
  });

  it("clamps against the lifetime limit", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 0, sentLifetime: LIFETIME_INVITE_LIMIT - 1 };
    const out = nextQuotaState(prior, 5, now);
    expect(out.allowed).toBe(1);
    expect(out.state.sentLifetime).toBe(LIFETIME_INVITE_LIMIT);
  });

  it("never returns a negative allowance", () => {
    const prior = { dayKey: "2026-07-28", sentToday: 999, sentLifetime: 9999 };
    expect(nextQuotaState(prior, 3, now).allowed).toBe(0);
  });
});

describe("limits", () => {
  it("exposes the agreed constants", () => {
    expect(REWARD_CAP_PER_YEAR).toBe(12);
    expect(DAILY_INVITE_LIMIT).toBe(20);
    expect(LIFETIME_INVITE_LIMIT).toBe(200);
    expect(MAX_EMAILS_PER_CALL).toBe(10);
    expect(INVITE_EXPIRY_DAYS).toBe(60);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -w functions -- logic.test.ts
```

Expected: FAIL, `Failed to resolve import "./logic"`.

- [ ] **Step 3: Write the implementation**

Create `functions/src/referrals/logic.ts`:

```ts
import { randomBytes } from "crypto";

/** Rewarded referrals allowed per referrer per rolling 365 days. */
export const REWARD_CAP_PER_YEAR = 12;
/** Invites a referrer may send per UTC day. */
export const DAILY_INVITE_LIMIT = 20;
/** Invites a referrer may send in total, ever. */
export const LIFETIME_INVITE_LIMIT = 200;
/** Addresses accepted in a single sendReferralInvites call. */
export const MAX_EMAILS_PER_CALL = 10;
/** Days an unclaimed invite stays valid. */
export const INVITE_EXPIRY_DAYS = 60;
/** Rolling reward-cap window, in milliseconds. */
export const REWARD_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export type InviteStatus =
  | "sent"
  | "signed_up"
  | "rewarding"
  | "rewarded"
  | "capped"
  | "expired"
  | "void";

export interface QuotaState {
  dayKey: string;
  sentToday: number;
  sentLifetime: number;
}

/**
 * 32-character URL-safe token. 24 random bytes base64url-encode to exactly 32
 * characters with no padding, so the token can go straight into a query string.
 */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normaliseEmail(raw: string): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Deliberately conservative: one @, no whitespace, a dot in the domain. We are
 * gatekeeping outbound mail to third parties, so a false negative (user retypes
 * the address) is much cheaper than a false positive (we spray invalid sends
 * and hurt our sending reputation).
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  if (email.length === 0 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export function expiryFor(sentAtIso: string): string {
  return new Date(Date.parse(sentAtIso) + INVITE_EXPIRY_DAYS * 86_400_000).toISOString();
}

/** A missing or unparseable expiry counts as expired: fail closed. */
export function isInviteExpired(invite: { expiresAt?: string }, now: Date): boolean {
  const ms = Date.parse(invite.expiresAt ?? "");
  if (Number.isNaN(ms)) return true;
  return now.getTime() > ms;
}

/**
 * The anti-fraud gate. New Pro subscriptions get a 30-day trial, so a
 * subscription existing proves nothing. Only a real payment counts.
 *
 * `subscription` moved to `parent.subscription_details` in Stripe API
 * 2025-03-31.basil. We are pinned to 2025-01-27.acacia, but read both so a
 * future API bump degrades to "no reward" rather than "reward everyone".
 */
export function qualifiesForReward(invoice: {
  subscription?: unknown;
  amount_paid?: number;
  billing_reason?: string | null;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
}): boolean {
  const subscription =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null;
  if (!subscription) return false;
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return false;
  return (
    invoice.billing_reason === "subscription_cycle" ||
    invoice.billing_reason === "subscription_create"
  );
}

export function isCapReached(rewardedInWindow: number): boolean {
  return rewardedInWindow >= REWARD_CAP_PER_YEAR;
}

/** UTC calendar day, e.g. "2026-07-28". Quotas reset at UTC midnight. */
export function dayKeyFor(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Works out how many of `requested` invites may actually be sent, and the
 * counter state to persist. Pure so the caller can run it inside a Firestore
 * transaction, which is what makes the limit safe against concurrent calls.
 */
export function nextQuotaState(
  prior: QuotaState | undefined,
  requested: number,
  now: Date,
): { allowed: number; state: QuotaState } {
  const dayKey = dayKeyFor(now);
  const sameDay = prior?.dayKey === dayKey;
  const sentToday = sameDay ? (prior?.sentToday ?? 0) : 0;
  const sentLifetime = prior?.sentLifetime ?? 0;

  const dailyRoom = Math.max(0, DAILY_INVITE_LIMIT - sentToday);
  const lifetimeRoom = Math.max(0, LIFETIME_INVITE_LIMIT - sentLifetime);
  const allowed = Math.max(0, Math.min(requested, dailyRoom, lifetimeRoom));

  return {
    allowed,
    state: {
      dayKey,
      sentToday: sentToday + allowed,
      sentLifetime: sentLifetime + allowed,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -w functions -- logic.test.ts
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add functions/src/referrals/logic.ts functions/src/referrals/logic.test.ts
git commit -m "feat(referrals): pure referral rules with unit tests"
```

---

## Task 2: Email templates

**Files:**
- Create: `functions/src/emails/ReferralInviteEmail.tsx`
- Create: `functions/src/emails/ReferralRewardEmail.tsx`

No tests. These are presentational components matching `TeamInviteEmail.tsx`; the existing email templates have no tests either.

Copy rules for this repo: brand is always **Dealecho**, never "DealEcho", in user-facing text. Use plain hyphens, never em dashes.

- [ ] **Step 1: Create the invite email**

Create `functions/src/emails/ReferralInviteEmail.tsx`:

```tsx
import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface ReferralInviteEmailProps {
  referrerName: string;
  inviteUrl: string;
  recipientEmail: string;
}

export const ReferralInviteEmail: React.FC<ReferralInviteEmailProps> = ({
  referrerName,
  inviteUrl,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText={`${referrerName} thinks Dealecho would be useful to you.`}
    userEmail={recipientEmail}
    transactional
  >
    <Heading style={h1}>{referrerName} invited you to Dealecho</Heading>

    <Text style={paragraph}>
      Dealecho is where sales teams share what actually happened inside deals:
      who really held the budget, how long procurement took, why the deal was
      won or lost.
    </Text>

    <Text style={paragraph}>
      Your invite includes <strong>30 days of Sales Pro, free</strong>. No card
      charged until the trial ends.
    </Text>

    <Section style={ctaContainer}>
      <Button href={inviteUrl} style={primaryButton}>
        Claim your free month
      </Button>
    </Section>

    <Text style={subtext}>
      This invite expires in 60 days. If you weren't expecting it, you can
      safely ignore this email and we won't contact you again.
    </Text>

    <Text style={signoff}>
      Good selling,
      <br />
      <strong>The Dealecho Team</strong>
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' };
const ctaContainer = { textAlign: 'center' as const, margin: '32px 0 24px 0' };
const primaryButton = { backgroundColor: '#4f46e5', borderRadius: '14px', color: '#ffffff', fontSize: '14px', fontWeight: '800', textDecoration: 'none', textAlign: 'center' as const, display: 'inline-block', padding: '16px 32px' };
const subtext = { color: '#64748b', fontSize: '12px', lineHeight: '1.6', margin: '24px 0 0 0' };
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
```

- [ ] **Step 2: Create the reward email**

Create `functions/src/emails/ReferralRewardEmail.tsx`:

```tsx
import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';
import { CONTROL_CENTRE_URL } from '../lib/constants';

interface ReferralRewardEmailProps {
  referrerName: string;
  refereeEmail: string;
  recipientEmail: string;
}

export const ReferralRewardEmail: React.FC<ReferralRewardEmailProps> = ({
  referrerName,
  refereeEmail,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText="Your referral came through. A free month is on your account."
    userEmail={recipientEmail}
    transactional
  >
    <Heading style={h1}>You've earned a free month</Heading>

    <Text style={paragraph}>
      Nice work, {referrerName}. {refereeEmail} joined Dealecho on Sales Pro and
      their first payment has gone through, so a free month of credit is now
      sitting on your account.
    </Text>

    <Text style={paragraph}>
      The credit applies automatically to your next invoice. Nothing for you to
      do.
    </Text>

    <Section style={ctaContainer}>
      <Button href={`${CONTROL_CENTRE_URL}`} style={primaryButton}>
        View your referrals
      </Button>
    </Section>

    <Text style={signoff}>
      Good selling,
      <br />
      <strong>The Dealecho Team</strong>
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' };
const ctaContainer = { textAlign: 'center' as const, margin: '32px 0 24px 0' };
const primaryButton = { backgroundColor: '#4f46e5', borderRadius: '14px', color: '#ffffff', fontSize: '14px', fontWeight: '800', textDecoration: 'none', textAlign: 'center' as const, display: 'inline-block', padding: '16px 32px' };
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
```

- [ ] **Step 3: Verify both compile**

```bash
npm run build -w functions
```

Expected: exit 0, no TypeScript errors. If `CONTROL_CENTRE_URL` is not exported from `functions/src/lib/constants.ts`, check the actual export name in that file and use it (`Layout.tsx` imports it, so it exists).

- [ ] **Step 4: Commit**

```bash
git add functions/src/emails/ReferralInviteEmail.tsx functions/src/emails/ReferralRewardEmail.tsx
git commit -m "feat(referrals): invite and reward email templates"
```

---

## Task 3: `sendReferralInvites` callable

**Files:**
- Create: `functions/src/referrals/callables.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the callable**

Create `functions/src/referrals/callables.ts`:

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as React from "react";
import { db, auth } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import { ReferralInviteEmail } from "../emails/ReferralInviteEmail";
import {
  MAX_EMAILS_PER_CALL,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  expiryFor,
  nextQuotaState,
  type QuotaState,
} from "./logic";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://dealecho.io";

export type InviteResult =
  | "sent"
  | "already_member"
  | "already_invited"
  | "invalid"
  | "self"
  | "rate_limited"
  | "send_failed";

function assertPaid(request: { auth?: { token?: unknown } | null }): void {
  const role = (request.auth?.token as any)?.role;
  if (role !== "paid" && role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Referrals are a Sales Pro benefit. Upgrade to invite colleagues.",
    );
  }
}

async function referralsEnabled(): Promise<boolean> {
  const snap = await db.collection("config").doc("features").get();
  return snap.data()?.referralsEnabled !== false;
}

/** True when this address already has a Dealecho account. */
async function emailIsRegistered(email: string): Promise<boolean> {
  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") return false;
    throw err;
  }
}

export const sendReferralInvites = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    assertPaid(request);

    if (!(await referralsEnabled())) {
      throw new HttpsError("failed-precondition", "Referrals aren't available yet.");
    }

    const uid = request.auth.uid;
    const callerEmail = normaliseEmail(request.auth.token.email ?? "");

    const rawEmails: unknown = request.data?.emails;
    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
      throw new HttpsError("invalid-argument", "Provide at least one email address.");
    }
    if (rawEmails.length > MAX_EMAILS_PER_CALL) {
      throw new HttpsError(
        "invalid-argument",
        `You can invite up to ${MAX_EMAILS_PER_CALL} people at a time.`,
      );
    }

    // 1. Validate and de-duplicate before spending any quota.
    const results: Array<{ email: string; result: InviteResult }> = [];
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawEmails) {
      const email = normaliseEmail(raw as string);
      if (!isValidEmail(email)) {
        results.push({ email: String(raw).slice(0, 120), result: "invalid" });
        continue;
      }
      if (email === callerEmail) {
        results.push({ email, result: "self" });
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);

      if (await emailIsRegistered(email)) {
        results.push({ email, result: "already_member" });
        continue;
      }

      const existing = await db
        .collection("referral_invites")
        .where("referrerUid", "==", uid)
        .where("email", "==", email)
        .where("status", "==", "sent")
        .limit(1)
        .get();
      if (!existing.empty) {
        results.push({ email, result: "already_invited" });
        continue;
      }

      candidates.push(email);
    }

    if (candidates.length === 0) return { results };

    // 2. Reserve quota atomically. Counting documents cannot be made safe
    //    against concurrent calls; a transactional counter can.
    const quotaRef = db.collection("referral_quota").doc(uid);
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(quotaRef);
      const prior = snap.exists ? (snap.data() as QuotaState) : undefined;
      const { allowed, state } = nextQuotaState(prior, candidates.length, new Date());
      if (allowed > 0) tx.set(quotaRef, state, { merge: true });
      return allowed;
    });

    for (const email of candidates.slice(allowed)) {
      results.push({ email, result: "rate_limited" });
    }

    // 3. Create invites and send.
    const referrer = await auth.getUser(uid);
    const referrerName =
      referrer.displayName || referrer.email?.split("@")[0] || "A Dealecho member";

    for (const email of candidates.slice(0, allowed)) {
      const token = generateInviteToken();
      const sentAt = new Date().toISOString();

      await db.collection("referral_invites").doc(token).set({
        token,
        referrerUid: uid,
        email,
        status: "sent",
        sentAt,
        expiresAt: expiryFor(sentAt),
        refereeUid: null,
        signedUpAt: null,
        emailMismatch: false,
        rewardedAt: null,
        rewardAmountCents: null,
        rewardCurrency: null,
        stripeInvoiceId: null,
        capReason: null,
      });

      try {
        await sendReactEmail({
          to: email,
          subject: `${referrerName} invited you to Dealecho`,
          component: React.createElement(ReferralInviteEmail, {
            referrerName,
            inviteUrl: `${FRONTEND_URL}/?invite=${token}`,
            recipientEmail: email,
          }),
        });
        results.push({ email, result: "sent" });
      } catch (err) {
        // Void rather than delete: keeps an audit trail of the attempt, and
        // stops the UI showing an invite that never actually left the building.
        console.error("sendReferralInvites email failed:", (err as Error).message);
        await db.collection("referral_invites").doc(token).update({ status: "void" });
        results.push({ email, result: "send_failed" });
      }
    }

    return { results };
  },
);
```

- [ ] **Step 2: Export it**

In `functions/src/index.ts`, add after the enterprise export block:

```ts
// Referral Program
export { sendReferralInvites } from "./referrals/callables";
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build -w functions
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add functions/src/referrals/callables.ts functions/src/index.ts
git commit -m "feat(referrals): sendReferralInvites callable with quota and dedupe"
```

---

## Task 4: `claimReferral` callable

**Files:**
- Modify: `functions/src/referrals/callables.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Append the callable**

Add to the end of `functions/src/referrals/callables.ts`:

```ts
/**
 * Binds a signup to an invite. Called immediately after account creation.
 *
 * Every failure path returns { claimed: false } rather than throwing. A bad,
 * expired or already-used token must never be able to break someone's signup.
 */
export const claimReferral = onCall({ cors: true }, async (request) => {
  if (!request.auth) return { claimed: false };

  const uid = request.auth.uid;
  const token = typeof request.data?.token === "string" ? request.data.token : "";
  if (!token || token.length > 64) return { claimed: false };

  const signupEmail = normaliseEmail(request.auth.token.email ?? "");
  const inviteRef = db.collection("referral_invites").doc(token);
  const userRef = db.collection("users").doc(uid);

  try {
    return await db.runTransaction(async (tx) => {
      const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);

      if (!inviteSnap.exists) return { claimed: false };
      const invite = inviteSnap.data() as any;

      if (invite.status !== "sent") return { claimed: false };

      if (isInviteExpired(invite, new Date())) {
        tx.update(inviteRef, { status: "expired" });
        return { claimed: false };
      }

      // Self-referral.
      if (invite.referrerUid === uid) return { claimed: false };

      const user = userSnap.data() ?? {};

      // Write-once: a user can only ever be attributed to one referrer.
      if (user.referredByToken) return { claimed: false };

      // Never retro-attribute someone who is already, or has already been, a
      // paying customer. Without this an existing member could be handed a
      // token and manufacture a reward.
      if (user.role === "paid" || user.hasUsedTrial) return { claimed: false };

      // The referrer must still be a paying member for the reward to mean
      // anything. If they have churned, retire the invite.
      const referrerSnap = await tx.get(db.collection("users").doc(invite.referrerUid));
      if (referrerSnap.data()?.role !== "paid") {
        tx.update(inviteRef, { status: "void" });
        return { claimed: false };
      }

      tx.update(inviteRef, {
        status: "signed_up",
        refereeUid: uid,
        signedUpAt: new Date().toISOString(),
        // Recorded, not blocked: work-vs-personal address splits are common and
        // the payment gate is doing the real anti-fraud work.
        emailMismatch: !!signupEmail && signupEmail !== invite.email,
      });

      tx.set(userRef, { referredByToken: token }, { merge: true });

      return { claimed: true };
    });
  } catch (err) {
    console.error("claimReferral failed:", (err as Error).message);
    return { claimed: false };
  }
});
```

Extend the import from `./logic` at the top of the file to include `isInviteExpired`:

```ts
import {
  MAX_EMAILS_PER_CALL,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  expiryFor,
  isInviteExpired,
  nextQuotaState,
  type QuotaState,
} from "./logic";
```

- [ ] **Step 2: Export it**

In `functions/src/index.ts`, update the referral export line to:

```ts
// Referral Program
export { sendReferralInvites, claimReferral } from "./referrals/callables";
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build -w functions
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add functions/src/referrals/callables.ts functions/src/index.ts
git commit -m "feat(referrals): claimReferral callable binding signups to invites"
```

---

## Task 5: `getReferralStatus` callable

**Files:**
- Modify: `functions/src/referrals/callables.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Append the callable**

Add to the end of `functions/src/referrals/callables.ts`:

```ts
/**
 * Everything the /referrals page needs, in one round trip. The client never
 * reads referral_invites directly - the collection is closed to all clients so
 * tokens cannot be enumerated.
 */
export const getReferralStatus = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const uid = request.auth.uid;
  const role = (request.auth.token as any).role;
  const eligible = (role === "paid" || role === "admin") && (await referralsEnabled());

  const snap = await db
    .collection("referral_invites")
    .where("referrerUid", "==", uid)
    .orderBy("sentAt", "desc")
    .limit(100)
    .get();

  const invites = snap.docs.map((d) => {
    const v = d.data();
    return {
      email: v.email as string,
      status: v.status as string,
      sentAt: v.sentAt as string,
      rewardedAt: (v.rewardedAt ?? null) as string | null,
    };
  });

  const counts = {
    sent: invites.filter((i) => i.status === "sent").length,
    signedUp: invites.filter((i) => i.status === "signed_up").length,
    rewarded: invites.filter((i) => i.status === "rewarded").length,
  };

  const cutoff = new Date(Date.now() - REWARD_WINDOW_MS).toISOString();
  const rewardedSnap = await db
    .collection("referral_invites")
    .where("referrerUid", "==", uid)
    .where("status", "==", "rewarded")
    .where("rewardedAt", ">=", cutoff)
    .get();
  const usedThisYear = rewardedSnap.size;

  const quotaSnap = await db.collection("referral_quota").doc(uid).get();
  const quota = quotaSnap.exists ? (quotaSnap.data() as QuotaState) : undefined;
  const sameDay = quota?.dayKey === dayKeyFor(new Date());
  const quotaRemainingToday = Math.max(
    0,
    DAILY_INVITE_LIMIT - (sameDay ? (quota?.sentToday ?? 0) : 0),
  );

  return {
    eligible,
    invites,
    counts,
    monthsEarned: usedThisYear,
    cap: {
      limit: REWARD_CAP_PER_YEAR,
      usedThisYear,
      remaining: Math.max(0, REWARD_CAP_PER_YEAR - usedThisYear),
    },
    quotaRemainingToday,
  };
});
```

Extend the import from `./logic` again so it now reads:

```ts
import {
  MAX_EMAILS_PER_CALL,
  DAILY_INVITE_LIMIT,
  REWARD_CAP_PER_YEAR,
  REWARD_WINDOW_MS,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  expiryFor,
  isInviteExpired,
  dayKeyFor,
  nextQuotaState,
  type QuotaState,
} from "./logic";
```

- [ ] **Step 2: Export it**

In `functions/src/index.ts`, update the referral export line to:

```ts
// Referral Program
export { sendReferralInvites, claimReferral, getReferralStatus } from "./referrals/callables";
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build -w functions
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add functions/src/referrals/callables.ts functions/src/index.ts
git commit -m "feat(referrals): getReferralStatus callable"
```

---

## Task 6: Reward payout and webhook wiring

**Files:**
- Create: `functions/src/referrals/grantCredit.ts`
- Modify: `functions/src/webhook.ts`

- [ ] **Step 1: Write the payout module**

Create `functions/src/referrals/grantCredit.ts`:

```ts
import type Stripe from "stripe";
import * as React from "react";
import { db, auth } from "../lib/firebaseAdmin";
import { getStripe } from "../lib/stripe";
import { sendReactEmail } from "../lib/email";
import { ReferralRewardEmail } from "../emails/ReferralRewardEmail";
import { qualifiesForReward, isCapReached, REWARD_WINDOW_MS } from "./logic";

/**
 * Price of one month, in the smallest currency unit. Always the monthly price,
 * regardless of the referrer's own plan, so "a free month" means the same
 * thing for every member and an annual subscriber does not get a free year.
 */
async function monthlyPriceAmount(
  stripe: Stripe,
): Promise<{ amount: number; currency: string } | null> {
  const pricingSnap = await db.collection("config").doc("pricing").get();
  const priceId: string | undefined =
    pricingSnap.data()?.monthlyPriceId ?? process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!priceId) {
    console.error("grantReferralCredit: no monthly price configured");
    return null;
  }
  const price = await stripe.prices.retrieve(priceId);
  if (!price.unit_amount) {
    console.error("grantReferralCredit: monthly price has no unit_amount");
    return null;
  }
  return { amount: price.unit_amount, currency: price.currency };
}

async function countRewardsInWindow(referrerUid: string): Promise<number> {
  const cutoff = new Date(Date.now() - REWARD_WINDOW_MS).toISOString();
  const snap = await db
    .collection("referral_invites")
    .where("referrerUid", "==", referrerUid)
    .where("status", "==", "rewarded")
    .where("rewardedAt", ">=", cutoff)
    .get();
  return snap.size;
}

/**
 * Grants the referrer one month of Stripe balance credit for a referee whose
 * first real payment just succeeded.
 *
 * Idempotency matters here because Stripe delivers webhooks at least once, and
 * we guard it twice:
 *   1. A Firestore transaction owns the signed_up -> rewarding transition. Only
 *      the call that wins that transition reaches Stripe at all.
 *   2. The Stripe call carries an idempotency key derived from the invite
 *      token, so even a torn transaction cannot double-credit.
 */
export async function grantReferralCredit(invoice: Stripe.Invoice): Promise<void> {
  if (!qualifiesForReward(invoice as any)) return;

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  // Resolve the paying user.
  const userSnap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (userSnap.empty) return;
  const refereeUid = userSnap.docs[0].id;

  // Find their unrewarded invite.
  const inviteSnap = await db
    .collection("referral_invites")
    .where("refereeUid", "==", refereeUid)
    .where("status", "==", "signed_up")
    .limit(1)
    .get();
  if (inviteSnap.empty) return;

  const inviteRef = inviteSnap.docs[0].ref;
  const token = inviteRef.id;

  // Guard 1: claim the transition. Losers return without touching Stripe.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    if (snap.data()?.status !== "signed_up") return null;
    tx.update(inviteRef, { status: "rewarding" });
    return snap.data() as any;
  });
  if (!claimed) return;

  const referrerUid: string = claimed.referrerUid;

  try {
    if (isCapReached(await countRewardsInWindow(referrerUid))) {
      await inviteRef.update({ status: "capped", capReason: "annual_limit" });
      return;
    }

    const referrerSnap = await db.collection("users").doc(referrerUid).get();
    const referrerCustomerId = referrerSnap.data()?.stripeCustomerId;
    if (!referrerCustomerId) {
      console.error("grantReferralCredit: referrer has no Stripe customer", referrerUid);
      await inviteRef.update({ status: "void", capReason: "no_stripe_customer" });
      return;
    }

    const stripe = getStripe();
    const price = await monthlyPriceAmount(stripe);
    if (!price) {
      await inviteRef.update({ status: "void", capReason: "no_price_configured" });
      return;
    }

    // Guard 2: negative balance = credit. Idempotency key makes a retry a no-op.
    await stripe.customers.createBalanceTransaction(
      referrerCustomerId,
      {
        amount: -price.amount,
        currency: price.currency,
        description: "Dealecho referral credit - 1 month free",
        metadata: { inviteToken: token, refereeUid, referrerUid },
      },
      { idempotencyKey: `referral_${token}` },
    );

    await inviteRef.update({
      status: "rewarded",
      rewardedAt: new Date().toISOString(),
      rewardAmountCents: price.amount,
      rewardCurrency: price.currency,
      stripeInvoiceId: invoice.id,
    });

    // Best-effort notification. Never let a mail failure undo a granted credit.
    try {
      const referrer = await auth.getUser(referrerUid);
      if (referrer.email) {
        await sendReactEmail({
          to: referrer.email,
          subject: "You've earned a free month of Dealecho",
          component: React.createElement(ReferralRewardEmail, {
            referrerName: referrer.displayName || referrer.email.split("@")[0] || "there",
            refereeEmail: claimed.email,
            recipientEmail: referrer.email,
          }),
        });
      }
    } catch (err) {
      console.error("grantReferralCredit reward email failed:", (err as Error).message);
    }
  } catch (err) {
    // Roll back so a webhook retry can have another go.
    console.error("grantReferralCredit failed:", (err as Error).message);
    await inviteRef.update({ status: "signed_up" });
    throw err;
  }
}
```

- [ ] **Step 2: Wire it into the webhook**

In `functions/src/webhook.ts`, add the import beside the existing ones at the top:

```ts
import { grantReferralCredit } from "./referrals/grantCredit";
```

Then add a new case in the `switch (event.type)` block, immediately after the `customer.subscription.deleted` case and before `default:`:

```ts
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          // Referral rewards fire here rather than on subscription creation:
          // new Pro subs get a 30-day trial, so a subscription existing proves
          // nothing. Only a real payment does.
          await grantReferralCredit(invoice);
          break;
        }
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build -w functions
```

Expected: exit 0.

- [ ] **Step 4: Re-run the function test suite**

```bash
npm test -w functions
```

Expected: PASS. Task 1's tests plus the pre-existing `accountFlags` tests, all green.

- [ ] **Step 5: Commit**

```bash
git add functions/src/referrals/grantCredit.ts functions/src/webhook.ts
git commit -m "feat(referrals): grant credit on invoice.payment_succeeded"
```

---

## Task 7: Firestore rules and indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Lock down the collections**

In `firestore.rules`, add immediately after the `match /webhooks_debug/{logId}` block:

```
    // ── Referrals ─────────────────────────────────────────────────────────────
    // Written exclusively by Cloud Functions (Admin SDK, bypasses rules).
    // Closed to all clients: the document id IS the invite token, so any read
    // access would let a caller enumerate live tokens and hijack referrals.
    // The /referrals page reads through the getReferralStatus callable instead.
    match /referral_invites/{token} {
      allow read, write: if false;
    }

    // Per-user invite send counters. Server-only for the same reason.
    match /referral_quota/{userId} {
      allow read, write: if false;
    }
```

- [ ] **Step 2: Add the composite indexes**

In `firestore.indexes.json`, add these three objects to the `indexes` array:

```json
    {
      "collectionGroup": "referral_invites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "referrerUid", "order": "ASCENDING" },
        { "fieldPath": "sentAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "referral_invites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "referrerUid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "rewardedAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "referral_invites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "refereeUid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "referral_invites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "referrerUid", "order": "ASCENDING" },
        { "fieldPath": "email", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
```

Four indexes, one per query in the code: the invite list, the cap window, the payment-time lookup, and the duplicate-invite check.

- [ ] **Step 3: Verify the JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
```

Expected: `valid`.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat(referrals): server-only rules and composite indexes"
```

---

## Task 8: Frontend invite capture

**Files:**
- Create: `src/utils/referral.ts`
- Test: `src/utils/referral.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/referral.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  REFERRAL_STORAGE_KEY,
  captureInviteToken,
  storedInviteToken,
  clearInviteToken,
} from "./referral";

describe("referral invite capture", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("captures a token from the query string", () => {
    window.history.replaceState({}, "", "/?invite=ABC123");
    captureInviteToken();
    expect(storedInviteToken()).toBe("ABC123");
  });

  it("strips the invite parameter from the URL so it is not re-shared", () => {
    window.history.replaceState({}, "", "/?invite=ABC123&utm_source=email");
    captureInviteToken();
    expect(window.location.search).not.toContain("invite=");
    expect(window.location.search).toContain("utm_source=email");
  });

  it("does nothing when there is no invite parameter", () => {
    window.history.replaceState({}, "", "/?utm_source=email");
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("ignores a token that is the wrong shape", () => {
    window.history.replaceState({}, "", "/?invite=" + "x".repeat(200));
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("ignores a token containing characters we never generate", () => {
    window.history.replaceState({}, "", "/?invite=abc%20def");
    captureInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("does not overwrite an already-captured token", () => {
    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token: "FIRST", capturedAt: Date.now() }),
    );
    window.history.replaceState({}, "", "/?invite=SECOND");
    captureInviteToken();
    expect(storedInviteToken()).toBe("FIRST");
  });

  it("expires a token older than 60 days", () => {
    const sixtyOneDaysAgo = Date.now() - 61 * 86_400_000;
    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token: "OLD", capturedAt: sixtyOneDaysAgo }),
    );
    expect(storedInviteToken()).toBeNull();
  });

  it("clears the stored token", () => {
    window.history.replaceState({}, "", "/?invite=ABC123");
    captureInviteToken();
    clearInviteToken();
    expect(storedInviteToken()).toBeNull();
  });

  it("survives corrupt localStorage content", () => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, "not json");
    expect(storedInviteToken()).toBeNull();
  });

  it("never throws when localStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => storedInviteToken()).not.toThrow();
    expect(storedInviteToken()).toBeNull();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/utils/referral.test.ts
```

Expected: FAIL, `Failed to resolve import "./referral"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/referral.ts`:

```ts
/**
 * Referral invite capture.
 *
 * Invite emails link to https://dealecho.io/?invite=TOKEN. We stash the token
 * on landing and hand it to the claimReferral callable once the account exists.
 *
 * This is functional storage - it delivers a benefit the visitor was explicitly
 * offered - not marketing tracking, so unlike the attribution cookie it is not
 * gated on marketing consent. See src/utils/consent.ts.
 */

export const REFERRAL_STORAGE_KEY = "dealecho_referral_invite";

/** Must match the 60-day server-side invite expiry. */
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

/** Tokens are 32 URL-safe base64 characters, generated server-side. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

interface StoredInvite {
  token: string;
  capturedAt: number;
}

function read(): StoredInvite | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvite;
    if (typeof parsed?.token !== "string" || typeof parsed?.capturedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    // Private browsing, disabled storage, or corrupt content. Never throw:
    // this runs on every app load and must not be able to break the page.
    return null;
  }
}

/**
 * Reads ?invite= from the URL, stores it, and strips the parameter so the token
 * does not leak into analytics or get copy-pasted onward by the recipient.
 * Safe to call on every app load.
 */
export function captureInviteToken(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;

    // Always strip, even if we reject the value.
    params.delete("invite");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );

    if (!TOKEN_PATTERN.test(token)) return;

    // First invite wins. Re-writing would let a later link steal attribution
    // from the person who actually made the introduction.
    if (read()) return;

    localStorage.setItem(
      REFERRAL_STORAGE_KEY,
      JSON.stringify({ token, capturedAt: Date.now() } satisfies StoredInvite),
    );
  } catch {
    // Non-fatal by design.
  }
}

export function storedInviteToken(): string | null {
  const stored = read();
  if (!stored) return null;
  if (Date.now() - stored.capturedAt > MAX_AGE_MS) {
    clearInviteToken();
    return null;
  }
  return stored.token;
}

export function clearInviteToken(): void {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Non-fatal by design.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/utils/referral.test.ts
```

Expected: PASS, all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/referral.ts src/utils/referral.test.ts
git commit -m "feat(referrals): capture invite token from landing URL"
```

---

## Task 9: The `/referrals` page

**Files:**
- Create: `pages/Referrals.tsx`
- Test: `pages/Referrals.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `pages/Referrals.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Referrals from "./Referrals";

const mockCallable = vi.fn();
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => mockCallable,
}));

const status = (over: Record<string, unknown> = {}) => ({
  data: {
    eligible: true,
    invites: [],
    counts: { sent: 0, signedUp: 0, rewarded: 0 },
    monthsEarned: 0,
    cap: { limit: 12, usedThisYear: 0, remaining: 12 },
    quotaRemainingToday: 20,
    ...over,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Referrals />
    </MemoryRouter>,
  );

describe("Referrals", () => {
  beforeEach(() => mockCallable.mockReset());

  it("shows the invite form to an eligible member", async () => {
    mockCallable.mockResolvedValue(status());
    renderPage();
    expect(await screen.findByRole("button", { name: /Send invites/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email addresses/i)).toBeInTheDocument();
  });

  it("shows an upgrade prompt to a free user instead of the form", async () => {
    mockCallable.mockResolvedValue(status({ eligible: false }));
    renderPage();
    expect(await screen.findByRole("link", { name: /Upgrade/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: /Send invites/i })).not.toBeInTheDocument();
  });

  it("reports months earned and cap usage", async () => {
    mockCallable.mockResolvedValue(
      status({ monthsEarned: 3, cap: { limit: 12, usedThisYear: 3, remaining: 9 } }),
    );
    renderPage();
    expect(await screen.findByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/9 left this year/i)).toBeInTheDocument();
  });

  it("disables sending once the annual cap is reached", async () => {
    mockCallable.mockResolvedValue(
      status({ cap: { limit: 12, usedThisYear: 12, remaining: 0 } }),
    );
    renderPage();
    expect(await screen.findByText(/reached the maximum/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send invites/i })).toBeDisabled();
  });

  it("disables sending once today's invite quota is spent", async () => {
    mockCallable.mockResolvedValue(status({ quotaRemainingToday: 0 }));
    renderPage();
    expect(await screen.findByRole("button", { name: /Send invites/i })).toBeDisabled();
  });

  it("lists sent invites with their status", async () => {
    mockCallable.mockResolvedValue(
      status({
        invites: [
          { email: "bob@acme.com", status: "rewarded", sentAt: "2026-07-01T00:00:00.000Z", rewardedAt: "2026-08-02T00:00:00.000Z" },
          { email: "sue@acme.com", status: "sent", sentAt: "2026-07-20T00:00:00.000Z", rewardedAt: null },
        ],
      }),
    );
    renderPage();
    expect(await screen.findByText("bob@acme.com")).toBeInTheDocument();
    expect(screen.getByText("sue@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("surfaces an error when the status call fails", async () => {
    mockCallable.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your referrals/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- pages/Referrals.test.tsx
```

Expected: FAIL, `Failed to resolve import "./Referrals"`.

- [ ] **Step 3: Write the page**

Create `pages/Referrals.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import Icon from "../src/components/Icon";

interface Invite {
  email: string;
  status: string;
  sentAt: string;
  rewardedAt: string | null;
}

interface ReferralStatus {
  eligible: boolean;
  invites: Invite[];
  counts: { sent: number; signedUp: number; rewarded: number };
  monthsEarned: number;
  cap: { limit: number; usedThisYear: number; remaining: number };
  quotaRemainingToday: number;
}

interface InviteResult {
  email: string;
  result: string;
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  signed_up: "Joined",
  rewarding: "Joined",
  rewarded: "Earned",
  capped: "Over cap",
  expired: "Expired",
  void: "Not sent",
};

const RESULT_MESSAGES: Record<string, string> = {
  sent: "Invite sent",
  already_member: "Already a Dealecho member",
  already_invited: "You've already invited them",
  invalid: "Not a valid email address",
  self: "That's your own address",
  rate_limited: "Daily invite limit reached",
  send_failed: "We couldn't deliver this one",
};

const Referrals: React.FC = () => {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      const fns = getFunctions(undefined, "australia-southeast1");
      const call = httpsCallable(fns, "getReferralStatus");
      const res = await call({});
      setStatus(res.data as ReferralStatus);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const atCap = !!status && status.cap.remaining <= 0;
  const noQuota = !!status && status.quotaRemainingToday <= 0;
  const canSend = !!status?.eligible && !atCap && !noQuota;

  const handleSend = async () => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (list.length === 0) return;

    setSending(true);
    setResults(null);
    try {
      const fns = getFunctions(undefined, "australia-southeast1");
      const call = httpsCallable(fns, "sendReferralInvites");
      const res = await call({ emails: list });
      setResults((res.data as { results: InviteResult[] }).results);
      setEmails("");
      await load();
    } catch (err: any) {
      setResults([{ email: "", result: err?.message || "send_failed" }]);
    }
    setSending(false);
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-sm text-slate-500">
          We couldn't load your referrals just now. Please refresh and try again.
        </p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Invite a colleague, get a month free
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Invite someone to Dealecho. They get 30 days of Sales Pro free. Once
          their first payment goes through, a free month lands on your account.
        </p>
      </header>

      {!status.eligible ? (
        <div className="p-6 bg-accent-50 rounded-card border border-accent/30 space-y-4">
          <div className="flex items-center space-x-3 text-accent">
            <Icon name="fa-crown" size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Sales Pro only
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Referrals are a Sales Pro benefit. Upgrade to start inviting
            colleagues and earning free months.
          </p>
          <Link
            to="/pricing"
            className="block text-center bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all"
          >
            Upgrade to Sales Pro
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Invites sent" value={status.counts.sent + status.counts.signedUp + status.counts.rewarded} />
            <Stat label="Joined" value={status.counts.signedUp + status.counts.rewarded} />
            <Stat label="Months earned" value={status.monthsEarned} />
          </div>

          <section className="bg-white p-6 rounded-card border border-slate-200 space-y-4">
            <label
              htmlFor="referral-emails"
              className="block text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Email addresses
            </label>
            <textarea
              id="referral-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              placeholder="colleague@company.com, another@company.com"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="text-[11px] text-slate-400">
              Up to 10 at a time. {status.quotaRemainingToday} invites left today.
              {" "}
              {status.cap.remaining} left this year.
            </p>

            {atCap && (
              <p className="text-[11px] text-amber-600">
                You've reached the maximum of {status.cap.limit} free months for
                this year. You can keep inviting once your oldest reward passes
                12 months.
              </p>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || sending || emails.trim().length === 0}
              className="w-full bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "Sending" : "Send invites"}
            </button>

            {results && (
              <ul className="space-y-1 pt-2">
                {results.map((r, i) => (
                  <li key={`${r.email}-${i}`} className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{r.email}</span>{" "}
                    {RESULT_MESSAGES[r.result] ?? r.result}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {status.invites.length > 0 && (
            <section className="bg-white rounded-card border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Invited
                    </th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {status.invites.map((invite) => (
                    <tr key={`${invite.email}-${invite.sentAt}`} className="border-b border-slate-50 last:border-0">
                      <td className="p-4 text-sm text-slate-700">{invite.email}</td>
                      <td className="p-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        {STATUS_LABELS[invite.status] ?? invite.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white p-4 rounded-card border border-slate-200">
    <div className="text-2xl font-black text-slate-900">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
      {label}
    </div>
  </div>
);

export default Referrals;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- pages/Referrals.test.tsx
```

Expected: PASS, all 7 tests green. If `../src/components/Icon` resolves differently, match the import path used by `pages/MyIntel.tsx`.

- [ ] **Step 5: Commit**

```bash
git add pages/Referrals.tsx pages/Referrals.test.tsx
git commit -m "feat(referrals): /referrals invite page"
```

---

## Task 10: Wire the page and the signup claim into the app

**Files:**
- Modify: `App.tsx`
- Modify: `pages/MyIntel.tsx`

- [ ] **Step 1: Import the page and the capture helpers**

In `App.tsx`, add to the existing imports:

```ts
import { captureInviteToken, storedInviteToken, clearInviteToken } from "./src/utils/referral";
```

And add `Referrals` to the lazy-loaded page imports, matching however the neighbouring pages are declared (the file lazy-loads routes behind `Suspense`):

```ts
const Referrals = React.lazy(() => import("./pages/Referrals"));
```

- [ ] **Step 2: Capture the token on app load**

Inside the top-level `App` component, add an effect that runs once. Place it beside the other mount-time effects:

```ts
  // Invite emails land on /?invite=TOKEN. Grab it before anything else can
  // rewrite the URL, and strip the parameter so it is not re-shared.
  useEffect(() => {
    captureInviteToken();
  }, []);
```

- [ ] **Step 3: Claim the referral after signup**

Add this helper above the `App` component in `App.tsx`:

```ts
/**
 * Binds a new signup to the invite that brought them in. Fire-and-forget by
 * design: a bad or expired token must never be able to break account creation.
 */
async function claimReferralIfInvited(): Promise<void> {
  const token = storedInviteToken();
  if (!token) return;
  try {
    const fns = getFunctions(undefined, "australia-southeast1");
    await httpsCallable(fns, "claimReferral")({ token });
  } catch (err) {
    console.error("claimReferral failed:", err);
  } finally {
    clearInviteToken();
  }
}
```

If `getFunctions` / `httpsCallable` are not already imported in `App.tsx`, add:

```ts
import { getFunctions, httpsCallable } from "firebase/functions";
```

Then call it in **both** `isNew` branches, alongside the existing `recordAcquisition()` call.

In the Google login handler (around line 230):

```ts
      if (isNew) {
        setPostAuthPath("/search");
        void recordAcquisition();
        void claimReferralIfInvited();
        // The getting-started checklist auto-opens once the user doc loads.
      }
```

In `onEmailLogin` (around line 250):

```ts
    if (isNew) {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(res.user, { displayName: name });
      setPostAuthPath("/search");
      void recordAcquisition();
      void claimReferralIfInvited();
      // The getting-started checklist auto-opens once the user doc loads.
      track("sign_up", { method: "password" });
    }
```

- [ ] **Step 4: Add the route**

In `App.tsx`, add beside the other protected routes (near the `/settings/team` route):

```tsx
              <Route
                path="/referrals"
                element={
                  <ProtectedRoute requireAuth>
                    <Referrals />
                  </ProtectedRoute>
                }
              />
```

- [ ] **Step 5: Add the entry point in the control centre**

In `pages/MyIntel.tsx`, add a card linking to the new page. Place it near the existing upgrade card so it sits in the same column, using the established styling:

```tsx
              {isPaid && (
                <div className="md:col-span-2 p-6 bg-white rounded-card border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-3 text-accent">
                    <Icon name="fa-gift" size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Refer a colleague
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Invite someone to Dealecho. They get 30 days free, and you
                    get a free month once their first payment clears.
                  </p>
                  <Link
                    to="/referrals"
                    className="block text-center bg-accent text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-700 transition-all"
                  >
                    Invite colleagues
                  </Link>
                </div>
              )}
```

- [ ] **Step 6: Verify the build and the full frontend suite**

```bash
npm run build
```

Expected: exit 0, TypeScript clean, Vite build succeeds.

```bash
npm test
```

Expected: PASS across the whole frontend suite, including the new `referral` and `Referrals` tests and all pre-existing tests.

- [ ] **Step 7: Commit**

```bash
git add App.tsx pages/MyIntel.tsx
git commit -m "feat(referrals): route, signup claim hook, and control centre entry"
```

---

## Task 11: CI deploy configuration

**Files:**
- Modify: `.github/workflows/deploy-functions.yml`

New functions that are missing from an `--only` list are never deployed. They then 404 at call time, which surfaces in the browser as a CORS error and wastes a lot of debugging time. This step is not optional.

**`stripeWebhook` is currently in no `--only` list at all.** It was verified absent from the whole workflow while this plan was written, which means CI has never deployed it and the `invoice.payment_succeeded` case added in Task 6 would never reach production. Both changes below are required.

Note the existing `- name: Wait / run: sleep 30` step between every deploy group. That spacing exists because rapid-fire deploys of new functions trigger 409 conflicts. Keep it.

- [ ] **Step 1: Add the referral deploy step**

In `.github/workflows/deploy-functions.yml`, add after the marketing functions step at the end of the deploy sequence:

```yaml
      - name: Wait
        run: sleep 30

      - name: Deploy referral functions
        run: firebase deploy --only functions:sendReferralInvites,functions:claimReferral,functions:getReferralStatus --force
```

- [ ] **Step 2: Add `stripeWebhook` to the checkout deploy step**

Change the existing checkout step so the webhook ships with the billing group it belongs to. Replace:

```yaml
      - name: Deploy checkout functions
        run: firebase deploy --only functions:createCheckoutSession,functions:cancelSubscription,functions:createEnterpriseCheckout,functions:createBillingPortalSession,functions:applyRetentionOffer --force
```

with:

```yaml
      - name: Deploy checkout functions
        run: firebase deploy --only functions:createCheckoutSession,functions:cancelSubscription,functions:createEnterpriseCheckout,functions:createBillingPortalSession,functions:applyRetentionOffer,functions:stripeWebhook --force
```

`stripeWebhook` needs the `STRIPE_WEBHOOK_SECRET` secret binding, which it declares in its own `onRequest` options, so no workflow-level secret change is needed. This will redeploy the live webhook. Confirm the deploy succeeds and that Stripe events are still being processed before moving on.

- [ ] **Step 3: Verify both edits landed**

```bash
grep -c "sendReferralInvites\|functions:stripeWebhook" .github/workflows/deploy-functions.yml
```

Expected: `2`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-functions.yml
git commit -m "ci: deploy referral functions and stripeWebhook"
```

---

## Task 12: Full verification before handing back

- [ ] **Step 1: Functions build and tests**

```bash
npm run build -w functions && npm test -w functions
```

Expected: exit 0 on both. Report the actual test counts.

- [ ] **Step 2: Frontend build and tests**

```bash
npm run build && npm test
```

Expected: exit 0 on both. Report the actual test counts.

- [ ] **Step 3: Confirm every new function is exported and deployable**

```bash
grep -n "sendReferralInvites\|claimReferral\|getReferralStatus" functions/src/index.ts .github/workflows/deploy-functions.yml
```

Expected: all three names appear in both files.

- [ ] **Step 4: Report status honestly**

Summarise what passed, what failed, and anything left undone. Do not claim completion on the basis of code that was written but not run.

---

## Manual steps after deploy (owner action, not code)

These two are called out in the spec and cannot be done from the repo. The feature is inert until both are complete.

1. **Enable `invoice.payment_succeeded` on the Stripe webhook endpoint.** Without it, `grantReferralCredit` is never called and no reward is ever granted.
2. **Confirm `config/pricing.monthlyPriceId` is set in live mode.** Without it, `grantReferralCredit` cannot price the credit and voids the reward.

Optionally set `config/features.referralsEnabled` to `false` before deploying, then flip it to `true` after verifying an end-to-end referral in Stripe test mode. The code treats a missing flag as enabled.

## Verifying end-to-end in Stripe test mode

1. As a Pro test account, send an invite to an address you control.
2. Open the emailed link, confirm the URL loses the `invite` parameter, and check `localStorage` holds `dealecho_referral_invite`.
3. Create the account. Confirm the `referral_invites` doc moves to `signed_up` and the user doc gains `referredByToken`.
4. Subscribe to Pro. Confirm the invite stays `signed_up` - the $0 trial invoice must not pay out.
5. Advance the Stripe test clock past the trial, or subscribe with an account that already has `hasUsedTrial: true` so the first invoice is charged immediately.
6. Confirm the invite moves to `rewarded` and the referrer's Stripe customer shows a negative balance transaction.
7. Re-send the same webhook event from the Stripe dashboard. Confirm the balance does not move a second time.
