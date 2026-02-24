
import { Review } from './types';

const COMPANIES = [
  { name: 'Palantir Technologies', industry: 'DATA ANALYTICS', country: 'United States' },
  { name: 'Datadog Inc', industry: 'CLOUD MONITORING', country: 'United States' },
  { name: 'Adyen NV', industry: 'FINANCE', country: 'Netherlands' },
  { name: 'Wise PLC', industry: 'FINANCE', country: 'United Kingdom' },
  { name: 'MongoDB', industry: 'DATABASE', country: 'United States' },
  { name: 'GitLab', industry: 'SOFTWARE', country: 'Global' },
  { name: 'CrowdStrike', industry: 'CYBERSECURITY', country: 'United States' },
  { name: 'Snyk Ltd', industry: 'CYBERSECURITY', country: 'United Kingdom' },
  { name: 'Celonis SE', industry: 'PROCESS MINING', country: 'Germany' },
  { name: 'Personio GmbH', industry: 'HR TECH', country: 'Germany' },
  { name: 'Miro', industry: 'COLLABORATION', country: 'Netherlands' },
  { name: 'Checkout.com', industry: 'FINANCE', country: 'United Kingdom' },
  { name: 'Snowflake', industry: 'DATA WAREHOUSING', country: 'United States' },
  { name: 'Confluent', industry: 'DATA STREAMING', country: 'United States' },
  { name: 'Okta', industry: 'IDENTITY MANAGEMENT', country: 'United States' },
  { name: 'Zscaler', industry: 'CYBERSECURITY', country: 'United States' },
  { name: 'ServiceNow', industry: 'ITSM', country: 'United States' },
  { name: 'Workday', industry: 'HR/FINANCE', country: 'United States' },
  { name: 'Splunk', industry: 'OBSERVABILITY', country: 'United States' },
  { name: 'Elastic', industry: 'SEARCH', country: 'Netherlands' },
  { name: 'Auth0', industry: 'IDENTITY', country: 'United States' },
  { name: 'Twilio', industry: 'COMMUNICATIONS', country: 'United States' },
  { name: 'Postman', industry: 'API TOOLS', country: 'United States' },
  { name: 'HashiCorp', industry: 'INFRASTRUCTURE', country: 'United States' },
  { name: 'Netlify', industry: 'WEB OPS', country: 'United States' },
  { name: 'Vercel', industry: 'WEB OPS', country: 'United States' },
  { name: 'Scale AI', industry: 'ARTIFICIAL INTELLIGENCE', country: 'United States' },
  { name: 'DeepL SE', industry: 'AI TRANSLATION', country: 'Germany' },
  { name: 'Revolut', industry: 'FINANCE', country: 'United Kingdom' },
  { name: 'Monzo', industry: 'FINANCE', country: 'United Kingdom' },
  { name: 'N26', industry: 'FINANCE', country: 'Germany' },
  { name: 'Klarna', industry: 'FINANCE', country: 'Sweden' },
  { name: 'Spotify', industry: 'MEDIA', country: 'Sweden' },
  { name: 'Unity', industry: 'GAMING TECH', country: 'United States' },
  { name: 'Epic Games', industry: 'GAMING TECH', country: 'United States' },
  { name: 'Roblox', industry: 'GAMING TECH', country: 'United States' },
  { name: 'ZoomInfo', industry: 'SALES TECH', country: 'United States' },
  { name: 'HubSpot', industry: 'CRM', country: 'United States' },
  { name: 'Freshworks', industry: 'SaaS', country: 'United States' },
  { name: 'Intercom', industry: 'CUSTOMER SERVICE', country: 'Ireland' }
];

const TCV_BRACKETS = ["< $10k", "$10k - $25k", "$25k - $50k", "$50k - $100k", "$100k - $250k", "$250k - $500k", "$500k - $750k", "$750k - $1M", "$1M+"];
const DURATIONS = ["< 1 Month", "1-3 Months", "3-6 Months", "6-12 Months", "12+ Months"];
const STATUSES: ("Won" | "Lost" | "Ongoing")[] = ["Won", "Lost", "Ongoing"];
const CURRENCIES = ["USD", "GBP", "EUR", "AUD", "CAD"];

// Standardized list matching Analytics and Review creation
const DEPARTMENTS = [
  "IT / Engineering", "Security / InfoSec", "Data Privacy / DPO", "Procurement", "Finance / Treasury",
  "Legal / Compliance", "Executive Leadership (C-Suite)", "Marketing", "Sales / Business Development",
  "Operations / Enablement", "HR / People Ops", "Product Management", "Customer Success / Support",
  "Supply Chain / Logistics", "Facilities / Real Estate", "R&D / Innovation", "Strategy / Corporate Dev",
  "Quality Assurance / QA", "Regulatory / Gov Affairs", "External Consultants / Advisors", "Board of Directors"
];

