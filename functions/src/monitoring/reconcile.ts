import { onCall, HttpsError } from "firebase-functions/v2/https";
import type Stripe from "stripe";
import { db, auth } from "../lib/firebaseAdmin";
import { getStripe } from "../lib/stripe";

/**
 * Reconciles Stripe subscriptions against Firestore access.
 *
 * Needed because the webhook endpoint was deleted on 26 May 2026 and not
 * replaced until 28 July. For that whole window no subscription events were
 * delivered, so anyone who subscribed was charged and left on the free tier,
 * and anyone who cancelled kept Pro access. Stripe only retains events for
 * ~30 days, so the earlier part of that window cannot be replayed - it has to
 * be compared directly against the source of truth, which is Stripe.
 *
 * Dry run by default. Pass { apply: true } to actually write the corrections.
 */

type Discrepancy = {
  subscriptionId: string;
  customerId: string;
  stripeStatus: string;
  uid: string | null;
  email: string | null;
  firestoreRole: string | null;
  expectedRole: "paid" | "free";
  issue:
    | "paid_in_stripe_but_free_here"
    | "cancelled_in_stripe_but_paid_here"
    | "no_matching_user";
};

function expectedRoleFor(status: Stripe.Subscription.Status): "paid" | "free" {
  return status === "active" || status === "trialing" ? "paid" : "free";
}

async function resolveUid(
  sub: Stripe.Subscription,
  customerId: string,
): Promise<string | null> {
  if (sub.metadata?.firebaseUID) return sub.metadata.firebaseUID;
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export const adminReconcileSubscriptions = onCall(
  { cors: true, timeoutSeconds: 300 },
  async (request) => {
    if ((request.auth?.token as any)?.role !== "admin") {
      throw new HttpsError("permission-denied", "Admins only.");
    }

    const apply = request.data?.apply === true;
    const stripe = getStripe();

    // Walk every subscription, not just recent ones: a subscription created
    // before the outage could still have been cancelled during it.
    const discrepancies: Discrepancy[] = [];
    let scanned = 0;

    for await (const sub of stripe.subscriptions.list({
      status: "all",
      limit: 100,
      expand: ["data.customer"],
    })) {
      scanned++;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (!customerId) continue;

      const uid = await resolveUid(sub, customerId);
      const expectedRole = expectedRoleFor(sub.status);

      if (!uid) {
        // Only worth reporting if they are meant to have access.
        if (expectedRole === "paid") {
          discrepancies.push({
            subscriptionId: sub.id,
            customerId,
            stripeStatus: sub.status,
            uid: null,
            email: null,
            firestoreRole: null,
            expectedRole,
            issue: "no_matching_user",
          });
        }
        continue;
      }

      const userSnap = await db.collection("users").doc(uid).get();
      const firestoreRole = (userSnap.data()?.role as string) ?? null;

      // Admins are granted access out of band; never downgrade them.
      if (firestoreRole === "admin") continue;

      const actuallyPaid = firestoreRole === "paid";
      const shouldBePaid = expectedRole === "paid";
      if (actuallyPaid === shouldBePaid) continue;

      let email: string | null = null;
      try {
        email = (await auth.getUser(uid)).email ?? null;
      } catch {
        /* deleted auth user; uid is still useful */
      }

      discrepancies.push({
        subscriptionId: sub.id,
        customerId,
        stripeStatus: sub.status,
        uid,
        email,
        firestoreRole,
        expectedRole,
        issue: shouldBePaid
          ? "paid_in_stripe_but_free_here"
          : "cancelled_in_stripe_but_paid_here",
      });
    }

    if (!apply) {
      return { dryRun: true, scanned, discrepancies };
    }

    // Applying: bring Firestore and custom claims in line with Stripe.
    const applied: string[] = [];
    for (const d of discrepancies) {
      if (!d.uid) continue;
      const tier =
        d.expectedRole === "paid" ? "paid_monthly" : "free";
      await db.collection("users").doc(d.uid).set(
        {
          role: d.expectedRole,
          tier,
          subscriptionId: d.expectedRole === "paid" ? d.subscriptionId : null,
          subscriptionStatus: d.stripeStatus,
          updatedAt: new Date().toISOString(),
          reconciledAt: new Date().toISOString(),
        },
        { merge: true },
      );
      await auth.setCustomUserClaims(d.uid, {
        role: d.expectedRole,
        tier,
      });
      applied.push(d.uid);
    }

    return { dryRun: false, scanned, discrepancies, applied };
  },
);
