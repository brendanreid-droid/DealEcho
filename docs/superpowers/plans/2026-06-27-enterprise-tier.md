# Enterprise Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Enterprise subscription tier — $13/seat/month, minimum 5 seats — with team management (email invites, manager/user roles, seat control) backed by Stripe quantity subscriptions and a Firestore `teams` collection.

**Architecture:** One Stripe Price at $13/seat/month with `quantity` (min 5); webhook detects enterprise price ID and creates a `teams/{teamId}` Firestore doc on checkout. Callable Cloud Functions handle invites, role changes, and seat updates. Firebase Custom Claims carry `tier: enterprise`, `teamId`, and `teamRole` for client-side gating.

**Tech Stack:** TypeScript, Firebase Cloud Functions v2 (onCall), Firestore, Firebase Auth Custom Claims, Stripe, Resend (@react-email), React 19, React Router, Tailwind

**Spec:** `docs/superpowers/specs/2026-06-27-enterprise-tier-design.md`

---

## File Map

**New files:**
- `functions/src/enterprise.ts` — all enterprise callable functions (invite, accept, role, remove, seats, resend)
- `functions/src/emails/TeamInviteEmail.tsx` — team invite email template
- `pages/TeamSettings.tsx` — `/settings/team` page (manager + user views)
- `pages/AcceptInvite.tsx` — `/invite/accept?token=xxx` page

**Modified files:**
- `functions/src/checkout.ts` — add `createEnterpriseCheckout`
- `functions/src/webhook.ts` — detect enterprise price, create team on checkout, cascade cancel on deletion
- `functions/src/index.ts` — export new functions
- `src/hooks/useAuth.ts` — add `isEnterprise`, `teamId`, `teamRole`, `isTeamManager`
- `firestore.rules` — add `teams` collection rules
- `App.tsx` — add `/settings/team` and `/invite/accept` routes
- `pages/Pricing.tsx` — add Enterprise card

---

## Task 1: Stripe price + Firestore config

**Context:** The app stores Stripe price IDs in Firestore `config/pricing`. Enterprise needs its own price ID there. You must create the Stripe Price manually in the Stripe dashboard (or CLI), then store it.

**Files:**
- Modify: `functions/src/lib/constants.ts` (add enterprise price env var name)

- [ ] **Step 1: Create Stripe Price**

In Stripe Dashboard → Products → Create product "DealEcho Enterprise". Add price: $13.00 USD / month, recurring, `unit_amount: 1300`. Copy the Price ID (format: `price_xxx`).

- [ ] **Step 2: Add price ID to Firestore**

In Firebase Console → Firestore → `config/pricing` document, add field:
```
enterprisePriceId: "price_xxx"   // the ID you copied
```

- [ ] **Step 3: Add env var to functions**

