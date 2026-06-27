import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { db, auth } from "./lib/firebaseAdmin";
import { sendReactEmail } from "./lib/email";
import * as React from "react";
import { InviteEmail } from "./emails/InviteEmail";
import { NewsletterEmail } from "./emails/NewsletterEmail";

type UserRole = "free" | "paid" | "admin" | "free_full" | "enterprise";

/** Guard: ensures caller has admin custom claim */
function requireAdmin(request: CallableRequest<any>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  // Custom claims are on the token. Cast to any for the compiler.
  if ((request.auth.token as any).role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

// ── adminGetUsers ─────────────────────────────────────────────────────────────
/**
 * Lists all Firebase Auth users merged with their Firestore profile.
 * Admin only. Returns up to 1000 users (pagination can be added as needed).
 */
export const adminGetUsers = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  // List all Firebase Auth users
  const listResult = await auth.listUsers(1000);

  // Batch fetch Firestore user docs for extra data (role, tier, subscription)
  const uids = listResult.users.map((u) => u.uid);
  const firestoreDocs = await Promise.all(
    uids.map((uid) => db.collection("users").doc(uid).get()),
  );

  const firestoreMap: Record<string, FirebaseFirestore.DocumentData> = {};
  firestoreDocs.forEach((snap) => {
    if (snap.exists) firestoreMap[snap.id] = snap.data()!;
  });

  return {
    users: listResult.users.map((u) => {
      const fs = firestoreMap[u.uid] ?? {};
      return {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName ?? "",
        createdAt: u.metadata.creationTime,
        // Prefer Firestore (written by both webhook & adminSetRole) over claims
        role:
          (fs.role as UserRole) ?? (u.customClaims?.role as UserRole) ?? "free",
        tier: (fs.tier as string) ?? (u.customClaims?.tier as string) ?? "free",
        subscriptionStatus: fs.subscriptionStatus ?? null,
        currentPeriodEnd: fs.currentPeriodEnd ?? null,
        suspended: u.disabled ?? fs.suspended ?? false,
      };
    }),
  };
});

// ── adminSetRole ──────────────────────────────────────────────────────────────
/**
 * Sets a user's role custom claim and Firestore role field.
 * Admin only. Prevents self-demotion from admin.
 */
export const adminSetRole = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { targetUid, role } = request.data as {
    targetUid: string;
    role: UserRole;
  };

  if (!targetUid || !role) {
    throw new HttpsError(
      "invalid-argument",
      "targetUid and role are required.",
    );
  }
  if (!["free", "paid", "admin", "free_full"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be free, paid, admin, or free_full.",
    );
  }

  // Prevent admin from removing their own admin status via the panel
  if (targetUid === request.auth!.uid && role !== "admin") {
    throw new HttpsError(
      "failed-precondition",
      "You cannot remove your own admin status.",
    );
  }

  const tier =
    role === "paid" ? "paid_monthly" : role === "admin" ? "admin" : role === "free_full" ? "free_full" : "free";

  // Derive subscriptionStatus so the admin panel stays consistent
  const subscriptionStatus =
    role === "paid" ? "active" : role === "admin" ? null : role === "free_full" ? "free_full" : null;

  // Set custom claim (authoritative)
  await auth.setCustomUserClaims(targetUid, { role, tier });

  // Update Firestore (readable cache) — include subscriptionStatus
  await db
    .collection("users")
    .doc(targetUid)
    .set(
      { role, tier, subscriptionStatus, updatedAt: new Date().toISOString() },
      { merge: true },
    );

  return { success: true, uid: targetUid, role, tier, subscriptionStatus };
});

// ── adminDeleteContent ────────────────────────────────────────────────────────
/**
 * Deletes a review document. Admin only.
 */
export const adminDeleteContent = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { reviewId } = request.data as { reviewId: string };
  if (!reviewId) {
    throw new HttpsError("invalid-argument", "reviewId is required.");
  }

  await db.collection("reviews").doc(reviewId).delete();
  return { success: true, deletedId: reviewId };
});

// ── adminEditContent ──────────────────────────────────────────────────────────
/**
 * Updates allowed fields on a review document. Admin only.
 */
