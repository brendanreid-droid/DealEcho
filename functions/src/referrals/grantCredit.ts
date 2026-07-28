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

/**
 * Grants the referrer one month of Stripe balance credit for a referee whose
 * first real payment just succeeded.
 *
 * Two hazards drive the structure here.
 *
 * Idempotency: Stripe delivers webhooks at least once. A Firestore transaction
 * owns the signed_up -> rewarding transition, so only the caller that wins that
 * transition reaches Stripe. Crucially, once the Stripe call has returned we
 * NEVER put the invite back into a payable state - see the catch below. The
 * Stripe idempotency key is a second line of defence only: Stripe discards
 * those keys after 24 hours, so it cannot protect against a re-attempt on the
 * next billing cycle a month later.
 *
 * The cap: the 12-per-year limit is reserved inside the same transaction that
 * claims the invite, against a per-referrer counter document. Counting rewarded
 * invites with a plain query would let two payouts for the same referrer land
 * concurrently, both read the same count, and both grant.
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

  // Claim the invite AND reserve a cap slot in one transaction. Both the invite
  // and the referrer's counter are written here, so two concurrent payouts for
  // the same referrer serialise on the counter document and cannot both pass a
  // cap check that only one of them should pass.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    const data = snap.data() as any;
    if (data?.status !== "signed_up") return null;

    const rewardsRef = db.collection("referral_rewards").doc(data.referrerUid);
    const rewardsSnap = await tx.get(rewardsRef);

    const cutoff = Date.now() - REWARD_WINDOW_MS;
    const prior: string[] = rewardsSnap.data()?.grantedAt ?? [];
    const inWindow = prior.filter((iso) => {
      const ms = Date.parse(iso);
      return !Number.isNaN(ms) && ms >= cutoff;
    });

    if (isCapReached(inWindow.length)) {
      tx.update(inviteRef, { status: "capped", capReason: "annual_limit" });
      return { capped: true } as const;
    }

    tx.update(inviteRef, { status: "rewarding" });
    // Pruned on every write, so the array stays bounded by the annual cap.
    tx.set(
      rewardsRef,
      { grantedAt: [...inWindow, new Date().toISOString()] },
      { merge: true },
    );
    return { capped: false, invite: data } as const;
  });

  if (!claimed || claimed.capped) return;

  const invite = claimed.invite;
  const referrerUid: string = invite.referrerUid;
  const rewardsRef = db.collection("referral_rewards").doc(referrerUid);

  /**
   * Hands the reserved cap slot back when a payout aborts before paying.
   * Drops the newest entry rather than matching our own timestamp: under
   * concurrency that may not be the exact one we added, but the count is what
   * the cap is made of, and the count comes out right either way.
   */
  const releaseCapSlot = async () => {
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rewardsRef);
        const list: string[] = snap.data()?.grantedAt ?? [];
        if (list.length > 0) {
          tx.set(rewardsRef, { grantedAt: list.slice(0, -1) }, { merge: true });
        }
      });
    } catch (err) {
      console.error("releaseCapSlot failed:", (err as Error).message);
    }
  };

  // True once Stripe has actually moved money. After this point the invite must
  // never return to a payable state, whatever else fails.
  let creditGranted = false;

  try {
    const referrerSnap = await db.collection("users").doc(referrerUid).get();
    const referrerCustomerId = referrerSnap.data()?.stripeCustomerId;
    if (!referrerCustomerId) {
      console.error("grantReferralCredit: referrer has no Stripe customer", referrerUid);
      await inviteRef.update({ status: "void", capReason: "no_stripe_customer" });
      await releaseCapSlot();
      return;
    }

    const stripe = getStripe();
    const price = await monthlyPriceAmount(stripe);
    if (!price) {
      await inviteRef.update({ status: "void", capReason: "no_price_configured" });
      await releaseCapSlot();
      return;
    }

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
    creditGranted = true;

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
            refereeEmail: invite.email,
            recipientEmail: referrer.email,
          }),
        });
      }
    } catch (err) {
      console.error("grantReferralCredit reward email failed:", (err as Error).message);
    }
  } catch (err) {
    if (creditGranted) {
      // The money has already moved. Returning the invite to "signed_up" would
      // make it payable again, and the Stripe idempotency key expires after 24
      // hours - so the referee's next monthly invoice would credit a second
      // time. Leave it in "rewarding" instead: not payable, and visible for
      // reconciliation. Swallow the error so Stripe does not retry the payout.
      console.error(
        `grantReferralCredit: CREDIT GRANTED BUT NOT FINALISED for invite ${token} ` +
          `(referrer ${referrerUid}). Needs manual reconciliation.`,
        (err as Error).message,
      );
      try {
        await inviteRef.update({
          status: "rewarded",
          rewardedAt: new Date().toISOString(),
          stripeInvoiceId: invoice.id,
          needsReconciliation: true,
        });
      } catch (inner) {
        console.error(
          "grantReferralCredit: could not finalise after granting credit:",
          (inner as Error).message,
        );
      }
      return;
    }

    // Nothing was paid, so it is safe to make the invite payable again and let
    // the webhook retry. Give the reserved cap slot back too.
    console.error("grantReferralCredit failed before payment:", (err as Error).message);
    await inviteRef.update({ status: "signed_up" });
    await releaseCapSlot();
    throw err;
  }
}