In `functions/src/lib/constants.ts`, add (create file if it doesn't exist):

```typescript
export const ENTERPRISE_PRICE_ENV = 'STRIPE_ENTERPRISE_PRICE_ID';
```

- [ ] **Step 4: Set env var for local dev**

In `functions/.env` (or wherever local env vars live), add:
```
STRIPE_ENTERPRISE_PRICE_ID=price_xxx
```

- [ ] **Step 5: Commit**

```bash
git add functions/src/lib/constants.ts
git commit -m "feat: add enterprise price constant"
```

---

## Task 2: Firestore security rules for teams

**Context:** `firestore.rules` uses Firebase Custom Claims for role checks. Enterprise members have `token.teamId` and `token.teamRole` in their claims. Team data must only be readable by members and writable by managers.

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add helper functions + teams rules**

In `firestore.rules`, add inside `match /databases/{database}/documents {`:

```javascript
// Add to helpers section:
function isEnterpriseManager(teamId) {
  return isSignedIn()
    && request.auth.token.teamId == teamId
    && request.auth.token.teamRole == 'manager';
}

function isTeamMember(teamId) {
  return isSignedIn()
    && request.auth.token.teamId == teamId;
}

// Add new collection rules:
match /teams/{teamId} {
  allow read: if isTeamMember(teamId);
  allow write: if false; // Cloud Functions (Admin SDK) only

  match /members/{memberId} {
    allow read: if isTeamMember(teamId);
    allow write: if false; // Cloud Functions (Admin SDK) only
  }
}
```

- [ ] **Step 2: Deploy rules**

```bash
firebase deploy --only firestore:rules
```

Expected output: `✔ firestore: released rules firestore.rules`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for enterprise teams collection"
```

---

## Task 3: Extend useAuth hook

**Context:** `src/hooks/useAuth.ts` reads `role` and `tier` from Firebase Custom Claims. Enterprise members will have `tier: 'enterprise'`, `teamId: string`, and `teamRole: 'manager' | 'user'` in their claims. Add derived fields.

**Files:**
- Modify: `src/hooks/useAuth.ts`

- [ ] **Step 1: Update types**

In `src/hooks/useAuth.ts`, update `UserTier` and `AuthState`:

```typescript
export type UserRole = 'free' | 'paid' | 'admin' | 'free_full';
export type UserTier = 'free' | 'paid_monthly' | 'paid_annual' | 'free_full' | 'enterprise';
export type TeamRole = 'manager' | 'user';

export interface AuthState {
  user: MappedUser | null;
  role: UserRole;
  tier: UserTier;
  isAdmin: boolean;
  isPaid: boolean;
  isEnterprise: boolean;
  teamId: string | null;
  teamRole: TeamRole | null;
  isTeamManager: boolean;
  isLoading: boolean;
  refreshClaims: () => Promise<void>;
}
```

- [ ] **Step 2: Read team claims**

Add state variables and update `readClaims`:

```typescript
const [teamId, setTeamId] = useState<string | null>(null);
const [teamRole, setTeamRole] = useState<TeamRole | null>(null);

// Inside readClaims, after setting role/tier:
setTeamId((tokenResult.claims.teamId as string) ?? null);
setTeamRole((tokenResult.claims.teamRole as TeamRole) ?? null);
```

Also clear them in the `else` branch of `onAuthStateChanged`:
```typescript
setTeamId(null);
setTeamRole(null);
```

- [ ] **Step 3: Update return value**

```typescript
return {
  user,
  role,
  tier,
  isAdmin: role === 'admin',
  isPaid: role === 'paid' || role === 'admin' || role === 'free_full',
  isEnterprise: tier === 'enterprise',
  teamId,
  teamRole,
  isTeamManager: teamRole === 'manager',
  isLoading,
  refreshClaims,
};
```

- [ ] **Step 4: Run type check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat: add enterprise fields to useAuth (isEnterprise, teamId, teamRole, isTeamManager)"
```

---

## Task 4: createEnterpriseCheckout function

**Context:** Mirrors `createCheckoutSession` in `functions/src/checkout.ts`. Creates a Stripe Checkout Session for the enterprise price with `quantity: 5`, no trial. Reads price ID from `config/pricing` Firestore doc.

**Files:**
- Modify: `functions/src/checkout.ts`

- [ ] **Step 1: Add createEnterpriseCheckout**

Append to `functions/src/checkout.ts`:

```typescript
/**
 * Creates a Stripe Checkout Session for the Enterprise tier.
 * $13/seat/month, minimum 5 seats, no trial.
 */
export const createEnterpriseCheckout = onCall({ cors: true }, async (request) => {
  const stripe = getStripe();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to subscribe.');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email ?? '';
  const callerRole = (request.auth.token as any).role;

  if (callerRole === 'paid' || callerRole === 'admin') {
    throw new HttpsError(
      'already-exists',
      'You already have an active subscription. Manage it from your account settings.',
    );
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();
  let stripeCustomerId: string | undefined = userData?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { firebaseUID: uid },
    });
    stripeCustomerId = customer.id;
    await userRef.set({ stripeCustomerId }, { merge: true });
  }

  const pricingSnap = await db.collection('config').doc('pricing').get();
  const pricingData = pricingSnap.data();
  const priceId: string =
    pricingData?.enterprisePriceId ?? process.env.STRIPE_ENTERPRISE_PRICE_ID!;

  if (!priceId) {
    throw new HttpsError('internal', 'Enterprise price not configured.');
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 5 }],
    success_url: `${frontendUrl}/settings/team?checkout=success`,
    cancel_url: `${frontendUrl}/pricing?checkout=cancelled`,
    metadata: { firebaseUID: uid, plan: 'enterprise' },
    subscription_data: {
      metadata: { firebaseUID: uid, plan: 'enterprise' },
      // No trial for enterprise
    },
  });

  return { sessionUrl: session.url };
});
```

- [ ] **Step 2: Export from index**

In `functions/src/index.ts`, update the checkout export:

```typescript
export { createCheckoutSession, cancelSubscription, createEnterpriseCheckout } from './checkout';
```

- [ ] **Step 3: Build functions**

```bash
npm run build -w functions
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/checkout.ts functions/src/index.ts
git commit -m "feat: add createEnterpriseCheckout Cloud Function"
```

---

## Task 5: Webhook — enterprise detection + team creation

**Context:** `functions/src/webhook.ts` has `resolveRoleTier` which maps Stripe interval → role/tier. Enterprise is detected by matching the enterprise Price ID. On `checkout.session.completed` for enterprise, create the `teams` doc and set owner claims.

**Files:**
- Modify: `functions/src/webhook.ts`

- [ ] **Step 1: Add enterprise price detection helper**

At the top of `webhook.ts` (after imports), add:

```typescript
async function isEnterprisePlan(subscription: Stripe.Subscription): Promise<boolean> {
  const pricingSnap = await db.collection('config').doc('pricing').get();
  const enterprisePriceId =
    pricingSnap.data()?.enterprisePriceId ?? process.env.STRIPE_ENTERPRISE_PRICE_ID;
  const priceId = subscription.items.data[0]?.price?.id;
  return !!enterprisePriceId && priceId === enterprisePriceId;
}
```

- [ ] **Step 2: Update resolveRoleTier to accept enterprise flag**

Replace the existing `resolveRoleTier` function:

```typescript
type UserRole = 'free' | 'paid' | 'admin';
type UserTier = 'free' | 'paid_monthly' | 'paid_annual' | 'enterprise';

function resolveRoleTier(
  status: Stripe.Subscription.Status,
  interval: string,
  enterprise = false,
): { role: UserRole; tier: UserTier } {
  if (status === 'active' || status === 'trialing') {
    if (enterprise) return { role: 'paid', tier: 'enterprise' };
    return {
      role: 'paid',
      tier: interval === 'year' ? 'paid_annual' : 'paid_monthly',
    };
  }
  return { role: 'free', tier: 'free' };
}
```

- [ ] **Step 3: Add createTeamForOwner helper**

Add this function to `webhook.ts`:

```typescript
async function createTeamForOwner(
  uid: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const teamRef = db.collection('teams').doc();
  const teamId = teamRef.id;
  const now = new Date().toISOString();

  // Create team doc
  await teamRef.set({
    ownerId: uid,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    seats: subscription.items.data[0]?.quantity ?? 5,
    createdAt: now,
  });

  // Add owner as first member
  await teamRef.collection('members').doc(uid).set({
    uid,
    email: (await auth.getUser(uid)).email ?? '',
    teamRole: 'manager',
    status: 'active',
    invitedAt: now,
    joinedAt: now,
  });

  // Update user doc
  await db.collection('users').doc(uid).set(
    { teamId, teamRole: 'manager' },
    { merge: true },
  );

  // Set claims
  await auth.setCustomUserClaims(uid, {
    role: 'paid',
    tier: 'enterprise',
    teamId,
    teamRole: 'manager',
  });
}
```

- [ ] **Step 4: Update handleSubscriptionChange to handle enterprise**

Replace `handleSubscriptionChange`:

```typescript
async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  debugRef?: any,
) {
  console.log('Handling subscription change:', subscription.id);
  const uid = await resolveFirebaseUID(subscription, debugRef);
  if (!uid) {
    console.error('Failed to resolve Firebase UID for subscription:', subscription.id);
    if (debugRef) await debugRef.update({ handleSubError: 'uid_not_found' });
    return;
  }

  const enterprise = await isEnterprisePlan(subscription);
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval ?? 'month';
  const { role, tier } = resolveRoleTier(subscription.status, interval, enterprise);

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // For enterprise: team creation happens in checkout.session.completed handler.
  // subscription.updated just syncs seat count.
  if (enterprise && (role === 'paid')) {
    const existingUser = await db.collection('users').doc(uid).get();
    const existingTeamId = existingUser.data()?.teamId;
    if (existingTeamId) {
      // Update seat count
      const newSeats = subscription.items.data[0]?.quantity ?? 5;
      await db.collection('teams').doc(existingTeamId).update({ seats: newSeats });
    }
  }

  if (debugRef) await debugRef.update({ role, tier, subStatus: subscription.status, resolvedUid: uid, enterprise });

  const updateData: any = {
    role,
    tier,
    stripeCustomerId: customerId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (role === 'paid') updateData.hasUsedTrial = true;

  await db.collection('users').doc(uid).set(updateData, { merge: true });

  if (!enterprise) {
    await auth.setCustomUserClaims(uid, { role, tier });
  }
  // Enterprise claims set by createTeamForOwner or remain as-is from prior set

  if (role === 'paid' && !enterprise) {
    try {
      const userRecord = await auth.getUser(uid);
      const realName = userRecord.displayName || userRecord.email?.split('@')[0] || 'User';
      const reviewsSnap = await db.collection('reviews').where('userId', '==', uid).get();
      if (!reviewsSnap.empty) {
        const batch = db.batch();
        reviewsSnap.docs.forEach((doc) => batch.update(doc.ref, { userName: realName }));
        await batch.commit();
      }
    } catch (e) {
      console.error('Failed to restore review names:', (e as Error).message);
    }
  }

  if (debugRef) await debugRef.update({ result: 'firestore_and_claims_updated' });
}
```

- [ ] **Step 5: Update checkout.session.completed case**

In the `switch (event.type)` block, replace `checkout.session.completed`:

```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const enterprise = await isEnterprisePlan(subscription);
    if (enterprise) {
      const uid = await resolveFirebaseUID(subscription, debugRef);
      if (uid) await createTeamForOwner(uid, subscription);
    } else {
      await handleSubscriptionChange(subscription, debugRef);
    }
  } else {
    console.warn('No subscription found in checkout session');
    await debugRef.update({ warning: 'no_subscription_in_session' });
  }
  break;
}
```

- [ ] **Step 6: Build + check**

```bash
npm run build -w functions
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add functions/src/webhook.ts
git commit -m "feat: webhook detects enterprise tier, creates team on checkout"
```

---

## Task 6: Webhook — enterprise subscription cancellation cascade

**Context:** When an enterprise subscription is deleted, all team members must be reverted to `role: free, tier: free` and have their `teamId`/`teamRole` cleared.

**Files:**
- Modify: `functions/src/webhook.ts`

- [ ] **Step 1: Add cascade helper**

Add to `webhook.ts`:

```typescript
async function handleEnterpriseSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Find team by stripeSubscriptionId
  const teamsSnap = await db
    .collection('teams')
    .where('stripeSubscriptionId', '==', subscription.id)
    .limit(1)
    .get();

  if (teamsSnap.empty) {
    console.warn('No team found for cancelled enterprise subscription:', subscription.id);
    return;
  }

  const teamDoc = teamsSnap.docs[0];
  const teamId = teamDoc.id;

  // Get all members
  const membersSnap = await teamDoc.ref.collection('members').get();

  const batch = db.batch();
  const claimUpdates: Promise<void>[] = [];

  for (const memberDoc of membersSnap.docs) {
    const { uid } = memberDoc.data();
    // Clear team fields on user doc
    batch.update(db.collection('users').doc(uid), {
      teamId: null,
      teamRole: null,
      role: 'free',
      tier: 'free',
      subscriptionStatus: 'cancelled',
      currentPeriodEnd: null,
      updatedAt: new Date().toISOString(),
    });
    // Reset custom claims
    claimUpdates.push(
      auth.setCustomUserClaims(uid, { role: 'free', tier: 'free' }),
    );
  }

  // Mark team as cancelled
  batch.update(teamDoc.ref, { cancelledAt: new Date().toISOString() });

  await batch.commit();
  await Promise.all(claimUpdates);
}
```

- [ ] **Step 2: Update handleSubscriptionDeleted to detect enterprise**

Replace `handleSubscriptionDeleted`:

```typescript
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  debugRef?: any,
) {
  const enterprise = await isEnterprisePlan(subscription);
  if (enterprise) {
    await handleEnterpriseSubscriptionDeleted(subscription);
    return;
  }

  // Existing individual subscription cancellation logic:
  const uid = await resolveFirebaseUID(subscription, debugRef);
  if (!uid) return;

  await db.collection('users').doc(uid).set(
    {
      role: 'free',
      tier: 'free',
      subscriptionStatus: 'cancelled',
      currentPeriodEnd: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await auth.setCustomUserClaims(uid, { role: 'free', tier: 'free' });

  const reviewsSnap = await db.collection('reviews').where('userId', '==', uid).get();
  if (!reviewsSnap.empty) {
    const batch = db.batch();
    reviewsSnap.docs.forEach((doc) => batch.update(doc.ref, { userName: 'Anonymous' }));
    await batch.commit();
  }
}
```

- [ ] **Step 3: Build + check**

```bash
npm run build -w functions
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/webhook.ts
git commit -m "feat: cascade enterprise subscription cancellation to all team members"
```

---

## Task 7: TeamInviteEmail template

**Context:** Team invites are sent via Resend using `@react-email/components`. The existing `InviteEmail.tsx` is for admin-created accounts. Create a separate `TeamInviteEmail.tsx` for enterprise team invites.

**Files:**
- Create: `functions/src/emails/TeamInviteEmail.tsx`

- [ ] **Step 1: Create template**

```typescript
import * as React from 'react';
import { Text, Heading, Button, Section } from '@react-email/components';
import { DealEchoEmailLayout } from './Layout';

interface TeamInviteEmailProps {
  inviterName: string;
  teamRole: 'manager' | 'user';
  acceptUrl: string;
  recipientEmail: string;
}

export const TeamInviteEmail: React.FC<TeamInviteEmailProps> = ({
  inviterName,
  teamRole,
  acceptUrl,
  recipientEmail,
}) => (
  <DealEchoEmailLayout
    previewTextText={`${inviterName} invited you to join their DealEcho Enterprise team.`}
    userEmail={recipientEmail}
  >
    <Heading style={h1}>You've been invited to DealEcho Enterprise</Heading>

    <Text style={paragraph}>
      {inviterName} has invited you to join their DealEcho Enterprise team as a{' '}
      <strong>{teamRole === 'manager' ? 'Team Manager' : 'Team Member'}</strong>.
    </Text>

    <Text style={paragraph}>
      As an Enterprise member you'll get full Pro access — plus{' '}
      {teamRole === 'manager' ? 'the ability to manage your team's seats and members.' : 'access to all deal intelligence features.'}
    </Text>

    <Section style={ctaContainer}>
      <Button href={acceptUrl} style={primaryButton}>
        Accept Invitation
      </Button>
    </Section>

    <Text style={subtext}>
      This invite link expires in 7 days. If you didn't expect this email, you can safely ignore it.
      <br />
      <span style={linkText}>{acceptUrl}</span>
    </Text>

    <Text style={signoff}>
      Good selling,
      <br />
      <strong>The dealecho Team</strong>
    </Text>
  </DealEchoEmailLayout>
);

const h1 = { color: '#0f172a', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 24px 0' };
const paragraph = { color: '#334155', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' };
const ctaContainer = { textAlign: 'center' as const, margin: '32px 0 24px 0' };
const primaryButton = { backgroundColor: '#4f46e5', borderRadius: '14px', color: '#ffffff', fontSize: '14px', fontWeight: '800', textDecoration: 'none', textAlign: 'center' as const, display: 'inline-block', padding: '16px 32px' };
const subtext = { color: '#64748b', fontSize: '12px', lineHeight: '1.6', margin: '24px 0 0 0' };
const linkText = { color: '#4f46e5', fontSize: '11px', wordBreak: 'break-all' as const };
const signoff = { color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '32px' };
```

- [ ] **Step 2: Build functions**

```bash
npm run build -w functions
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/emails/TeamInviteEmail.tsx
git commit -m "feat: add TeamInviteEmail template for enterprise invites"
```

---

## Task 8: Enterprise callable functions (invite, accept, role, remove, seats, resend)

**Context:** All enterprise team management logic lives in `functions/src/enterprise.ts`. Each function is an `onCall` with auth enforcement. Uses `db` and `auth` from `./lib/firebaseAdmin`. Uses `sendEmail` from `./lib/email` (check that file for correct import/usage). Uses `TeamInviteEmail` from `./emails/TeamInviteEmail`.

**Files:**
- Create: `functions/src/enterprise.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Read email lib to understand send pattern**

Read `functions/src/lib/email.ts` to understand how to call `sendEmail` (subject, from, to, react component).

- [ ] **Step 2: Create enterprise.ts**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';
import { db, auth } from './lib/firebaseAdmin';
import { getStripe } from './lib/stripe';
import { sendEmail } from './lib/email';
import { TeamInviteEmail } from './emails/TeamInviteEmail';
import * as React from 'react';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const MIN_SEATS = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertManager(uid: string, teamId: string) {
  const memberSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .doc(uid)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.teamRole !== 'manager') {
    throw new HttpsError('permission-denied', 'Only team managers can perform this action.');
  }
}

async function getTeamOrThrow(teamId: string) {
  const teamSnap = await db.collection('teams').doc(teamId).get();
  if (!teamSnap.exists) throw new HttpsError('not-found', 'Team not found.');
  return { id: teamId, ...teamSnap.data() } as any;
}

// ── inviteTeamMember ─────────────────────────────────────────────────────────

export const inviteTeamMember = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(uid, teamId);

  const { email, teamRole }: { email: string; teamRole: 'manager' | 'user' } = request.data;
  if (!email || !teamRole) throw new HttpsError('invalid-argument', 'email and teamRole required.');
  if (!['manager', 'user'].includes(teamRole)) throw new HttpsError('invalid-argument', 'teamRole must be manager or user.');

  const team = await getTeamOrThrow(teamId);

  // Check seat capacity
  const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
  const activeCount = membersSnap.docs.filter((d) => d.data().status === 'active').length;
  if (activeCount >= team.seats) {
    throw new HttpsError('resource-exhausted', 'No seats available. Add more seats first.');
  }

  // Check not already a member
  const existing = membersSnap.docs.find((d) => d.data().email === email);
  if (existing) throw new HttpsError('already-exists', 'This email is already a team member or has a pending invite.');

  // Check not on another team
  const otherTeamSnap = await db.collection('users').where('teamId', '!=', null).get();
  const conflict = otherTeamSnap.docs.find((d) => d.data().email === email && d.data().teamId !== teamId);
  if (conflict) throw new HttpsError('already-exists', 'This user is already a member of another team.');

  const inviteToken = randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const inviteDocRef = db.collection('teams').doc(teamId).collection('members').doc();

  await inviteDocRef.set({
    uid: inviteDocRef.id, // placeholder; replaced on accept
    email,
    teamRole,
    status: 'invited',
    inviteToken,
    invitedAt: now,
  });

  const inviterRecord = await auth.getUser(uid);
  const inviterName = inviterRecord.displayName || inviterRecord.email?.split('@')[0] || 'Your team manager';
  const acceptUrl = `${FRONTEND_URL}/invite/accept?token=${inviteToken}`;

  await sendEmail({
    to: email,
    subject: `${inviterName} invited you to DealEcho Enterprise`,
    react: React.createElement(TeamInviteEmail, { inviterName, teamRole, acceptUrl, recipientEmail: email }),
  });

  return { success: true };
});

// ── acceptTeamInvite ─────────────────────────────────────────────────────────

export const acceptTeamInvite = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const { token }: { token: string } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'token required.');

  // Find invite by token across all teams
  const teamsSnap = await db.collection('teams').get();
  let foundTeamId: string | null = null;
  let foundMemberRef: FirebaseFirestore.DocumentReference | null = null;
  let foundMemberData: any = null;

  for (const teamDoc of teamsSnap.docs) {
    const membersSnap = await teamDoc.ref.collection('members').where('inviteToken', '==', token).limit(1).get();
    if (!membersSnap.empty) {
      foundTeamId = teamDoc.id;
      foundMemberRef = membersSnap.docs[0].ref;
      foundMemberData = membersSnap.docs[0].data();
      break;
    }
  }

  if (!foundTeamId || !foundMemberRef || !foundMemberData) {
    throw new HttpsError('not-found', 'Invalid or expired invite token.');
  }

  if (foundMemberData.status !== 'invited') {
    throw new HttpsError('failed-precondition', 'This invite has already been used.');
  }

  const userRecord = await auth.getUser(uid);
  if (userRecord.email !== foundMemberData.email) {
    throw new HttpsError('permission-denied', 'This invite was sent to a different email address.');
  }

  const now = new Date().toISOString();
  const { teamRole } = foundMemberData;

  // Update member doc: replace placeholder with real uid, set active
  await foundMemberRef.delete();
  await db
    .collection('teams')
    .doc(foundTeamId)
    .collection('members')
    .doc(uid)
    .set({
      uid,
      email: userRecord.email ?? '',
      teamRole,
      status: 'active',
      invitedAt: foundMemberData.invitedAt,
      joinedAt: now,
    });

  // Update user doc
  await db.collection('users').doc(uid).set(
    { teamId: foundTeamId, teamRole },
    { merge: true },
  );

  // Set claims
  await auth.setCustomUserClaims(uid, {
    role: 'paid',
    tier: 'enterprise',
    teamId: foundTeamId,
    teamRole,
  });

  return { success: true, teamId: foundTeamId, teamRole };
});

// ── updateTeamMemberRole ─────────────────────────────────────────────────────

export const updateTeamMemberRole = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { targetUid, newRole }: { targetUid: string; newRole: 'manager' | 'user' } = request.data;
  if (!targetUid || !newRole) throw new HttpsError('invalid-argument', 'targetUid and newRole required.');
  if (!['manager', 'user'].includes(newRole)) throw new HttpsError('invalid-argument', 'newRole must be manager or user.');

  // Block demoting self if last manager
  if (targetUid === callerUid && newRole === 'user') {
    const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
    const managerCount = membersSnap.docs.filter((d) => d.data().teamRole === 'manager' && d.data().status === 'active').length;
    if (managerCount <= 1) {
      throw new HttpsError('failed-precondition', 'Cannot demote yourself — promote another manager first.');
    }
  }

  const memberRef = db.collection('teams').doc(teamId).collection('members').doc(targetUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new HttpsError('not-found', 'Member not found in team.');

  await memberRef.update({ teamRole: newRole });
  await db.collection('users').doc(targetUid).set({ teamRole: newRole }, { merge: true });

  const existingClaims = (await auth.getUser(targetUid)).customClaims ?? {};
  await auth.setCustomUserClaims(targetUid, { ...existingClaims, teamRole: newRole });

  return { success: true };
});

// ── removeTeamMember ─────────────────────────────────────────────────────────

export const removeTeamMember = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { targetUid }: { targetUid: string } = request.data;
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid required.');

  const team = await getTeamOrThrow(teamId);
  if (targetUid === team.ownerId) {
    throw new HttpsError('failed-precondition', 'Cannot remove the billing owner from the team.');
  }

  // Block removing self if last manager
  if (targetUid === callerUid) {
    const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
    const managerCount = membersSnap.docs.filter((d) => d.data().teamRole === 'manager' && d.data().status === 'active').length;
    if (managerCount <= 1) {
      throw new HttpsError('failed-precondition', 'Cannot remove yourself — promote another manager first.');
    }
  }

  await db.collection('teams').doc(teamId).collection('members').doc(targetUid).delete();

  await db.collection('users').doc(targetUid).set(
    { teamId: null, teamRole: null, role: 'free', tier: 'free', updatedAt: new Date().toISOString() },
    { merge: true },
  );

  await auth.setCustomUserClaims(targetUid, { role: 'free', tier: 'free' });

  return { success: true };
});

// ── updateTeamSeats ──────────────────────────────────────────────────────────

export const updateTeamSeats = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  const team = await getTeamOrThrow(teamId);
  if (uid !== team.ownerId) {
    throw new HttpsError('permission-denied', 'Only the billing owner can change seat count.');
  }

  const { seats }: { seats: number } = request.data;
  if (!seats || typeof seats !== 'number') throw new HttpsError('invalid-argument', 'seats must be a number.');

  if (seats < MIN_SEATS) {
    throw new HttpsError('invalid-argument', `Minimum ${MIN_SEATS} seats required.`);
  }

  // Cannot reduce below current active member count
  const membersSnap = await db.collection('teams').doc(teamId).collection('members').get();
  const activeCount = membersSnap.docs.filter((d) => d.data().status === 'active').length;
  if (seats < activeCount) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot reduce to ${seats} seats — ${activeCount} active members. Remove members first.`,
    );
  }

  const stripe = getStripe();
  await stripe.subscriptions.update(team.stripeSubscriptionId, {
    items: [{ quantity: seats }],
    proration_behavior: 'always_invoice',
  });

  // seats field updated by webhook on subscription.updated
  return { success: true, seats };
});

