const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const EXCERPT_LENGTH = 140;

function toSummary(reviewId, data) {
  const content = data.content ?? "";
  return {
    reviewId,
    companyId: data.companyId ?? "",
    companyName: data.companyName ?? "",
    industry: data.industry ?? "",
    country: data.country ?? "",
    location: data.location ?? "",
    status: data.status ?? "Ongoing",
    communicationRating: data.communicationRating ?? 0,
    negotiationLevel: data.negotiationLevel ?? 0,
    timeWasterLevel: data.timeWasterLevel ?? 0,
    clarityOfScope: data.clarityOfScope ?? 3,
    excerpt:
      content.length > EXCERPT_LENGTH
        ? content.slice(0, EXCERPT_LENGTH).trimEnd() + "…"
        : content,
    createdAt: data.createdAt ?? new Date().toISOString(),
    syncedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

async function backfill() {
  console.log('🔄 Starting backfill of review summaries...');
  const reviewsSnap = await db.collection('reviews').get();
  
  let count = 0;
  for (const doc of reviewsSnap.docs) {
    const d = doc.data();
    const approved = !d.moderationStatus || d.moderationStatus === 'approved';
    if (approved) {
      const summary = toSummary(doc.id, d);
      await db.collection('review_summaries').doc(doc.id).set(summary, { merge: true });
      console.log(`✅ Backfilled summary for review: ${doc.id}`);
      count++;
    }
  }
  
  console.log(`🎉 Backfill complete! Synchronised ${count} reviews to review_summaries.`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
