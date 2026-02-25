import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { db, auth } from "./lib/firebaseAdmin";

type UserRole = "free" | "paid" | "admin";

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
  if (!["free", "paid", "admin"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be free, paid, or admin.",
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
    role === "paid" ? "paid_monthly" : role === "admin" ? "admin" : "free";

  // Derive subscriptionStatus so the admin panel stays consistent
  const subscriptionStatus =
    role === "paid" ? "active" : role === "admin" ? null : null;

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