// ── resendTeamInvite ─────────────────────────────────────────────────────────

export const resendTeamInvite = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { inviteEmail }: { inviteEmail: string } = request.data;
  if (!inviteEmail) throw new HttpsError('invalid-argument', 'inviteEmail required.');

  const membersSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .where('email', '==', inviteEmail)
    .where('status', '==', 'invited')
    .limit(1)
    .get();

  if (membersSnap.empty) throw new HttpsError('not-found', 'No pending invite found for this email.');

  const memberRef = membersSnap.docs[0].ref;
  const memberData = membersSnap.docs[0].data();
  const newToken = randomBytes(32).toString('hex');

  await memberRef.update({ inviteToken: newToken });

  const callerRecord = await auth.getUser(callerUid);
  const inviterName = callerRecord.displayName || callerRecord.email?.split('@')[0] || 'Your team manager';
  const acceptUrl = `${FRONTEND_URL}/invite/accept?token=${newToken}`;

  await sendEmail({
    to: inviteEmail,
    subject: `${inviterName} re-sent your DealEcho Enterprise invite`,
    react: React.createElement(TeamInviteEmail, {
      inviterName,
      teamRole: memberData.teamRole,
      acceptUrl,
      recipientEmail: inviteEmail,
    }),
  });

  return { success: true };
});