export const adminEditContent = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { reviewId, updates } = request.data as {
    reviewId: string;
    updates: { content?: string; rating?: number };
  };

  if (!reviewId || !updates) {
    throw new HttpsError(
      "invalid-argument",
      "reviewId and updates are required.",
    );
  }

  // Whitelist editable fields — never allow overwriting userId, companyId, etc.
  const allowed: Record<string, unknown> = {};
  if (typeof updates.content === "string") allowed.content = updates.content;
  if (typeof updates.rating === "number") allowed.rating = updates.rating;
  allowed.editedByAdmin = true;
  allowed.editedAt = new Date().toISOString();

  await db.collection("reviews").doc(reviewId).update(allowed);
  return { success: true, reviewId };
});

// ── adminGetPricing ───────────────────────────────────────────────────────────
/**
 * Returns the current pricing configuration from Firestore.
 * Admin only.
 */
export const adminGetPricing = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const snap = await db.collection("config").doc("pricing").get();
  if (!snap.exists) {
    // Return defaults from env vars if no Firestore config exists yet
    return {
      monthlyAmount: 1500,
      annualAmount: 14400,
      currency: "aud",
      monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID ?? null,
      annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID ?? null,
      stripeProductId: null,
    };
  }
  return snap.data();
});

// ── adminUpdatePricing ────────────────────────────────────────────────────────
/**
 * Creates new Stripe Price objects and stores them in Firestore.
 * Admin only. Accepts monthlyAmount and annualAmount in cents.
 */
export const adminUpdatePricing = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { monthlyAmount, annualAmount, currency } = request.data as {
    monthlyAmount: number;
    annualAmount: number;
    currency?: string;
  };

  if (!monthlyAmount || !annualAmount) {
    throw new HttpsError(
      "invalid-argument",
      "monthlyAmount and annualAmount (in cents) are required.",
    );
  }

  if (monthlyAmount < 100 || annualAmount < 100) {
    throw new HttpsError(
      "invalid-argument",
      "Amounts must be at least 100 cents ($1.00).",
    );
  }

  const { getStripe } = await import("./lib/stripe");
  const stripe = getStripe();
  const cur = currency ?? "aud";

  // Find or create the product
  const pricingSnap = await db.collection("config").doc("pricing").get();
  let productId = pricingSnap.data()?.stripeProductId;

  if (!productId) {
    // Try to get product from existing price
    const existingPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    if (existingPriceId) {
      try {
        const existingPrice = await stripe.prices.retrieve(existingPriceId);
        productId =
          typeof existingPrice.product === "string"
            ? existingPrice.product
            : existingPrice.product.id;
      } catch {
        // ignore
      }
    }
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: "Sales Pro Intel",
      description: "DealEcho Sales Pro subscription",
    });
    productId = product.id;
  }

  // Create new monthly price
  const monthlyPrice = await stripe.prices.create({
    unit_amount: monthlyAmount,
    currency: cur,
    recurring: { interval: "month" },
    product: productId,
  });

  // Create new annual price
  const annualPrice = await stripe.prices.create({
    unit_amount: annualAmount,
    currency: cur,
    recurring: { interval: "year" },
    product: productId,
  });

  // Store in Firestore
  const pricingData = {
    monthlyPriceId: monthlyPrice.id,
    annualPriceId: annualPrice.id,
    monthlyAmount,
    annualAmount,
    currency: cur,
    stripeProductId: productId,
    updatedAt: new Date().toISOString(),
    updatedBy: request.auth!.uid,
  };

  await db
    .collection("config")
    .doc("pricing")
    .set(pricingData, { merge: true });

  return { success: true, ...pricingData };
});

// ── adminCreateUser ───────────────────────────────────────────────────────────
/**
 * Manually creates a new user, sets their role/claims, generates a password
 * reset/creation link, and dispatches a brand-aligned InviteEmail.
 * Admin only.
 */
