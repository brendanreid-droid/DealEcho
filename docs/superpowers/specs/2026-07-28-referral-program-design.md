# Referral Program - Design

**Date:** 2026-07-28
**Status:** Approved for planning

## Summary

Pro members invite colleagues by email. When an invitee subscribes to Pro and their
first real payment succeeds, the referrer earns one month of account credit. One
qualifying referral earns one free month (1:1). Free-tier signups never qualify.

## Goals

- Give paying members a reason to bring in other paying members.
- Only pay out on referrals that produce actual revenue.
- Keep the surface area small: email invites only, no public shareable code.

## Non-goals

- Public/shareable referral links. Deliberately excluded from v1.
- Any extra incentive for the invitee beyond the 30-day trial they already get.
- Cash payouts, gift cards, or credit transferable off the account.
- Multi-level or tiered rewards.

## Key context from the existing system

Three facts drive the design:

1. `createCheckoutSession` grants `trial_period_days: 30` to any user without
   `hasUsedTrial` (`functions/src/checkout.ts`). A new Pro signup therefore pays
   nothing for 30 days. Rewarding at signup would be directly farmable: create
   throwaway accounts, collect free months, cancel every trial before it bills.
   **The reward must fire on first successful payment, not on subscription
   creation.**
2. `resolveRoleTier` maps both `active` and `trialing` to `role: "paid"`
   (`functions/src/webhook.ts`). Eligibility to send invites is therefore a single
   `role === "paid"` check, which already includes trialing members as intended.
3. `stripeWebhook` does not currently handle `invoice.payment_succeeded`. That
   event must be added to the handler **and** enabled on the Stripe endpoint.

## Reward mechanics

**Trigger.** Stripe `invoice.payment_succeeded` where all of the following hold:

- The invoice is attached to a subscription.
- `amount_paid > 0` (a $0 trial invoice never qualifies).
- `billing_reason` is `subscription_create` or `subscription_cycle`.
  (`subscription_create` covers members who skipped the trial because
  `hasUsedTrial` was already set.)
- The paying customer resolves to a uid that has an unrewarded referral invite.

Practically this lands around day 31 for a trialing invitee, and immediately for
one who had already used their trial.

**Reward form.** A Stripe customer balance credit on the referrer:

```ts
stripe.customers.createBalanceTransaction(referrerStripeCustomerId, {
  amount: -unitAmount,          // negative = credit
  currency,
  description: "Dealecho referral credit",
  metadata: { inviteToken, refereeUid },
}, { idempotencyKey: `referral_${inviteToken}` });
```

Chosen over a coupon because it stacks across multiple referrals, applies
identically to monthly and annual referrers, survives plan changes, and cannot
accidentally discount a whole annual term.

**Credit value.** One month at the configured monthly price. Read
`config/pricing.monthlyPriceId`, retrieve that Stripe price, use its `unit_amount`
and `currency`. The value does not vary with the referrer's own plan, so the
marketing claim ("a free month") stays true and predictable. An annual referrer's
credit simply sits on their Stripe balance until renewal.

**Cap.** 12 rewarded referrals per referrer per rolling 365 days. Beyond the cap
the invite is marked `capped` rather than `rewarded`; no credit is issued and the
UI says so.

**Invitee reward.** None beyond the standard 30-day trial. Copy frames this
honestly: the invitee does get a free month, because every new Pro signup does.

## Data model

### New collection: `referral_invites/{token}`

The document id **is** the token. One collection carries the whole lifecycle.

| Field | Type | Notes |
|---|---|---|
| `token` | string | 32-char URL-safe random, equals the doc id |
| `referrerUid` | string | Who sent it |
| `email` | string | Lowercased invitee address |
| `status` | string | `sent` \| `signed_up` \| `rewarded` \| `capped` \| `expired` \| `void` |
| `sentAt` | ISO string | |
| `expiresAt` | ISO string | `sentAt + 60 days` |
| `refereeUid` | string \| null | Set on claim |
| `signedUpAt` | ISO string \| null | |
| `emailMismatch` | boolean | True if signup email differs from `email` |
| `rewardedAt` | ISO string \| null | |
| `rewardAmountCents` | number \| null | |
| `rewardCurrency` | string \| null | |
| `stripeInvoiceId` | string \| null | Invoice that triggered the payout |
| `capReason` | string \| null | Set when `status === "capped"` |

Status transitions are one-way:

```
sent ──claim──> signed_up ──payment──> rewarded
  │                  │
  │                  └──cap hit──> capped
  ├──60 days──> expired
  └──referrer cancels/abuse──> void
```

### Changes to `users/{uid}`

One new server-written field:

- `referredByToken: string | null` - write-once, set at claim time.