// ── cancelPendingInvite ──────────────────────────────────────────────────────

export const cancelPendingInvite = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const callerUid = request.auth.uid;
  const teamId: string = (request.auth.token as any).teamId;
  if (!teamId) throw new HttpsError('failed-precondition', 'Not part of an enterprise team.');

  await assertManager(callerUid, teamId);

  const { inviteEmail }: { inviteEmail: string } = request.data;
  if (!inviteEmail) throw new HttpsError('invalid-argument', 'inviteEmail required.');

  const membersSnap = await db
    .collection('teams')
    .doc(teamId)
    .collection('members')
    .where('email', '==', inviteEmail)
    .where('status', '==', 'invited')
    .limit(1)
    .get();

  if (membersSnap.empty) throw new HttpsError('not-found', 'No pending invite found for this email.');

  await membersSnap.docs[0].ref.delete();

  return { success: true };
});
```

- [ ] **Step 3: Export all from index.ts**

In `functions/src/index.ts`, add:

```typescript
export {
  inviteTeamMember,
  acceptTeamInvite,
  updateTeamMemberRole,
  removeTeamMember,
  updateTeamSeats,
  resendTeamInvite,
  cancelPendingInvite,
} from './enterprise';
```

- [ ] **Step 4: Build functions**

```bash
npm run build -w functions
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add functions/src/enterprise.ts functions/src/index.ts
git commit -m "feat: enterprise Cloud Functions (invite, accept, role, remove, seats, resend)"
```

---

## Task 9: AcceptInvite page

**Context:** Page at `/invite/accept?token=xxx`. User lands here from email link. If not signed in, show sign-in prompt. If signed in, call `acceptTeamInvite` with the token. Show success or error.

**Files:**
- Create: `pages/AcceptInvite.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create AcceptInvite page**

