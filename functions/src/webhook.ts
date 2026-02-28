import { onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { getStripe } from "./lib/stripe";
import { db, auth } from "./lib/firebaseAdmin";

type UserRole = "free" | "paid" | "admin";
type UserTier = "free" | "paid_monthly" | "paid_annual";

/**
 * Maps Stripe subscription status + interval to our role/tier model.
 */
function resolveRoleTier(
  status: Stripe.Subscription.Status,
  interval: string,
): { role: UserRole; tier: UserTier } {
  if (status === "active" || status === "trialing") {
    return {
      role: "paid",
      tier: interval === "year" ? "paid_annual" : "paid_monthly",
    };
  }
  return { role: "free", tier: "free" };
}

/**
 * Retrieves the Firebase UID from a Stripe subscription.
 * First tries subscription metadata, then customer metadata, then Firestore lookup.
 */
/**
 * Retrieves the Firebase UID from a Stripe subscription.
 */
async function resolveFirebaseUID(
  subscription: Stripe.Subscription,
  debugRef?: any,
): Promise<string | null> {
  const stripe = getStripe();

  // 1. Try subscription metadata
  if (subscription.metadata?.firebaseUID) {
    if (debugRef)
      await debugRef.update({
        resolutionPath: "subscription_metadata",
        resolvedUid: subscription.metadata.firebaseUID,
      });
    return subscription.metadata.firebaseUID;
  }

  // 2. Try customer metadata
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  try {
    const customer = (await stripe.customers.retrieve(
      customerId,
    )) as Stripe.Customer;
    if (!customer.deleted && customer.metadata?.firebaseUID) {
      if (debugRef)
        await debugRef.update({
          resolutionPath: "customer_metadata",
          resolvedUid: customer.metadata.firebaseUID,
        });
      return customer.metadata.firebaseUID;
    }
  } catch (e) {
    if (debugRef)
      await debugRef.update({ customerRetrieveError: (e as Error).message });
  }

  // 3. Fallback: query Firestore
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (!snap.empty) {
    if (debugRef)
      await debugRef.update({
        resolutionPath: "firestore_lookup",
        resolvedUid: snap.docs[0].id,
      });
    return snap.docs[0].id;
  }

  if (debugRef) await debugRef.update({ resolutionPath: "failed", customerId });
  return null;
}

/**
 * Stripe webhook endpoint.
 */
export const stripeWebhook = onRequest(
  {
    cors: false,
    secrets: ["STRIPE_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    console.log("--- WEBHOOK INVOCATION START ---");
    console.log("Method:", req.method);
    console.log("Content-Type:", req.headers["content-type"]);
    const debugId = `debug_${Date.now()}`;

    try {
      const stripe = getStripe();
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!.trim();

      // Get the raw body - Firebase Functions v2 provides rawBody,
      // but fall back to req.body if it's a Buffer
      const rawBody =
        req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);

      // 1. Log immediately to track if request even reached the function
      const debugRef = db.collection("webhooks_debug").doc(debugId);
      await debugRef.set({
        startTime: new Date().toISOString(),
        status: "received",
        method: req.method,
        contentType: req.headers["content-type"] || "missing",
        hasSignature: !!sig,
        hasRawBody: !!req.rawBody,
        hasBody: !!req.body,
        hasResolvedBody: !!rawBody,
        bodyType: typeof req.body,
        isBufferBody: Buffer.isBuffer(req.body),
        webhookSecretSet: !!webhookSecret,
      });

      console.log("Signature Header:", !!sig);
      console.log(
        "rawBody:",
        !!req.rawBody,
        "body:",
        !!req.body,
        "resolvedBody:",
        !!rawBody,
      );

      if (!sig || !rawBody) {
        console.error("Missing signature or rawBody");
        await debugRef.update({
          status: "error",
          error: `Missing signature (${!!sig}) or rawBody (${!!rawBody})`,
          allHeaders: JSON.stringify(req.headers),
        });
        res.status(400).send("Missing signature or rawBody");
        return;
      }

      if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is missing");
        await debugRef.update({
          status: "error",
          error: "Server configuration error: missing secret",
        });
        throw new Error("STRIPE_WEBHOOK_SECRET is missing in environment");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        console.log("Event verified:", event.type);
        await debugRef.update({
          status: "verified",
          eventType: event.type,
          eventId: event.id,
        });
      } catch (err: any) {
        console.error("Signature verification failed:", err.message);
        await debugRef.update({
          status: "verification_failed",
          error: err.message,
        });
        res.status(400).send(`Webhook Signature Error: ${err.message}`);
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log("Processing checkout.session.completed", session.id);
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string,
            );
            await handleSubscriptionChange(subscription, debugRef);
          } else {
            console.warn("No subscription found in checkout session");
            await debugRef.update({ warning: "no_subscription_in_session" });
          }
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionChange(subscription, debugRef);
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(subscription, debugRef);
          break;
        }
        default:
          console.log("Unhandled event type:", event.type);
      }

      await debugRef.update({
        status: "success",
        completedAt: new Date().toISOString(),
      });

      console.log("--- WEBHOOK SUCCESS ---");
      res.json({ received: true });
    } catch (err: any) {
      console.error("FATAL Webhook error:", err.message);
      try {
        await db.collection("webhooks_debug").doc(debugId).set(
          {
            status: "fatal_error",
            error: err.message,
            time: new Date().toISOString(),
          },
          { merge: true },
        );
      } catch (inner) {
        console.error("Emergency log failed:", (inner as Error).message);
      }
      res.status(500).send(`Internal Server Error: ${err.message}`);
    }
  },
);

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  debugRef?: any,
) {
  console.log("Handling subscription change:", subscription.id);
  const uid = await resolveFirebaseUID(subscription, debugRef);
  if (!uid) {
    console.error(
      "Failed to resolve Firebase UID for subscription:",
      subscription.id,
    );
    if (debugRef)
      await debugRef.update({
        handleSubError: "uid_not_found",
        customerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
      });
    return;
  }

  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring?.interval ?? "month";
  const { role, tier } = resolveRoleTier(subscription.status, interval);

  console.log(`Resolved Role/Tier: ${role}/${tier} for UID: ${uid}`);
  if (debugRef)
    await debugRef.update({
      role,
      tier,
      subStatus: subscription.status,
      resolvedUid: uid,
    });

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Update Firestore user doc
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        role,
        tier,
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  // Set Firebase Custom Claims
  await auth.setCustomUserClaims(uid, { role, tier });

  // If user is now paid, restore their real name on all their reviews
  if (role === "paid") {
    try {
      const userRecord = await auth.getUser(uid);
      const realName =
        userRecord.displayName || userRecord.email?.split("@")[0] || "User";
      const reviewsSnap = await db
        .collection("reviews")
        .where("userId", "==", uid)
        .get();
      if (!reviewsSnap.empty) {
        const batch = db.batch();
        reviewsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, { userName: realName });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Failed to restore review names:", (e as Error).message);
    }
  }

  if (debugRef)
    await debugRef.update({ result: "firestore_and_claims_updated" });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  debugRef?: any,
) {
  const uid = await resolveFirebaseUID(subscription, debugRef);
  if (!uid) return;

  await db.collection("users").doc(uid).set(
    {
      role: "free",
      tier: "free",
      subscriptionStatus: "cancelled",
      currentPeriodEnd: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await auth.setCustomUserClaims(uid, { role: "free", tier: "free" });

  // Anonymize all reviews by this user
  const reviewsSnap = await db
    .collection("reviews")
    .where("userId", "==", uid)
    .get();
  if (!reviewsSnap.empty) {
    const batch = db.batch();
    reviewsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { userName: "Anonymous" });
    });
    await batch.commit();
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  console.warn(
    `Payment failed for customer ${customerId}, invoice ${invoice.id}`,
  );
}

/**
 * Temporary diagnostic endpoint to view webhook logs.
 */
export const getWebhookDebugLogs = onRequest(
  { cors: true },
  async (req, res) => {
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
