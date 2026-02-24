/**
 * Firebase Admin SDK initialization.
 *
 * This file is NOT bundled by Vite — it runs in Node.js only.
 * Used for admin scripts (data seeding, token verification, etc.)
 *
 * Credentials: place service-account.json in the project root (gitignored).
 * Never commit service-account.json to version control.
 *
 * Usage:
 *   npx ts-node --esm admin/adminConfig.ts
 *   OR import { adminDb, adminAuth } from './adminConfig' in other admin scripts
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), 'service-account.json');

let serviceAccount: admin.ServiceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
} catch {
  throw new Error(
    `[Admin SDK] service-account.json not found at: ${SERVICE_ACCOUNT_PATH}\n` +
    'Generate it from Firebase Console → Project Settings → Service Accounts → Generate new private key.\n' +
    'Make sure it is NEVER committed to git.'
  );
}

// Initialize admin app once (singleton)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount.projectId,
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export default admin;