Not client-writable. The existing rules allowlist
(`trackedCompanies`, `notificationPreferences`, `updatedAt`) is unchanged, so
this field is already protected.

### Firestore rules

```
match /referral_invites/{token} {
  allow read, write: if false;   // Admin SDK only
}
```

All client access goes through callables. This prevents token enumeration and
stops anyone reading who else was invited.

### Indexes

`firestore.indexes.json` needs:
- `referral_invites`: `referrerUid` ASC + `sentAt` DESC (invite list UI)
- `referral_invites`: `refereeUid` ASC + `status` ASC (payment-time lookup)
- `referral_invites`: `referrerUid` ASC + `status` ASC + `rewardedAt` DESC (cap check)

## Backend

Four new callables plus a webhook case. All live in a new
`functions/src/referrals.ts`, except the webhook change.

### `sendReferralInvites` (callable)

Input: `{ emails: string[] }`, max 10 per call.

1. Require auth. Require `role === "paid"` from the caller's token claims.
2. Normalise and validate each address; reject malformed ones with a per-address
   error rather than failing the whole call.
3. Reject the caller's own email address.
4. Skip addresses that already belong to a registered user, and report them as
   `already_member` so the UI can explain rather than silently dropping them.
5. Skip addresses this referrer has already invited with a live (`sent`) invite,
   reported as `already_invited`.
6. Rate limit: 20 invites per referrer per rolling 24 hours, 200 lifetime.
   Enforced by counting `referral_invites` docs, inside a transaction so
   concurrent calls cannot both pass the check.
7. Create one `referral_invites` doc per accepted address.
8. Send `ReferralInviteEmail` via `sendReactEmail`. Email send failures mark the
   invite `void` and are reported back, so the UI never shows a phantom invite.

Returns a per-address result array: `{ email, result: "sent" | "already_member"
| "already_invited" | "invalid" | "rate_limited" | "send_failed" }`.

Requires the `RESEND_API_KEY` secret.

### `claimReferral` (callable)

Input: `{ token: string }`. Called immediately after account creation.

Validates, in a transaction:

- Token exists, `status === "sent"`, not past `expiresAt`.
- `referrerUid !== caller uid` (blocks self-referral).
- Caller has no existing `referredByToken` (write-once).
- Caller has never been paid: `role !== "paid"` and `hasUsedTrial` is falsy.
  Stops an existing paying member from being retro-attributed.
- Referrer is still `role === "paid"`. If not, mark the invite `void`.

On success: set invite `status = "signed_up"`, `refereeUid`, `signedUpAt`, and
`emailMismatch` (true when the signup email differs from the invited address);
set `referredByToken` on the user doc.

Failures are silent to the user. A bad or expired token must never block signup.

**Email mismatch is recorded, not blocked.** Someone invited at
`bob@acme.com` who signs up as `bob@gmail.com` still qualifies. Hard-blocking
would break the common work/personal address split and generate support load,
and the payment gate is doing the real anti-fraud work.

### `getReferralStatus` (callable)

Returns everything the referrals page needs:

```ts
{
  eligible: boolean,          // role === "paid"
  invites: Array<{ email, status, sentAt, rewardedAt }>,   // newest 100
  counts: { sent, signedUp, rewarded },
  monthsEarned: number,
  cap: { limit: 12, usedThisYear: number, remaining: number },
  quotaRemainingToday: number,
}
```

### `stripeWebhook` - new `invoice.payment_succeeded` case

```
invoice.payment_succeeded
  └─ guard: invoice.subscription set, amount_paid > 0,
            billing_reason in (subscription_create, subscription_cycle)
  └─ resolve uid from invoice.customer (reuse resolveFirebaseUID logic)
  └─ find referral_invites where refereeUid == uid and status == "signed_up"
  └─ grantReferralCredit(invite, invoice)
```

`grantReferralCredit`:

1. Firestore transaction flips `signed_up -> rewarded`. Only the transaction that
   wins the transition proceeds. This is the primary idempotency guard against
   Stripe's at-least-once delivery.
2. Count the referrer's `rewarded` invites in the last 365 days. At 12 or more,
   write `status = "capped"`, `capReason = "annual_limit"`, and stop.
3. Resolve the referrer's Stripe customer id. If absent (referrer never checked
   out), mark `void` and log.
4. Read the monthly price amount from `config/pricing`.
5. Create the balance transaction with `idempotencyKey: referral_${token}`, so
   even a torn transaction cannot double-credit at the Stripe end.
6. Write `rewardedAt`, `rewardAmountCents`, `rewardCurrency`, `stripeInvoiceId`.
7. Send a "you earned a free month" notification email to the referrer.

Any failure after step 1 rolls the invite back to `signed_up` so a webhook retry
can re-attempt.