export const adminCreateUser = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    requireAdmin(request);

    const { email, displayName, role } = request.data as {
      email: string;
      displayName: string;
      role: UserRole;
    };

    if (!email || !displayName || !role) {
      throw new HttpsError(
        "invalid-argument",
        "email, displayName, and role are required."
      );
    }

    if (!["free", "paid", "admin", "free_full", "enterprise"].includes(role)) {
      throw new HttpsError(
        "invalid-argument",
        "Role must be free, paid, admin, free_full, or enterprise."
      );
    }

    try {
      // 0. Register in temporary tracking collection to prevent duplicate welcome onboarding triggers
      await db.collection("admin_created_users").doc(email.trim().toLowerCase()).set({
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
      });

      // 1. Create the user in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        displayName,
        emailVerified: true,
      });

      const uid = userRecord.uid;

      // 2. Set custom claims
      const tier =
        role === "paid" ? "paid_monthly" :
        role === "admin" ? "admin" :
        role === "free_full" ? "free_full" :
        role === "enterprise" ? "enterprise" :
        "free";
      // For enterprise, role claim is "paid"; enterprise is expressed via tier
      const firestoreRole = role === "enterprise" ? "paid" : role;
      await auth.setCustomUserClaims(uid, { role: firestoreRole, tier });

      // 3. Create Firestore user document
      const subscriptionStatus =
        role === "paid" || role === "enterprise" ? "active" :
        role === "admin" ? null :
        role === "free_full" ? "free_full" :
        null;

      const userData = {
        uid,
        email,
        displayName,
        role: firestoreRole,
        tier,
        subscriptionStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        suspended: false,
        notificationPreferences: {
          realTimeAlerts: true,
          weeklyDigest: true,
        },
      };

      await db.collection("users").doc(uid).set(userData);

      // 3b. If enterprise, create team and override claims with teamId/teamRole
      if (role === "enterprise") {
        const teamRef = db.collection("teams").doc();
        const teamId = teamRef.id;
        const now = new Date().toISOString();
        await teamRef.set({
          ownerId: uid,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          seats: 5,
          createdAt: now,
        });
        await teamRef.collection("members").doc(uid).set({
          uid,
          email,
          teamRole: "manager",
          status: "active",
          invitedAt: now,
          joinedAt: now,
        });
        await db.collection("users").doc(uid).set(
          { teamId, teamRole: "manager" },
          { merge: true },
        );
        // Override claims with enterprise + team fields
        await auth.setCustomUserClaims(uid, {
          role: "paid",
          tier: "enterprise",
          teamId,
          teamRole: "manager",
        });
      }

      // 4. Generate password reset link
      const actionCodeSettings = {
        url: "https://dealecho-io-sales-intel-hub.web.app", // Redirect back to DealEcho home page after resetting password
      };
      const setupLink = await auth.generatePasswordResetLink(email, actionCodeSettings);

      // 5. Send Invite Email via Resend
      const inviteComponent = React.createElement(InviteEmail, {
        name: displayName,
        email,
        role,
        setupLink,
      });

      await sendReactEmail({
        to: email,
        subject: "Welcome to DealEcho - Activate your account",
        component: inviteComponent,
      });

      return {
        success: true,
        user: {
          uid,
          email,
          displayName,
          role,
          tier,
          subscriptionStatus,
          createdAt: userData.createdAt,
          suspended: false,
        },
      };
    } catch (err: any) {
      console.error("Error manually creating user:", err);
      throw new HttpsError("internal", err.message || "Failed to create user.");
    }
  }
);

// ── adminToggleUserSuspension ──────────────────────────────────────────────────
/**
 * Suspends or reactivates a user in Firebase Auth and Firestore.
 * Revokes refresh tokens instantly when suspending.
 * Admin only.
 */
export const adminToggleUserSuspension = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { targetUid, suspend } = request.data as {
    targetUid: string;
    suspend: boolean;
  };

  if (!targetUid || typeof suspend !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "targetUid and suspend (boolean) are required."
    );
  }

  if (targetUid === request.auth!.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot suspend your own admin account."
    );
  }

  try {
    // 1. Toggle disabled in Firebase Auth
    await auth.updateUser(targetUid, { disabled: suspend });

    // 2. Revoke refresh tokens if suspending so they are booted off immediately
    if (suspend) {
      await auth.revokeRefreshTokens(targetUid);
    }

    // 3. Update Firestore status
    await db.collection("users").doc(targetUid).set(
      {
        suspended: suspend,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return { success: true, uid: targetUid, suspended: suspend };
  } catch (err: any) {
    console.error("Error toggling user suspension:", err);
    throw new HttpsError("internal", err.message || "Failed to toggle suspension.");
  }
});

