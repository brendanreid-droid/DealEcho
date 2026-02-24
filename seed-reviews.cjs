
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Admin SDK with your local service account
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const COMPANIES = [
  { name: 'Palantir Technologies', industry: 'DATA ANALYTICS', country: 'United States' },
  { name: 'Datadog Inc', industry: 'CLOUD MONITORING', country: 'United States' },
  { name: 'Snowflake', industry: 'DATA WAREHOUSING', country: 'United States' },
  { name: 'CrowdStrike', industry: 'CYBERSECURITY', country: 'United States' },
  { name: 'Miro', industry: 'COLLABORATION', country: 'Netherlands' }
];

const STRATEGIC_CONTENTS = [
  "Account is highly technical-led. Your champion needs to be an Architect or VP of Eng.",
  "Be prepared for a long legal cycle. They have a custom MSA that they refuse to deviate from.",
  "Pricing pressure is extreme. Procurement usually starts with a 40% discount demand as a baseline.",
  "Very smooth process. The technical lead had a pre-approved budget for this category.",
  "Security evaluation is the biggest hurdle. Expect a 300-question spreadsheet."
];

async function seed() {
  console.log('🌱 Seeding reviews to Firestore...');
  const reviewsRef = db.collection('reviews');
  
  for (let i = 0; i < 15; i++) {
    const company = COMPANIES[i % COMPANIES.length];
    const reviewId = `seed-rev-${i}`;
    
    const review = {
      companyId: `comp-${i % COMPANIES.length}`,
      companyName: company.name,
      userId: `user-${(i % 3) + 1}`,
      userName: 'Verified Contributor',
      currency: 'USD',
      tcvBracket: '$50k - $100k',
      cycleDuration: '3-6 Months',
      status: 'Won',
      isTender: false,
      buyingTeam: ['IT / Engineering', 'Procurement'],
      location: company.country,
      communicationRating: 4,
      negotiationLevel: 3,
      timeWasterLevel: 5,
      clarityOfScope: 4,
      industry: company.industry,
      country: company.country,
      content: STRATEGIC_CONTENTS[i % STRATEGIC_CONTENTS.length],
      createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
    };

    await reviewsRef.doc(reviewId).set(review);
    console.log(`✅ Seeded review: ${reviewId} for ${company.name}`);
  }
  
  console.log('🚀 Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
