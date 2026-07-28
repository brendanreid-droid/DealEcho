import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as React from "react";
import { db, auth } from "../lib/firebaseAdmin";
import { sendReactEmail } from "../lib/email";
import { ReferralInviteEmail } from "../emails/ReferralInviteEmail";
import {
  MAX_EMAILS_PER_CALL,
  DAILY_INVITE_LIMIT,
  REWARD_CAP_PER_YEAR,
  REWARD_WINDOW_MS,
  generateInviteToken,
  normaliseEmail,
  isValidEmail,
  expiryFor,
  isInviteExpired,
  dayKeyFor,
  nextQuotaState,
  type QuotaState,
} from "./logic";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://dealecho.io";

export type InviteResult =
  | "sent"
  | "already_member"
  | "already_invited"
  | "invalid"
  | "self"
  | "rate_limited"
  | "send_failed";

function assertPaid(request: { auth?: { token?: unknown } | null }): void {
  const role = (request.auth?.token as any)?.role;
  if (role !== "paid" && role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Referrals are a Sales Pro benefit. Upgrade to invite colleagues.",
    );
  }
}

/** Feature flag. A missing flag means enabled. */
async function referralsEnabled(): Promise<boolean> {
  const snap = await db.collection("config").doc("features").get();
  return snap.data()?.referralsEnabled !== false;
}

/** True when this address already has a Dealecho account. */
async function emailIsRegistered(email: string): Promise<boolean> {
  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") return false;
    throw err;
  }
}

export const sendReferralInvites = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
    assertPaid(request);

    if (!(await referralsEnabled())) {
      throw new HttpsError("failed-precondition", "Referrals aren't available yet.");
    }

    const uid = request.auth.uid;
    const callerEmail = normaliseEmail(request.auth.token.email ?? "");

    const rawEmails: unknown = request.data?.emails;
    if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
      throw new HttpsError("invalid-argument", "Provide at least one email address.");
    }
    if (rawEmails.length > MAX_EMAILS_PER_CALL) {
      throw new HttpsError(
        "invalid-argument",
        `You can invite up to ${MAX_EMAILS_PER_CALL} people at a time.`,
      );
    }

    // 1. Validate and de-duplicate before spending any quota.
    const results: Array<{ email: string; result: InviteResult }> = [];
    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawEmails) {
      const email = normaliseEmail(raw as string);
      if (!isValidEmail(email)) {
        results.push({ email: String(raw).slice(0, 120), result: "invalid" });
        continue;
      }
      if (email === callerEmail) {
        results.push({ email, result: "self" });
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);

      if (await emailIsRegistered(email)) {
        results.push({ email, result: "already_member" });
        continue;
      }

      const existing = await db
        .collection("referral_invites")
        .where("referrerUid", "==", uid)
        .where("email", "==", email)
        .where("status", "==", "sent")
        .limit(1)
        .get();
      if (!existing.empty) {
        results.push({ email, result: "already_invited" });
        continue;
      }

      candidates.push(email);
    }

    if (candidates.length === 0) return { results };

    // 2. Reserve quota atomically. Counting documents cannot be made safe
    //    against concurrent calls; a transactional counter can.
    const quotaRef = db.collection("referral_quota").doc(uid);
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(quotaRef);
      const prior = snap.exists ? (snap.data() as QuotaState) : undefined;
      const { allowed, state } = nextQuotaState(prior, candidates.length, new Date());
      if (allowed > 0) tx.set(quotaRef, state, { merge: true });
      return allowed;
    });

    for (const email of candidates.slice(allowed)) {
      results.push({ email, result: "rate_limited" });
    }

    // 3. Create invites and send.
    const referrer = await auth.getUser(uid);
    const referrerName =
      referrer.displayName || referrer.email?.split("@")[0] || "A Dealecho member";

    for (const email of candidates.slice(0, allowed)) {
      const token = generateInviteToken();
      const sentAt = new Date().toISOString();

      await db.collection("referral_invites").doc(token).set({
        token,
        referrerUid: uid,
        email,
        status: "sent",
        sentAt,
        expiresAt: expiryFor(sentAt),
        refereeUid: null,
        signedUpAt: null,
        emailMismatch: false,
        rewardedAt: null,
        rewardAmountCents: null,
        rewardCurrency: null,
        stripeInvoiceId: null,
        capReason: null,
      });

      try {
        await sendReactEmail({
          to: email,
          subject: `${referrerName} invited you to Dealecho`,
          component: React.createElement(ReferralInviteEmail, {
            referrerName,
            inviteUrl: `${FRONTEND_URL}/?invite=${token}`,
            recipientEmail: email,
          }),
        });
        results.push({ email, result: "sent" });
      } catch (err) {
        // Void rather than delete: keeps an audit trail of the attempt, and
        // stops the UI showing an invite that never actually left the building.
        console.error("sendReferralInvites email failed:", (err as Error).message);
        await db.collection("referral_invites").doc(token).update({ status: "void" });
        results.push({ email, result: "send_failed" });
      }
    }

    return { results };
  },
);

