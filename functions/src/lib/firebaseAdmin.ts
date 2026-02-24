import * as admin from 'firebase-admin';

// Auto-initializes using FIREBASE_CONFIG env var when running in Cloud Functions
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export { admin };
