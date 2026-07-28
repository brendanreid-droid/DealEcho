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
