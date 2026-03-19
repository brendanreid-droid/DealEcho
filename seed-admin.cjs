const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

// 1. Initialize the Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 2. GET USER ID FROM COMMAND LINE
const uid = process.argv[2];

if (!uid) {
  console.error('\n❌ ERROR: Please provide a User UID.');
  console.log('Usage: node seed-admin.js <USER_UID>\n');
  process.exit(1);
}

async function grantAdmin() {
  try {
    // 3. Set the 'admin' role custom claim
    await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    
    // 4. Update the Firestore user document for UI visibility
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`\n✅ SUCCESS: User ${uid} is now an ADMIN.`);
    console.log('Action: Logout and log back in on the website to see the changes.\n');
  } catch (error) {
    console.error('\n❌ FAILED to set admin claim:', error.message);
  } finally {
    process.exit();
  }
}

grantAdmin();