```typescript
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../src/hooks/useAuth';

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading, refreshClaims } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (isLoading || !token || !user || status !== 'idle') return;

    setStatus('loading');
    const functions = getFunctions();
    const accept = httpsCallable(functions, 'acceptTeamInvite');

    accept({ token })
      .then(async () => {
        await refreshClaims();
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Something went wrong.');
      });
  }, [isLoading, user, token, status, refreshClaims]);

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-500">Invalid invite link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">You've been invited to DealEcho Enterprise</h1>
        <p className="text-slate-500 max-w-md">Sign in or create an account to accept your team invite. Come back to this link after signing in.</p>
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">You're in!</h1>
        <p className="text-slate-500">You now have Enterprise access. Head to your team settings to see your team.</p>
        <button
          onClick={() => navigate('/settings/team')}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition"
        >
          Go to Team Settings
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-slate-900">Couldn't accept invite</h1>
      <p className="text-red-500 max-w-md">{errorMsg}</p>
    </div>
  );
};

export default AcceptInvite;
```

- [ ] **Step 2: Add route in App.tsx**

Add to lazy imports at top of `App.tsx`:
```typescript
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
```

Add routes inside `<Routes>`:
```tsx
<Route path="/invite/accept" element={<AcceptInvite />} />
<Route
  path="/settings/team"
  element={
    <ProtectedRoute requireAuth>
      <TeamSettings />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Type check**

```bash
npm run type-check
```

Expected: no errors (TeamSettings not created yet — comment it out temporarily if needed).

- [ ] **Step 4: Commit**

```bash
git add pages/AcceptInvite.tsx App.tsx
git commit -m "feat: AcceptInvite page + routes for /invite/accept and /settings/team"
```

---

## Task 10: TeamSettings page

**Context:** Route `/settings/team`. Reads team data from Firestore `teams/{teamId}` and `teams/{teamId}/members`. Manager sees full controls; user sees read-only view. All mutations call the Cloud Functions from Task 8.

**Files:**
- Create: `pages/TeamSettings.tsx`

- [ ] **Step 1: Create TeamSettings page**

```typescript
import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../src/firebase/config';
import { useAuth } from '../src/hooks/useAuth';

