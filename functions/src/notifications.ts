import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./lib/firebaseAdmin";

interface NotificationPreferences {
  realTimeAlerts: boolean;
  weeklyDigest: boolean;
}

/**
 * Updates a user's notification preferences in Firestore.
 * Supports both authenticated updates (via auth token) and unauthenticated updates
 * (for CAN-SPAM compliant unsubscribe links with direct email or uid parameters).
 */
export const updateNotificationPreferences = onCall({ cors: true }, async (request) => {
  const { email, uid, preferences } = request.data ?? {};

  if (!preferences || typeof preferences.realTimeAlerts !== "boolean" || typeof preferences.weeklyDigest !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "Missing or invalid preferences object. It must contain realTimeAlerts (boolean) and weeklyDigest (boolean)."
    );
  }

  const updatedPrefs = {
    realTimeAlerts: preferences.realTimeAlerts,
    weeklyDigest: preferences.weeklyDigest,
  };

  // 1. Authenticated User (Secure client-side update check)
  if (request.auth) {
    const authUid = request.auth.uid;
    console.log(`Updating preferences for authenticated user UID: ${authUid}`);
    const userRef = db.collection("users").doc(authUid);
    await userRef.set({ notificationPreferences: updatedPrefs }, { merge: true });
    return { success: true, uid: authUid };
  }

  // 2. Unauthenticated User – via direct UID from unsubscribe link
  if (uid) {
    console.log(`Updating preferences for unauthenticated user UID: ${uid}`);
    const userRef = db.collection("users").doc(uid);
    const docSnap = await userRef.get();
    if (!docSnap.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }
    await userRef.set({ notificationPreferences: updatedPrefs }, { merge: true });
    return { success: true, uid };
  }

  // 3. Unauthenticated User – via email search from unsubscribe link
  if (email) {
    console.log(`Updating preferences for unauthenticated email: ${email}`);
    
    // Check both standard email field and identifier field
    const usersSnap = await db.collection("users").where("email", "==", email).get();
    let targets = usersSnap.docs;

    if (usersSnap.empty) {
      const identSnap = await db.collection("users").where("identifier", "==", email).get();
      targets = identSnap.docs;
    }

    if (targets.length === 0) {
      throw new HttpsError("not-found", "No user found with the provided email address.");
    }

    const batch = db.batch();
    targets.forEach((doc) => {
      batch.set(doc.ref, { notificationPreferences: updatedPrefs }, { merge: true });
    });
    await batch.commit();

    return { success: true, email, updatedDocs: targets.length };
  }

  throw new HttpsError(
    "invalid-argument",
    "Request must be authenticated or provide a valid uid or email."
  );
});
