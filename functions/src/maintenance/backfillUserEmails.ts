import { db, auth } from '../lib/firebaseAdmin';

/**
 * Backfills missing or invalid email/name fields in the `users` collection.
 * For each user document, if `email` is missing or does not contain '@',
 * we fetch the corresponding Firebase Auth record (using the same UID) and
 * update the Firestore document with the correct `email` and `name` fields.
 */
async function backfill() {
  console.log('🔧 Starting backfill of user emails...');
  const snapshot = await db.collection('users').get();
  if (snapshot.empty) {
    console.log('✅ No user documents found. Done.');
    return;
  }

  const updates: Promise<void>[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const uid = docSnap.id;
    const email = data.email as string | undefined;
    const name = data.name as string | undefined;
    const emailInvalid = !email || !email.includes('@');
    if (!emailInvalid && name) {
      // Already has a valid email and name – nothing to do.
      return;
    }
    // Fetch from Auth and update.
    const p = auth.getUser(uid)
      .then((userRecord) => {
        const newEmail = userRecord.email;
        const newName = userRecord.displayName || name || '';
        if (!newEmail || !newEmail.includes('@')) {
          console.warn(`⚠️ UID ${uid} has no valid email in Auth; skipping.`);
          return;
        }
        const updateData: any = { email: newEmail };
        if (newName) updateData.name = newName;
        return db.collection('users').doc(uid).set(updateData, { merge: true })
          .then(() => console.log(`✅ Updated user ${uid} with email ${newEmail}`))
          .catch((err) => console.error(`❌ Failed to update Firestore for ${uid}:`, err));
      })
      .catch((err) => {
        console.warn(`⚠️ Could not fetch Auth user for UID ${uid}:`, err.message);
      });
    updates.push(p);
  });

  await Promise.all(updates);
  console.log('🎉 Backfill complete.');
}

// Execute when run directly
export async function backfillUserEmails() {
  console.log('🔧 Starting backfill of user emails...');
  const snapshot = await db.collection('users').get();
  if (snapshot.empty) {
    console.log('✅ No user documents found. Done.');
    return;
  }

  const updates: Promise<void>[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const uid = docSnap.id;
    const email = data.email as string | undefined;
    const name = data.name as string | undefined;
    const emailInvalid = !email || !email.includes('@');
    if (!emailInvalid && name) {
      return;
    }
    const p = auth.getUser(uid)
      .then((userRecord) => {
        const newEmail = userRecord.email;
        const newName = userRecord.displayName || name || '';
        if (!newEmail || !newEmail.includes('@')) {
          console.warn(`⚠️ UID ${uid} has no valid email in Auth; skipping.`);
          return;
        }
        const updateData: any = { email: newEmail };
        if (newName) updateData.name = newName;
        return db.collection('users').doc(uid).set(updateData, { merge: true })
          .then(() => console.log(`✅ Updated user ${uid} with email ${newEmail}`))
          .catch((err) => console.error(`❌ Failed to update Firestore for ${uid}:`, err));
      })
      .catch((err) => {
        console.warn(`⚠️ Could not fetch Auth user for UID ${uid}:`, err.message);
      });
    updates.push(p);
  });

  await Promise.all(updates);
  console.log('🎉 Backfill complete.');
}
