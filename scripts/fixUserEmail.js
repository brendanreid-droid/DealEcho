/* scripts/fixUserEmail.js */
const admin = require('firebase-admin');

// Initialize the Admin SDK (uses Application Default Credentials)
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const uid = 'KVFXI2Rb6QQoBK5NPXAh3pdYtMF2';
const email = 'brendan.reid@gmail.com';
const name = 'Brendan';

admin.firestore().doc(`users/${uid}`).set({ email, name }, { merge: true })
  .then(() => {
    console.log(`✅ Updated user ${uid} with email ${email}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed to update user document:', err);
    process.exit(1);
  });
