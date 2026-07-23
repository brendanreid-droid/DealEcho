import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStripe } from "./lib/stripe";
import { db } from "./lib/firebaseAdmin";

type Plan = "monthly" | "annual";

// A retention offer can only be redeemed once per this window, so users can't
// repeatedly threaten to cancel to farm discounts.
const RETENTION_COOLDOWN_MS = 365 * 24 * 60 * 60 * 1000; // 12 months

function isActivePaid(role: unknown, tier: unknown): boolean {
  return (
    role === "paid" ||
    role === "enterprise" ||
    tier === "paid_monthly" ||
    tier === "paid_annual" ||
    tier === "enterprise"
  );
}

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

    // Capture cancellation feedback (reason + free text) for retention
    // analytics before we tear the subscription down. Best-effort: never let a
    // feedback write block the cancellation the user asked for.
    try {
      const reason = request.data?.reason;
      const reasonText = request.data?.reasonText;
      const cleanReason =
        typeof reason === "string" ? reason.slice(0, 60) : "";
      const cleanText =
        typeof reasonText === "string" ? reasonText.slice(0, 1000) : "";
      if (cleanReason || cleanText) {
        await db.collection("cancellation_feedback").add({
          uid,
          reason: cleanReason,
          reasonText: cleanText,
          tier: request.data?.tier ?? "",
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Failed to record cancellation feedback:", err);
    }

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
 * Retention save-offer. Applies a Stripe coupon to the caller's live
 * subscription instead of cancelling:
 *   - "monthly_discount": apply a coupon (e.g. 50% off for 2 months) to the
 *     current subscription.
 *   - "annual_discount": switch the subscription to the annual price AND apply
 *     an annual coupon (e.g. 20% off).
 *
 * Coupon and price IDs live in the server-only Firestore doc
 * `private_config/retention` (never exposed to the client), with env fallbacks:
 *   { monthlyCouponId, annualCouponId, annualPriceId }
 *
 * The user triggers this from their own account; we never move money on our
 * own initiative. Returns { success, offer } for the UI to confirm.
 */
export const applyRetentionOffer = onCall(
  { cors: true, invoker: "public" },
  async (request) => {
    const stripe = getStripe();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const uid = request.auth.uid;

    const offer = request.data?.offer;
    if (offer !== "monthly_discount" && offer !== "annual_discount") {
      throw new HttpsError("invalid-argument", "Unknown retention offer.");
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    // Guard 1: paid accounts only. Free users have no subscription to discount.
    if (!isActivePaid(userData?.role, userData?.tier)) {
      throw new HttpsError(
        "failed-precondition",
        "Retention offers are only available on a paid plan.",
      );
    }

    // Guard 2: one redemption per cooldown window, so cancelling can't be used
    // to farm repeat discounts.
    const prevAcceptedAt = userData?.retentionOffer?.acceptedAt;
    if (typeof prevAcceptedAt === "string") {
      const prevMs = new Date(prevAcceptedAt).getTime();
      if (!isNaN(prevMs) && Date.now() - prevMs < RETENTION_COOLDOWN_MS) {
        throw new HttpsError(
          "failed-precondition",
          "You've already redeemed a retention offer. This offer isn't available again yet.",
        );
      }
    }

    if (!userData?.subscriptionId) {
      throw new HttpsError(
        "not-found",
        "No active subscription found for your account.",
      );
    }

    // Load retention config (server-only doc; Admin SDK bypasses rules).
    const cfgSnap = await db.collection("private_config").doc("retention").get();
    const cfg = cfgSnap.data() ?? {};
    const monthlyCouponId: string | undefined =
      cfg.monthlyCouponId ?? process.env.STRIPE_RETENTION_MONTHLY_COUPON;
    const annualCouponId: string | undefined =
      cfg.annualCouponId ?? process.env.STRIPE_RETENTION_ANNUAL_COUPON;
    const annualPriceId: string | undefined =
      cfg.annualPriceId ?? process.env.STRIPE_ANNUAL_PRICE_ID;

    try {
      if (offer === "monthly_discount") {
        if (!monthlyCouponId) {
          throw new HttpsError(
            "failed-precondition",
            "This offer isn't available right now.",
          );
        }
        await stripe.subscriptions.update(userData.subscriptionId, {
          coupon: monthlyCouponId,
        });
      } else {
        // annual_discount: move to the annual price and apply the annual coupon.
        if (!annualCouponId || !annualPriceId) {
          throw new HttpsError(
            "failed-precondition",
            "This offer isn't available right now.",
          );
        }
        const sub = await stripe.subscriptions.retrieve(
          userData.subscriptionId,
        );
        const itemId = sub.items.data[0]?.id;
        if (!itemId) {
          throw new HttpsError("internal", "Subscription item not found.");
        }
        await stripe.subscriptions.update(userData.subscriptionId, {
          items: [{ id: itemId, price: annualPriceId }],
          coupon: annualCouponId,
          proration_behavior: "create_prorations",
        });
      }
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        "internal",
        err.message || "Failed to apply the offer. Please try again.",
      );
    }

    // Record acceptance for retention analytics; keep the user Pro.
    await userRef.set(
      {
        retentionOffer: {
          offer,
          acceptedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return { success: true, offer };
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