### Email template

New `functions/src/emails/ReferralInviteEmail.tsx`, following the existing
`TeamInviteEmail` pattern and `Layout`. Props: `{ referrerName, inviteUrl,
recipientEmail }`. Includes an unsubscribe/report line, since these are
unsolicited messages to third parties.

Second template `ReferralRewardEmail.tsx` for the payout notification.

## Frontend

### New page: `pages/Referrals.tsx`, route `/referrals`

Wrapped in `ProtectedRoute requireAuth`. Three states:

- **Not eligible (free tier):** locked panel explaining the benefit, with a
  link to `/pricing`.
- **Eligible:** invite form (textarea or chip input, up to 10 addresses),
  remaining daily quota, and a sent-invites table with per-row status
  (Sent / Joined / Earned / Expired) plus a months-earned summary and cap
  progress.
- **At cap:** invite form disabled with an explanation of when the cap resets.

Entry point: a card or nav item in `/control-centre` (`pages/MyIntel.tsx`).

### Invite capture: `src/utils/referral.ts`

The invite email links to `https://dealecho.io/?invite=TOKEN`.

- On app load, read `invite` from the query string, store it under
  `dealecho_referral_invite` in `localStorage`, and strip the parameter from the
  URL so it does not leak into analytics or get re-shared.
- This is functional storage (it delivers a benefit the user asked for), not
  marketing tracking, so it is not gated on marketing consent. Confirm the
  wording in `src/utils/consent.ts` covers it and update the privacy page if not.
- Clear the value after a successful claim, and after 60 days regardless.

### Signup hook: `App.tsx`

Both `isNew` branches (Google popup around line 230, email/password around
line 250) already call `recordAcquisition()`. Add a `claimReferral()` call
alongside it, fire-and-forget, wrapped so a failure can never break signup.

## Anti-abuse summary

| Vector | Control |
|---|---|
| Farming trials | Reward requires `amount_paid > 0` |
| Self-referral | `referrerUid !== caller uid` |
| Re-attributing an existing customer | Claim rejected if `role === "paid"` or `hasUsedTrial` |
| Double claim on one token | Doc id is the token; status transitions are one-way |
| Duplicate webhook delivery | Firestore transaction plus Stripe idempotency key |
| Unbounded liability | 12 rewards per rolling year |
| Invite spam | 20/day, 200 lifetime, 10 per call, dedupe on live invites |
| Token enumeration | 32-char random tokens, collection denied to all clients |
| Stale tokens | 60-day expiry |

Shared email domains are deliberately **not** blocked. Colleagues at the same
company are the intended audience.

## Testing

New `functions/src/referrals.test.ts`, following the `accountFlags.test.ts`
pattern:

- Cap logic: 11th reward grants, 13th is capped, rewards older than 365 days
  fall out of the count.
- Self-referral rejected.
- Claim rejected for an already-paid user and for an expired token.
- Second claim on a used token is a no-op.
- Duplicate `invoice.payment_succeeded` credits exactly once.
- `$0` trial invoice does not credit.
- `billing_reason: subscription_update` does not credit.
- Email mismatch records the flag but still qualifies.
- Invite rate limit blocks the 21st invite in 24 hours.

Frontend: a render test for `Referrals.tsx` covering the eligible, ineligible,
and at-cap states.

## Deployment

Both steps are required or the feature silently fails:

1. **Stripe dashboard:** enable `invoice.payment_succeeded` on the webhook
   endpoint. Without it no reward is ever granted.
2. **CI allowlist:** add a step to `.github/workflows/deploy-functions.yml`:
   ```
   firebase deploy --only functions:sendReferralInvites,functions:claimReferral,functions:getReferralStatus --force
   ```
   Functions missing from an `--only` list are never deployed and 404 at call
   time, which surfaces in the browser as a CORS error.

Also needs: Firestore rules deploy, index deploy, and `RESEND_API_KEY` bound to
`sendReferralInvites`.

## Rollout

Ship behind a `config/features.referralsEnabled` flag, read by
`getReferralStatus`. Enable for admins first, verify one end-to-end referral in
Stripe test mode (including the day-31 payment via a clock or a shortened trial),
then enable for all paid users.

## Decisions locked for implementation

- Invite email subject: `{referrerName} invited you to Dealecho`. Falls back to
  "A Dealecho member invited you to Dealecho" when the referrer has no display
  name.
- `/referrals` is reachable from `/control-centre` only, matching how
  `/settings/team` is surfaced. No top-nav entry in v1.

## Pre-enable check

`config/pricing.monthlyPriceId` must be set in **live** mode before the feature
flag is turned on. If it is missing, `grantReferralCredit` cannot price the
credit and will void the reward.
