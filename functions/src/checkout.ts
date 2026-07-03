import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStripe } from "./lib/stripe";
import { db } from "./lib/firebaseAdmin";

type Plan = "monthly" | "annual";

/**
 * Returns a Stripe customer id valid under the CURRENT Stripe mode, creating a
 * new one if the stored id is missing/deleted or belongs to the other mode
 * (happens on the test→live cutover). Persists any newly created id.
 */
async function resolveStripeCustomer(
  stripe: import("stripe").default,
  uid: string,
  email: string,
  storedId: string | undefined,
): Promise<string> {
  if (storedId) {
    try {
      const existing = await stripe.customers.retrieve(storedId);
      if (!(existing as any)?.deleted) return storedId;
    } catch (err: any) {
      if (err?.code !== "resource_missing") throw err;
    }
  }
  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUID: uid },
  });
  await db.collection("users").doc(uid).set(
    { stripeCustomerId: customer.id },
    { merge: true },
  );
  return customer.id;
}

/**
 * Creates a Stripe Checkout Session for the authenticated user.
 * Returns a sessionUrl — the frontend redirects to it.
 */
export const createCheckoutSession = onCall({ cors: true }, async (request) => {
  const stripe = getStripe();
  // 1. Enforce authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to subscribe.",
    );
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email ?? "";
  const plan: Plan = request.data?.plan ?? "monthly";

  // 1b. Block users who already have an active paid subscription
  const callerRole = (request.auth.token as any).role;
  if (callerRole === "paid" || callerRole === "admin") {
    throw new HttpsError(
      "already-exists",
      "You already have an active subscription. Manage it from your account settings.",
    );
  }

  if (plan !== "monthly" && plan !== "annual") {
    throw new HttpsError(
      "invalid-argument",
      'Plan must be "monthly" or "annual".',
    );
  }

  // 2. Look up or create Stripe customer
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();
  const hasUsedTrial = !!userData?.hasUsedTrial;
  const stripeCustomerId = await resolveStripeCustomer(
    stripe,
    uid,
    email,
    userData?.stripeCustomerId,
  );

  // 3. Choose the correct price ID (prefer Firestore config, fallback to env vars)
  let priceId: string;
  const pricingSnap = await db.collection("config").doc("pricing").get();
  const pricingData = pricingSnap.data();
  if (plan === "monthly") {
    priceId =
      pricingData?.monthlyPriceId ?? process.env.STRIPE_MONTHLY_PRICE_ID!;
  } else {
    priceId = pricingData?.annualPriceId ?? process.env.STRIPE_ANNUAL_PRICE_ID!;
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "https://dealecho.io";

  // 4. Create the Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/pricing?checkout=success`,
    cancel_url: `${frontendUrl}/pricing?checkout=cancelled`,
    metadata: { firebaseUID: uid, plan },
    subscription_data: {
      metadata: { firebaseUID: uid, plan },
      ...(!hasUsedTrial ? { trial_period_days: 30 } : {}),
    },
  });

  return { sessionUrl: session.url };
});

/**
 * Cancels the authenticated user's active Stripe subscription.
 * Downgrades the user to free role/tier immediately.
 */
export const cancelSubscription = onCall(
  { cors: true, invoker: "public" },
  async (request) => {
    const stripe = getStripe();

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to cancel your subscription.",
      );
    }

    const uid = request.auth.uid;

    // Look up the user's subscription from Firestore
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (!userData?.subscriptionId) {
      throw new HttpsError(
        "not-found",
        "No active subscription found for your account.",
      );
    }

    try {
      // Cancel the subscription immediately in Stripe
      await stripe.subscriptions.cancel(userData.subscriptionId);
    } catch (err: any) {
      // If subscription is already cancelled/invalid in Stripe, proceed to clean up locally
      if (err.code !== "resource_missing") {
        throw new HttpsError(
          "internal",
          err.message || "Failed to cancel subscription with Stripe.",
        );
      }
    }

    // Update Firestore to free
    await userRef.set(
      {
        role: "free",
        tier: "free",
        subscriptionStatus: "cancelled",
        subscriptionId: null,
        currentPeriodEnd: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Update Firebase custom claims
    const { auth: adminAuth } = await import("./lib/firebaseAdmin");
    await adminAuth.setCustomUserClaims(uid, { role: "free", tier: "free" });

    // Anonymize all reviews by this user
    const reviewsSnap = await db
      .collection("reviews")
      .where("userId", "==", uid)
      .get();
    const batch = db.batch();
    reviewsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { userName: "Anonymous" });
    });
    if (!reviewsSnap.empty) {
      await batch.commit();
    }

    return { success: true };
  },
);

/**
 * Creates a Stripe Billing Portal session so the user can manage their
 * payment method, view invoices, and update/cancel their subscription.
 * Returns a portalUrl — the frontend redirects to it.
 */
export const createBillingPortalSession = onCall({ cors: true }, async (request) => {
  const stripe = getStripe();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to manage billing.');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email ?? '';

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data();
  const stripeCustomerId = await resolveStripeCustomer(
    stripe,
    uid,
    email,
    userData?.stripeCustomerId,
  );

  const frontendUrl = process.env.FRONTEND_URL ?? 'https://dealecho.io';

  const portal = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${frontendUrl}/control-centre`,
  });

  return { portalUrl: portal.url };
});

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

  const userSnap = await db.collection('users').doc(uid).get();
  const userData = userSnap.data();
  const stripeCustomerId = await resolveStripeCustomer(
    stripe,
    uid,
    email,
    userData?.stripeCustomerId,
  );

  const pricingSnap = await db.collection('config').doc('pricing').get();
  const pricingData = pricingSnap.data();
  const priceId: string =
    pricingData?.enterprisePriceId ?? process.env.STRIPE_ENTERPRISE_PRICE_ID!;

  if (!priceId) {
    throw new HttpsError('internal', 'Enterprise price not configured.');
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'https://dealecho.io';

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
    },
  });

  return { sessionUrl: session.url };
});