interface TeamMember {
  uid: string;
  email: string;
  teamRole: 'manager' | 'user';
  status: 'active' | 'invited';
}

interface Team {
  ownerId: string;
  seats: number;
  stripeSubscriptionId: string;
}

const TeamSettings: React.FC = () => {
  const { user, teamId, teamRole, isTeamManager, isEnterprise, refreshClaims } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'user'>('user');
  const [addSeatsCount, setAddSeatsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fns = getFunctions();

  useEffect(() => {
    if (!teamId) return;

    const unsubTeam = onSnapshot(doc(db, 'teams', teamId), (snap) => {
      if (snap.exists()) setTeam(snap.data() as Team);
    });

    const unsubMembers = onSnapshot(collection(db, 'teams', teamId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as TeamMember)));
      setLoading(false);
    });

    return () => { unsubTeam(); unsubMembers(); };
  }, [teamId]);

  const call = async (fnName: string, data: object, loadingKey: string) => {
    setActionLoading(loadingKey);
    setError('');
    setSuccess('');
    try {
      await httpsCallable(fns, fnName)(data);
      setSuccess('Done.');
      await refreshClaims();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isEnterprise) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">Enterprise plan required to access team settings.</p>
      </div>
    );
  }

  if (loading || !team) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  const activeCount = members.filter((m) => m.status === 'active').length;
  const monthlyCost = team.seats * 13;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Team Settings</h1>

      {/* Billing header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Enterprise Plan</div>
          <div className="text-slate-600 text-sm">
            {activeCount} of {team.seats} seats used · ${monthlyCost}/mo
          </div>
        </div>
        {isTeamManager && user?.id === team.ownerId && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              placeholder="New seat count"
              value={addSeatsCount ?? ''}
              onChange={(e) => setAddSeatsCount(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <button
              disabled={!addSeatsCount || actionLoading === 'seats'}
              onClick={() => addSeatsCount && call('updateTeamSeats', { seats: addSeatsCount }, 'seats')}
              className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition"
            >
              {actionLoading === 'seats' ? 'Updating…' : 'Update Seats'}
            </button>
          </div>
        )}
      </div>

      {/* Feedback */}
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      {/* Members table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Member</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
              {isTeamManager && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.uid} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-700">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    m.teamRole === 'manager'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {m.teamRole === 'manager' ? (m.uid === team.ownerId ? 'Manager (Owner)' : 'Manager') : 'User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {m.status === 'active'
                    ? <span className="text-green-600 text-xs">● Active</span>
                    : <span className="text-amber-500 text-xs">⏳ Invite pending</span>
                  }
                </td>
                {isTeamManager && (
                  <td className="px-4 py-3 text-right space-x-2">
                    {m.status === 'invited' ? (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('resendTeamInvite', { inviteEmail: m.email }, `resend-${m.uid}`)}
                          className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `resend-${m.uid}` ? '…' : 'Resend'}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('cancelPendingInvite', { inviteEmail: m.email }, `cancel-${m.uid}`)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : m.uid !== team.ownerId ? (
                      <>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => call('updateTeamMemberRole', { targetUid: m.uid, newRole: m.teamRole === 'manager' ? 'user' : 'manager' }, `role-${m.uid}`)}
                          className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `role-${m.uid}` ? '…' : m.teamRole === 'manager' ? 'Make User' : 'Make Manager'}
                        </button>
                        <button
                          disabled={!!actionLoading}
                          onClick={() => {
                            if (confirm(`Remove ${m.email} from the team? They'll revert to free.`)) {
                              call('removeTeamMember', { targetUid: m.uid }, `remove-${m.uid}`);
                            }
                          }}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded disabled:opacity-50"
                        >
                          {actionLoading === `remove-${m.uid}` ? '…' : 'Remove'}
                        </button>
                      </>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form — managers only */}
      {isTeamManager && (
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'manager' | 'user')}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="user">User</option>
            <option value="manager">Manager</option>
          </select>
          <button
            disabled={!inviteEmail || !!actionLoading}
            onClick={() => {
              call('inviteTeamMember', { email: inviteEmail, teamRole: inviteRole }, 'invite').then(() => setInviteEmail(''));
            }}
            className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50 transition"
          >
            {actionLoading === 'invite' ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamSettings;
```

- [ ] **Step 2: Type check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pages/TeamSettings.tsx
git commit -m "feat: TeamSettings page with member table, invite form, role/remove controls"
```

---

## Task 11: Add Enterprise card to Pricing page

**Context:** `pages/Pricing.tsx` shows Free and Pro cards. Add an Enterprise card. The CTA calls `createEnterpriseCheckout`. Check the existing Pricing page for the card structure to follow.

**Files:**
- Modify: `pages/Pricing.tsx`

- [ ] **Step 1: Read current Pricing page**

Read `pages/Pricing.tsx` to understand the current card structure and how `createCheckoutSession` is called.

- [ ] **Step 2: Add Enterprise card**

Following the existing card pattern, add an Enterprise card with:
- Title: "Enterprise"
- Price: "$65/mo" with subtext "5 seats included · $13/mo per additional user"
- No trial badge
- Features list: All Pro features, Team management dashboard, Manager & user roles, Add seats any time, Immediate seat proration
- CTA button: calls `createEnterpriseCheckout` (no `plan` argument needed), disabled if user already has enterprise tier
- Import and call `httpsCallable(getFunctions(), 'createEnterpriseCheckout')`, redirect to `result.data.sessionUrl`

- [ ] **Step 3: Type check + dev server**

```bash
npm run type-check
npm run dev
```

Open `http://localhost:5173/pricing` and verify Enterprise card appears correctly.

- [ ] **Step 4: Commit**

```bash
git add pages/Pricing.tsx
git commit -m "feat: add Enterprise pricing card with createEnterpriseCheckout CTA"
```

---

## Task 12: Add Team link to navigation (enterprise users only)

**Context:** Enterprise users need a way to reach `/settings/team`. The `Navigation` component in `src/components/Shell.tsx` receives `isPaid`, `isAdmin`, `user` as props. Add `isEnterprise` and `isTeamManager` props so it can show a "Team" nav link.

**Files:**
- Modify: `src/components/Shell.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Read Shell.tsx Navigation props**

Read `src/components/Shell.tsx` to understand the Navigation component interface.

- [ ] **Step 2: Add isEnterprise prop + Team link**

Add `isEnterprise?: boolean` to Navigation props. Inside Navigation, add a "Team" link to `/settings/team` that renders only when `isEnterprise` is true, alongside existing nav links.

- [ ] **Step 3: Pass prop from App.tsx**

In `App.tsx`, destructure `isEnterprise` from `useAuth()` and pass it to `<Navigation>`.

- [ ] **Step 4: Type check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Shell.tsx App.tsx
git commit -m "feat: show Team nav link for enterprise users"
```

---

## Task 13: Deploy functions

**Context:** All new Cloud Functions must be deployed before the UI can call them.

- [ ] **Step 1: Deploy functions**

```bash
npm run deploy -w functions
```

Expected: all functions deploy successfully. Check Firebase Console → Functions for the new entries: `createEnterpriseCheckout`, `inviteTeamMember`, `acceptTeamInvite`, `updateTeamMemberRole`, `removeTeamMember`, `updateTeamSeats`, `resendTeamInvite`, `cancelPendingInvite`.

- [ ] **Step 2: Verify webhook still works**

Check Firebase Console → Firestore → `webhooks_debug` collection for any recent errors after deploy.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: enterprise functions deployed"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ $13/seat/month, min 5 seats — Task 1 (Stripe price), Task 4 (checkout)
- ✅ No trial — Task 4 (no `trial_period_days`)
- ✅ Email invite — Task 8 (`inviteTeamMember`), Task 7 (email template)
- ✅ Role: manager/user — Task 8 (`updateTeamMemberRole`)
- ✅ Remove from team — Task 8 (`removeTeamMember`)
- ✅ Multiple managers — allowed by `assertManager` (checks role, not uniqueness)
- ✅ Immediate proration — Task 8 (`updateTeamSeats` uses `proration_behavior: 'always_invoice'`)
- ✅ Cancellation cascade — Task 6 (`handleEnterpriseSubscriptionDeleted`)
- ✅ Firestore rules — Task 2
- ✅ useAuth extension — Task 3
- ✅ Team dashboard UI — Task 10
- ✅ Pricing card — Task 11
- ✅ AcceptInvite page — Task 9
- ✅ Nav link — Task 12
- ✅ `cancelPendingInvite` — included in Task 8 (visible in UI as "Cancel" on pending rows)
- ✅ Last manager protection — `assertManager` + explicit checks in remove/demote

**No placeholder scan:** All code blocks are complete. No TBD/TODO.

**Type consistency:**
- `TeamRole: 'manager' | 'user'` defined in `useAuth.ts`, used consistently in `enterprise.ts` and `TeamSettings.tsx`
- `teamId` accessed via `(request.auth.token as any).teamId` consistently across all functions
- `sendEmail` usage in Task 8 Step 1 says "read email.ts first" — implementer must check the exact API before coding
