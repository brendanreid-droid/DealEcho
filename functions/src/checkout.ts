import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStripe } from "./lib/stripe";
import { db } from "./lib/firebaseAdmin";

type Plan = "monthly" | "annual";

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
  let stripeCustomerId: string | undefined = userSnap.data()?.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { firebaseUID: uid },
    });
    stripeCustomerId = customer.id;
    // Persist immediately so concurrent calls don't create duplicates
    await userRef.set({ stripeCustomerId }, { merge: true });
  }

  // 3. Choose the correct price ID
  const priceId =
    plan === "monthly"
      ? process.env.STRIPE_MONTHLY_PRICE_ID!
      : process.env.STRIPE_ANNUAL_PRICE_ID!;

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  // 4. Create the Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/#/pricing?checkout=success`,
    cancel_url: `${frontendUrl}/#/pricing?checkout=cancelled`,
    metadata: { firebaseUID: uid, plan },
    subscription_data: {
      metadata: { firebaseUID: uid, plan },
    },
  });

  return { sessionUrl: session.url };
});