const STRATEGIC_CONTENTS = [
  "Account is highly technical-led. Your champion needs to be an Architect or VP of Eng. Procurement is just a rubber stamp here if the technical value is proven.",
  "Be prepared for a long legal cycle. They have a custom MSA that they refuse to deviate from. Factor in an extra 3 months for 'standard' liability talks.",
  "Classic tire-kicker behavior observed in Q3. Asked for a detailed POC and 5 reference calls, then ghosted when the contract was sent to their Finance lead.",
  "Winner of a formal tender. They value transparency on the roadmap above all else. Don't hide your limitations or they will catch you in the audit.",
  "Pricing pressure is extreme. Procurement usually starts with a 40% discount demand as a baseline. Stick to your value and hold the line on the renewal terms.",
  "Champion was very strong but the CFO vetoed the deal due to an unannounced internal budget freeze. Keep the relationship warm for next fiscal year.",
  "Buying team is fragmented. You need to manage 4 different departments separately. If you don't have an executive sponsor, the deal will stall in Security.",
  "Very smooth process. The technical lead had a pre-approved budget for this category. Closed in 6 weeks with minimal negotiation friction.",
  "They used our detailed proposal and technical architecture maps to build a basic version internally. Avoid sharing deep implementation logic until contract is signed.",
  "High quality professional team. They follow a strict MEDDIC-style process internally. If you aren't identifying a clear pain, they won't buy.",
  "Security evaluation is the biggest hurdle. Expect a 300-question spreadsheet. If you don't have SOC2 Type II, don't even bother starting the cycle.",
  "The procurement lead changed halfway through the deal. The new lead tried to renegotiate the entire commercial structure. Be firm on your previous agreements.",
  "Highly collaborative environment. They treat vendors as partners. Very few redlines on the MSA and payment terms were accepted at 30 days without fuss.",
  "They are currently benchmarking 5 different vendors. We were just 'number 3' to satisfy their internal procurement policy of three-quotes.",
  "Managed to win by bypassing procurement and going directly to the CEO for a strategic 'digital transformation' sign-off. High risk, high reward tactic.",
  "Expect 'Scope Creep' during the implementation phase. They tend to add 20% more requirements after the contract is signed. Scoped tightly in the SOW.",
  "The technical evaluation was led by an external consultant who was biased towards their previous employer's tech stack. Very uphill battle.",
  "Ongoing cycle. The stakeholders are responsive but there's no clear 'compelling event' driving the deal forward right now.",
  "Lost the deal to a 'free' alternative that was bundled with their existing ERP. Hard to compete with $0 upfront even with better tech.",
  "Incredible velocity. They had a massive compliance failure and needed our solution 'yesterday'. Zero pricing friction due to the urgency.",
  "Legal friction was high because they wanted unlimited indemnity for third-party claims. Took 4 months to find a compromise with our insurers.",
  "Total tire kicker. They were just benchmarking for their board meeting to show they were 'looking at innovation'. No actual budget exists.",
  "Won a competitive RFx. Our ability to show local data residency in Germany was the deciding factor for their Data Privacy officer.",
  "Procurement demanded we match the pricing of a much smaller, non-enterprise competitor. We had to walk as it would have set a bad precedent.",
  "Great account for land-and-expand. Start small with a $20k pilot and they scale quickly once you are through the security gates.",
  "The champion left the company 2 weeks before the expected signature. The deal has now stalled as we search for a new internal advocate.",
  "Aggressive procurement tactics. They use a reverse-auction style approach for renewals. Hold your ground on the value delivery metrics.",
  "Negotiations were fluid. They prioritized a 3-year commitment in exchange for a modest volume discount. Both sides felt like they won.",
  "Ongoing tender. The requirements are extremely rigid and follow local government regulations. Requires significant documentation support.",
  "The project was killed by a surprise merger. All new vendor spend was halted immediately. Keep an eye on the news for the integration status."
];

const generateReviews = (): Review[] => {
  const reviews: Review[] = [];
  const now = new Date();
  
  for (let i = 0; i < 500; i++) {
    const company = COMPANIES[i % COMPANIES.length];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const userId = `user-${(i % 50) + 1}`;
    
    let commRating = Math.floor(Math.random() * 5) + 1;
    let negotiationLevel = Math.floor(Math.random() * 5) + 1;
    let timeWasterLevel = Math.floor(Math.random() * 5) + 1;
    let clarityOfScope = Math.floor(Math.random() * 5) + 1;

    if (status === 'Won') {
        commRating = Math.min(5, Math.floor(Math.random() * 2) + 4);
        negotiationLevel = Math.min(5, Math.floor(Math.random() * 3) + 3);
        timeWasterLevel = Math.min(5, Math.floor(Math.random() * 2) + 4);
        clarityOfScope = Math.min(5, Math.floor(Math.random() * 3) + 3);
    } else if (status === 'Lost') {
        commRating = Math.max(1, Math.floor(Math.random() * 3) + 1);
        negotiationLevel = Math.max(1, Math.floor(Math.random() * 2) + 1);
        timeWasterLevel = Math.max(1, Math.floor(Math.random() * 2) + 1);
        clarityOfScope = Math.max(1, Math.floor(Math.random() * 3) + 1);
    }
    
    const daysAgo = Math.floor(Math.random() * 730);
    const createdAt = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();

    reviews.push({
      id: `rev-${i}`,
      companyId: `comp-${i % COMPANIES.length}`,
      companyName: company.name,
      userId: userId,
      userName: 'Verified Contributor',
      currency: CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)],
      tcvBracket: TCV_BRACKETS[Math.floor(Math.random() * TCV_BRACKETS.length)],
      cycleDuration: DURATIONS[Math.floor(Math.random() * DURATIONS.length)],
      status: status,
      isTender: Math.random() > 0.8,
      buyingTeam: [
        DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
        DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)]
      ].filter((v, idx, self) => self.indexOf(v) === idx),
      location: company.country,
      communicationRating: commRating,
      negotiationLevel: negotiationLevel,
      timeWasterLevel: timeWasterLevel,
      clarityOfScope: clarityOfScope,
      industry: company.industry,
      country: company.country,
      content: STRATEGIC_CONTENTS[i % STRATEGIC_CONTENTS.length],
      createdAt: createdAt
    });
  }
  
  return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const mockReviews = generateReviews();
