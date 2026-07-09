import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

export const issueCustomToken = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to use Dealecho.");
  }
  const userRecord = await admin.auth().getUser(request.auth.uid);
  const claims = (userRecord.customClaims as Record<string, unknown>) ?? {};
  const customToken = await admin.auth().createCustomToken(request.auth.uid, claims);
  return { customToken };
});