// ── adminDeleteUser ───────────────────────────────────────────────────────────
/**
 * Completely deletes a user's Auth account and Firestore profile.
 * Does NOT delete their reviews/posts (natively retained).
 * Admin only.
 */
export const adminDeleteUser = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { targetUid } = request.data as { targetUid: string };

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "targetUid is required.");
  }

  if (targetUid === request.auth!.uid) {
    throw new HttpsError(
      "failed-precondition",
      "You cannot delete your own admin account."
    );
  }

  try {
    // 1. Delete from Firebase Auth
    await auth.deleteUser(targetUid);

    // 2. Delete from Firestore users collection
    await db.collection("users").doc(targetUid).delete();

    return { success: true, uid: targetUid };
  } catch (err: any) {
    console.error("Error deleting user:", err);
    throw new HttpsError("internal", err.message || "Failed to delete user.");
  }
});

// ── adminSendNewsletter ───────────────────────────────────────────────────────
/**
 * Sends a community digest or newsletter to all active subscribed users, or
 * a single test target address.
 * Admin only. Secrets: RESEND_API_KEY.
 */
export const adminSendNewsletter = onCall(
  { cors: true, secrets: ["RESEND_API_KEY"] },
  async (request) => {
    requireAdmin(request);

    const { subject, preheaderText, title, content, isTest, testEmail } = request.data as {
      subject: string;
      preheaderText: string;
      title: string;
      content: string;
      isTest: boolean;
      testEmail?: string;
    };

    if (!subject || !title || !content) {
      throw new HttpsError(
        "invalid-argument",
        "subject, title, and content are required."
      );
    }

    // Clean and segment content by double-newlines into paragraphs
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (isTest) {
      const targetEmail = testEmail || request.auth!.token.email || "";
      if (!targetEmail) {
        throw new HttpsError(
          "invalid-argument",
          "testEmail or administrator email is required for testing."
        );
      }

      await sendReactEmail({
        to: targetEmail,
        subject: `[TEST] ${subject}`,
        component: React.createElement(NewsletterEmail, {
          title,
          preheaderText: preheaderText || "Newsletter preview",
          paragraphs,
          email: targetEmail,
          uid: request.auth!.uid,
        }),
      });

      return { success: true, sentCount: 1, isTest: true };
    }

    // Broadcast Mass Send Mode
    // 1. Initialize a new newsletter document to track open rates
    const newsletterRef = db.collection("newsletters").doc();
    const newsletterId = newsletterRef.id;

    // 2. Fetch all Firestore user documents
    const usersSnap = await db.collection("users").get();
    const activeSubscribedUsers = usersSnap.docs
      .map((d) => ({ uid: d.id, ...d.data() }) as any)
      .filter((u) => {
        // Exclude suspended
        if (u.suspended === true) return false;
        // Exclude opted-out of weekly digests/newsletters
        if (u.notificationPreferences?.weeklyDigest === false) return false;
        // Require valid email field
        if (!u.email) return false;
        return true;
      });

    // 3. Dispatch emails in parallel batches of 10
    const batchSize = 10;
    let sentCount = 0;

    for (let i = 0; i < activeSubscribedUsers.length; i += batchSize) {
      const batch = activeSubscribedUsers.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (u) => {
          try {
            await sendReactEmail({
              to: u.email,
              subject,
              component: React.createElement(NewsletterEmail, {
                title,
                preheaderText: preheaderText || "Latest updates from DealEcho",
                paragraphs,
                email: u.email,
                uid: u.uid,
                newsletterId,
              }),
            });
            sentCount++;
          } catch (err) {
            console.error(`Failed to send newsletter to ${u.email}:`, err);
          }
        })
      );
    }

    // 4. Save campaign history record in Firestore
    await newsletterRef.set({
      id: newsletterId,
      subject,
      title,
      preheaderText: preheaderText || "Latest updates from DealEcho",
      content,
      sentAt: new Date().toISOString(),
      sentCount,
      opens: 0,
    });

    return { success: true, sentCount, isTest: false };
  }
);
