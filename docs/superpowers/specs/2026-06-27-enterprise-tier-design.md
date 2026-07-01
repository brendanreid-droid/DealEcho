# Enterprise Tier Design

**Date:** 2026-06-27  
**Status:** Approved for implementation

## Summary

Add an Enterprise subscription tier: $13/seat/month, minimum 5 seats ($65/mo). No trial. Managers invite members via email, control roles, and manage seats. Multiple managers allowed. Billing handled via Stripe per-seat quantity subscription with immediate proration.

---

## Pricing Model

- **$13/seat/month**, minimum quantity of 5
- Base invoice: $65/mo (5 seats)
- Each additional seat: +$13/mo, billed with immediate proration
- No free trial (unlike Pro monthly)
- One Stripe Price object, recurring monthly, `unit_amount: 1300`

---

## Data Model

### Stripe

- New Price: `$13/seat/month`, `unit_amount: 1300`, `currency: usd`, `recurring.interval: month`
- Subscription created with `quantity: 5` minimum; `metadata.firebaseUID` set on customer
- Seat changes: `stripe.subscriptions.update({ quantity: n })` — Stripe handles proration
- Minimum quantity enforced at API call level (never allow `quantity < 5`)

### Firestore: `teams/{teamId}`

```
teamId: string             // auto-generated
ownerId: string            // uid of billing owner; permanent member, cannot be removed
stripeCustomerId: string
stripeSubscriptionId: string
seats: number              // current Stripe quantity (min 5)
createdAt: timestamp
```

### Firestore: `teams/{teamId}/members/{uid}`

```
uid: string
email: string
teamRole: 'manager' | 'user'
status: 'active' | 'invited'
inviteToken?: string       // present while invite not accepted
invitedAt: timestamp
joinedAt?: timestamp
```

### User doc changes (`users/{uid}`)

Two new optional fields added when a user joins a team:

```
teamId?: string
teamRole?: 'manager' | 'user'
```

Cleared when user is removed or subscription is cancelled.

### Firebase Custom Claims

Extended to include enterprise fields:

```
role: 'paid'               // same as Pro
tier: 'enterprise'         // new value
teamId: string
teamRole: 'manager' | 'user'
```

`tier: 'enterprise'` is how the app distinguishes enterprise members from individual Pro subscribers.

---

## Cloud Functions

### `createEnterpriseCheckout`
HTTP callable (auth required). Creates a Stripe Checkout Session:
- Price: enterprise price ID, quantity: 5
- No trial
- `metadata.firebaseUID` on customer
- Returns checkout URL

### Webhook: `checkout.session.completed` (enterprise)
Detected by matching the enterprise Price ID. On completion:
1. Resolve Firebase UID from subscription metadata
2. Create `teams/{teamId}` doc (owner = subscribing user)
3. Add owner to `teams/{teamId}/members/{uid}` with `teamRole: manager`, `status: active`
4. Set `teamId` + `teamRole: manager` on owner's user doc
5. Set custom claims: `role: paid, tier: enterprise, teamId, teamRole: manager`

### Webhook: `customer.subscription.updated` (enterprise)
Update `teams/{teamId}.seats` from `subscription.quantity`.

### Webhook: `customer.subscription.deleted` (enterprise)
1. Fetch all members from `teams/{teamId}/members`
2. For each member: clear `teamId`/`teamRole` from user doc, reset claims to `role: free, tier: free`
3. Mark team doc as cancelled

### `inviteTeamMember`
Callable (auth required, `teamRole: manager`). 
- Validates: seat capacity not exceeded, email not already a member, email not on another team
- Creates `members/{newDocId}` with `status: invited`, random `inviteToken`, assigned `teamRole`
- Sends invite email via Resend with accept link containing token

### `acceptTeamInvite`
Callable (auth required). 
- Validates invite token matches a pending invite for this user's email
- If invitee has active individual Pro subscription: surface warning (they should cancel it)
- Sets member `status: active`, `joinedAt`
- Writes `teamId`/`teamRole` to user doc
- Sets custom claims: `role: paid, tier: enterprise, teamId, teamRole`

### `updateTeamMemberRole`
Callable (auth required, `teamRole: manager`).
- Promotes/demotes member between `manager`/`user`
- Cannot demote self if last manager
- Updates `teams/{teamId}/members/{uid}.teamRole`
- Updates user doc + custom claims

### `removeTeamMember`
Callable (auth required, `teamRole: manager`).
- Cannot remove billing owner (`ownerId`)
- Cannot remove self if last manager
- Deletes `teams/{teamId}/members/{uid}`
- Clears `teamId`/`teamRole` from user doc
- Resets claims to `role: free, tier: free`
- **Does not reduce seat count** — manager must call `updateTeamSeats` separately

### `updateTeamSeats`
Callable (auth required, billing owner only — `uid === team.ownerId`).
- Validates new quantity ≥ current active member count and ≥ 5
- Calls `stripe.subscriptions.update({ quantity: n })`
- Stripe webhook updates `teams/{teamId}.seats`

### `resendTeamInvite`
Callable (auth required, `teamRole: manager`).
- Regenerates invite token, re-sends email

---

## Frontend

### New route: `/settings/team`
Visible only to users with `tier: enterprise`.

**For managers:**
- Header: plan name, seat usage (X of Y used), monthly cost, renewal date
- Member table: name/email, role badge, status, action buttons (Make Manager / Make User / Remove)
- Pending invites show "Invite pending" status with Resend / Cancel actions
- Invite form at bottom: email input + role dropdown + Send Invite button
- "Add Seat (+$13/mo)" button — confirms proration before calling `updateTeamSeats`

**For users (non-manager):**
- Read-only view: team name, their own role, list of team members (names only)

### Pricing page changes
Add Enterprise card alongside Free and Pro. Show "$65/mo for 5 users, $13/mo per additional user". No trial badge. CTA: "Contact us" or direct checkout.

### `useAuth` hook changes
Add `isEnterprise`, `teamId`, `teamRole` derived from claims:
```ts
isEnterprise: tier === 'enterprise'
teamId: claims.teamId ?? null
teamRole: claims.teamRole ?? null
isTeamManager: claims.teamRole === 'manager'
```

---

## Security

### Firestore rules

```
match /teams/{teamId} {
  allow read: if request.auth.token.teamId == teamId;
  allow write: if request.auth.token.teamId == teamId
               && request.auth.token.teamRole == 'manager';

  match /members/{uid} {
    allow read: if request.auth.token.teamId == teamId;
    allow write: if request.auth.token.teamId == teamId
                 && request.auth.token.teamRole == 'manager';
  }
}
```

Claims-based gating avoids extra Firestore reads on every rule evaluation.

---

## Edge Cases

| Case | Handling |
|---|---|
| Last manager tries to remove self | Block with error: must promote another manager first |
| Last manager tries to demote self | Block with same error |
| Invite sent to existing team member | Reject: already on team |
| Invite sent to user on another team | Reject: one team per user |
| Invitee has active Pro subscription | Accept invite, surface warning to cancel individual sub |
| Subscription cancelled | Webhook reverts all members to free, clears team fields |
| `updateTeamSeats` quantity < active members | Reject: cannot reduce below current headcount |
| `updateTeamSeats` quantity < 5 | Reject: minimum 5 seats enforced |
| Billing owner tries to leave team | Blocked: owner is permanent |