/**
 * Binds a signup to an invite. Called immediately after account creation.
 *
 * Every failure path returns { claimed: false } rather than throwing. A bad,
 * expired or already-used token must never be able to break someone's signup.
 */
export const claimReferral = onCall({ cors: true }, async (request) => {
  if (!request.auth) return { claimed: false };

  const uid = request.auth.uid;
  const token = typeof request.data?.token === "string" ? request.data.token : "";
  if (!token || token.length > 64) return { claimed: false };

  const signupEmail = normaliseEmail(request.auth.token.email ?? "");
  const inviteRef = db.collection("referral_invites").doc(token);
  const userRef = db.collection("users").doc(uid);

  try {
    return await db.runTransaction(async (tx) => {
      // Firestore requires every read in a transaction to happen before any
      // write, so all three gets are done up front even though some paths
      // below return without needing the referrer.
      const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);

      if (!inviteSnap.exists) return { claimed: false };
      const invite = inviteSnap.data() as any;
      if (invite.status !== "sent") return { claimed: false };

      const user = userSnap.data() ?? {};
      const referrerSnap = await tx.get(db.collection("users").doc(invite.referrerUid));

      // ---- reads complete; writes below ----

      if (isInviteExpired(invite, new Date())) {
        tx.update(inviteRef, { status: "expired" });
        return { claimed: false };
      }

      // Self-referral.
      if (invite.referrerUid === uid) return { claimed: false };

      // Write-once: a user can only ever be attributed to one referrer.
      if (user.referredByToken) return { claimed: false };

      // Never retro-attribute someone who is already, or has already been, a
      // paying customer. Without this an existing member could be handed a
      // token and manufacture a reward.
      if (user.role === "paid" || user.hasUsedTrial) return { claimed: false };

      // The referrer must still be a paying member for the reward to mean
      // anything. If they have churned, retire the invite.
      // Mirror assertPaid: admins can send invites, so admins must be able to
      // receive the reward too. Checking only for "paid" here would silently
      // void every invite an admin sent, which is exactly the account the
      // rollout plan uses to verify the feature end to end.
      const referrerRole = referrerSnap.data()?.role;
      if (referrerRole !== "paid" && referrerRole !== "admin") {
        tx.update(inviteRef, { status: "void" });
        return { claimed: false };
      }

      tx.update(inviteRef, {
        status: "signed_up",
        refereeUid: uid,
        signedUpAt: new Date().toISOString(),
        // Recorded, not blocked: work-vs-personal address splits are common and
        // the payment gate is doing the real anti-fraud work.
        emailMismatch: !!signupEmail && signupEmail !== invite.email,
      });

      tx.set(userRef, { referredByToken: token }, { merge: true });

      return { claimed: true };
    });
  } catch (err) {
    console.error("claimReferral failed:", (err as Error).message);
    return { claimed: false };
  }
});

/**
 * Everything the /referrals page needs, in one round trip. The client never
 * reads referral_invites directly - the collection is closed to all clients so
 * tokens cannot be enumerated.
 */
export const getReferralStatus = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");

  const uid = request.auth.uid;
  const role = (request.auth.token as any).role;
  const eligible = (role === "paid" || role === "admin") && (await referralsEnabled());

  const snap = await db
    .collection("referral_invites")
    .where("referrerUid", "==", uid)
    .orderBy("sentAt", "desc")
    .limit(100)
    .get();

  const invites = snap.docs.map((d) => {
    const v = d.data();
    return {
      email: v.email as string,
      status: v.status as string,
      sentAt: v.sentAt as string,
      rewardedAt: (v.rewardedAt ?? null) as string | null,
    };
  });

  const counts = {
    sent: invites.filter((i) => i.status === "sent").length,
    signedUp: invites.filter((i) => i.status === "signed_up").length,
    rewarded: invites.filter((i) => i.status === "rewarded").length,
  };

  // referral_rewards is the authoritative cap ledger: grantReferralCredit
  // reserves a slot there inside the same transaction that claims the invite.
  // Counting rewarded invites here instead would drift from what the payout
  // path actually enforces.
  const cutoffMs = Date.now() - REWARD_WINDOW_MS;
  const rewardsSnap = await db.collection("referral_rewards").doc(uid).get();
  const grantedAt: string[] = rewardsSnap.data()?.grantedAt ?? [];
  const usedThisYear = grantedAt.filter((iso) => {
    const ms = Date.parse(iso);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  }).length;

  const quotaSnap = await db.collection("referral_quota").doc(uid).get();
  const quota = quotaSnap.exists ? (quotaSnap.data() as QuotaState) : undefined;
  const sameDay = quota?.dayKey === dayKeyFor(new Date());
  const quotaRemainingToday = Math.max(
    0,
    DAILY_INVITE_LIMIT - (sameDay ? (quota?.sentToday ?? 0) : 0),
  );

  return {
    eligible,
    invites,
    counts,
    monthsEarned: usedThisYear,
    cap: {
      limit: REWARD_CAP_PER_YEAR,
      usedThisYear,
      remaining: Math.max(0, REWARD_CAP_PER_YEAR - usedThisYear),
    },
    quotaRemainingToday,
  };
});
