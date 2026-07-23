import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db, auth } from "./lib/firebaseAdmin";

type UserRole = "free" | "paid" | "admin" | "free_full" | "enterprise";

/** Guard: ensures caller has admin custom claim. */
function requireAdmin(request: CallableRequest<any>) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  if ((request.auth.token as any).role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

// ── Touch payload sanitisation ────────────────────────────────────────────────
interface TouchPayload {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt?: string;
}

const TOUCH_KEYS: (keyof TouchPayload)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landingPath",
  "capturedAt",
];

/** Keep only known string fields, length-capped. Returns null if meaningless. */
function sanitizeTouch(raw: any): TouchPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const out: TouchPayload = {};
  for (const k of TOUCH_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v.length > 0) {
      out[k] = v.slice(0, 500);
    }
  }
  // Needs at least one campaign signal to be worth storing.
  if (!out.utm_source && !out.utm_medium && !out.utm_campaign && !out.referrer) {
    return null;
  }
  return out;
}

// ── Email domain classification ───────────────────────────────────────────────
/** Consumer / ISP mailbox domains. Anything else counts as a business domain. */
const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "outlook.com.au", "hotmail.com", "hotmail.co.uk",
  "live.com", "live.com.au", "msn.com",
  "yahoo.com", "yahoo.com.au", "yahoo.co.uk", "ymail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.net", "zoho.com", "mail.com", "yandex.com",
  "hey.com", "duck.com", "fastmail.com", "fastmail.fm",
  "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au",
  "internode.on.net", "tpg.com.au", "westnet.com.au",
]);

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function isBusinessDomain(domain: string): boolean {
  return domain !== "" && !PERSONAL_DOMAINS.has(domain);
}

// ── updateMarketingProfile ────────────────────────────────────────────────────
const MARKETING_ROLES = new Set([
  "sales", "procurement", "founder", "finance", "other",
]);
const COMPANY_SIZES = new Set(["1-10", "11-50", "51-200", "200+"]);

/**
 * Called by the client when the user answers (or permanently dismisses) the
 * role prompt. Writes only to the caller's OWN user doc under marketingProfile;
 * values are validated against fixed enums so nothing free-form is stored.
 */
export const updateMarketingProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const uid = request.auth.uid;
  const nowIso = new Date().toISOString();

  const profile: Record<string, unknown> = {};
  const role = request.data?.role;
  if (typeof role === "string" && MARKETING_ROLES.has(role)) {
    profile.role = role;
    profile.roleRecordedAt = nowIso;
  }
  const companySize = request.data?.companySize;
  if (typeof companySize === "string" && COMPANY_SIZES.has(companySize)) {
    profile.companySize = companySize;
  }
  if (request.data?.dismissed === true) {
    profile.promptDismissedAt = nowIso;
  }
  if (request.data?.onboardingDismissed === true) {
    profile.onboardingDismissedAt = nowIso;
  }
  if (request.data?.extensionAdded === true) {
    profile.extensionAddedAt = nowIso;
  }
  if (Object.keys(profile).length === 0) {
    return { status: "skipped", reason: "no valid fields" };
  }
  profile.updatedAt = nowIso;

  await db
    .collection("users")
    .doc(uid)
    .set({ marketingProfile: profile }, { merge: true });
  return { status: "ok" };
});

// ── Locale / region capture ───────────────────────────────────────────────────
interface LocalePayload {
  region: string; // IANA timezone, e.g. "Australia/Sydney"
  country: string; // 2-letter code derived from language tag, e.g. "AU"
  language: string; // raw BCP-47 tag, e.g. "en-AU"
}

const TIMEZONE_PATTERN = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+){1,2})$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/** Extract an uppercase 2-letter region subtag from a BCP-47 language tag. */
function countryFromLanguage(language: string): string {
  const parts = language.split("-");
  for (const p of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
  }
  return "";
}

/** Validate browser-supplied locale. Returns null when nothing usable. */
function sanitizeLocale(raw: any): LocalePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const tz = typeof raw.timeZone === "string" ? raw.timeZone.slice(0, 60) : "";
  const lang =
    typeof raw.language === "string" ? raw.language.slice(0, 35) : "";
  const region = TIMEZONE_PATTERN.test(tz) ? tz : "";
  const language = LANGUAGE_PATTERN.test(lang) ? lang : "";
  const country = language ? countryFromLanguage(language) : "";
  if (!region && !country) return null;
  return { region, country, language };
}

// ── recordActivity ────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = new Set(["search", "profile_view"]);
const INDUSTRY_PATTERN = /^[A-Za-z0-9 &\-/().,'+]{1,60}$/;
const MAX_INDUSTRY_KEYS = 50;

/**
 * Fire-and-forget behavioral counters, aggregated on the caller's OWN user doc
 * under `behavior` (no raw event log). Industry strings are charset/length
 * checked and the industries map is capped so a hostile client cannot grow the
 * doc without bound. Feeds the admin marketing report's ICP signals.
 */
export const recordActivity = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const type = request.data?.type;
  if (typeof type !== "string" || !ACTIVITY_TYPES.has(type)) {
    throw new HttpsError("invalid-argument", "Unknown activity type.");
  }

  let industry: string | null = null;
  const rawIndustry = request.data?.industry;
  if (typeof rawIndustry === "string") {
    const trimmed = rawIndustry.trim();
    if (INDUSTRY_PATTERN.test(trimmed)) industry = trimmed;
  }

  const userRef = db.collection("users").doc(request.auth.uid);

  // Cap distinct industry keys: only count a NEW industry while under the cap.
  if (industry) {
    const snap = await userRef.get();
    const existing = snap.data()?.behavior?.industries ?? {};
    if (
      existing[industry] === undefined &&
      Object.keys(existing).length >= MAX_INDUSTRY_KEYS
    ) {
      industry = null;
    }
  }

  const behavior: Record<string, unknown> = {
    lastActiveAt: new Date().toISOString(),
  };
  if (type === "search") behavior.searches = FieldValue.increment(1);
  if (type === "profile_view") behavior.profileViews = FieldValue.increment(1);
  if (industry) {
    behavior.industries = { [industry]: FieldValue.increment(1) };
  }

  await userRef.set({ behavior }, { merge: true });
  return { status: "ok" };
});

// ── recordAcquisition ─────────────────────────────────────────────────────────
/**
 * Called by the client right after a NEW user signs up. Writes marketing
 * attribution to the caller's OWN user doc (target is request.auth.uid, so a
 * client cannot write to someone else's record).
 *   - firstTouch: written once, immutable (first campaign that brought them in).
 *   - lastTouch:  refreshed each call (most recent campaign before signup).
 * Also persists a coarse geo signal (browser timezone + locale country) under
 * `geo`, independent of whether any attribution is present.
 */
export const recordAcquisition = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const uid = request.auth.uid;

  const firstTouch = sanitizeTouch(request.data?.firstTouch);
  const lastTouch = sanitizeTouch(request.data?.lastTouch);
  const locale = sanitizeLocale(request.data?.locale);
  if (!firstTouch && !lastTouch && !locale) {
    return { status: "skipped", reason: "no data" };
  }

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = (snap.exists ? snap.data()?.acquisition : undefined) ?? {};

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {};

  if (firstTouch || lastTouch) {
    const acquisition: Record<string, unknown> = { ...existing };
    // firstTouch is immutable: only set when not already present.
    if (firstTouch && !existing.firstTouch) {
      acquisition.firstTouch = { ...firstTouch, recordedAt: nowIso };
    }
    // lastTouch always refreshed; fall back to firstTouch if that's all we have.
    const lt = lastTouch ?? firstTouch;
    if (lt) {
      acquisition.lastTouch = { ...lt, recordedAt: nowIso };
    }
    acquisition.updatedAt = nowIso;
    update.acquisition = acquisition;
  }

  // Geo is set once and left alone (first-seen region wins), so a later trip
  // abroad doesn't rewrite the account's home region.
  if (locale && !snap.data()?.geo?.region && !snap.data()?.geo?.country) {
    update.geo = { ...locale, recordedAt: nowIso };
  }

  if (Object.keys(update).length === 0) {
    return { status: "skipped", reason: "nothing to update" };
  }
  await userRef.set(update, { merge: true });
  return { status: "ok" };
});

// ── adminGetAcquisitionReport ─────────────────────────────────────────────────
interface ReportRow {
  uid: string;
  email: string;
  displayName: string;
  emailDomain: string;
  isBusinessEmail: boolean;
  marketingRole: string;
  companySize: string;
  region: string;
  country: string;
  searches: number;
  profileViews: number;
  reviewCount: number;
  trackedCompanies: number;
  topIndustries: string;
  lastActiveAt: string;
  createdAt: string;
  score: number;
  scoreBand: string;
  role: string;
  tier: string;
  isPaid: boolean;
  first_source: string;
  first_medium: string;
  first_campaign: string;
  first_content: string;
  first_term: string;
  first_referrer: string;
  first_landing: string;
  first_capturedAt: string;
  last_source: string;
  last_medium: string;
  last_campaign: string;
  last_content: string;
}

/** Top N industries from a counts map, formatted "Name (count)". */
function topIndustries(
  counts: Record<string, number> | undefined,
  n: number,
): string {
  if (!counts) return "";
  return Object.entries(counts)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ");
}

function isPaidUser(role: string, tier: string): boolean {
  return (
    role === "paid" ||
    role === "enterprise" ||
    tier === "paid_monthly" ||
    tier === "paid_annual" ||
    tier === "enterprise"
  );
}

/** Whole days between an ISO timestamp and now; null when unparseable. */
function daysSince(iso: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

const BUYER_ROLES = new Set(["sales", "procurement", "founder", "finance"]);

/**
 * Transparent additive lead score (0-100ish) from fit + engagement + recency.
 * Fit: business email, buyer role. Engagement: searches, profile views,
 * reviews (highest intent), tracked companies. Recency: last active window.
 * Deliberately simple and explainable so the outbound list is trustable.
 */
function scoreUser(r: {
  isBusinessEmail: boolean;
  marketingRole: string;
  searches: number;
  profileViews: number;
  reviewCount: number;
  trackedCompanies: number;
  lastActiveAt: string;
}): number {
  let s = 0;
  if (r.isBusinessEmail) s += 25;
  if (BUYER_ROLES.has(r.marketingRole)) s += 15;
  s += Math.min(r.searches, 10) * 2; // up to 20
  s += Math.min(r.profileViews, 10) * 2; // up to 20
  s += Math.min(r.reviewCount * 10, 20); // reviews = high intent, up to 20
  s += Math.min(r.trackedCompanies * 5, 15); // up to 15
  const d = daysSince(r.lastActiveAt);
  if (d !== null && d <= 7) s += 15;
  else if (d !== null && d <= 30) s += 8;
  return s;
}

function scoreBand(score: number): string {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cool";
}

/**
 * Aggregates user acquisition data for the marketing dashboard. Admin only.
 * Returns per-user rows (for CSV / raw export) plus first-touch campaign
 * rollups with signup and paid-conversion counts.
 */
export const adminGetAcquisitionReport = onCall(
  { cors: true },
  async (request) => {
    requireAdmin(request);

    const listResult = await auth.listUsers(1000);
    const uids = listResult.users.map((u) => u.uid);
    const docs = await Promise.all(
      uids.map((uid) => db.collection("users").doc(uid).get()),
    );
    const fsMap: Record<string, FirebaseFirestore.DocumentData> = {};
    docs.forEach((s) => {
      if (s.exists) fsMap[s.id] = s.data()!;
    });

    // Reviews submitted per user (projection keeps the read light).
    const reviewCounts: Record<string, number> = {};
    const reviewSnap = await db.collection("reviews").select("userId").get();
    reviewSnap.docs.forEach((d) => {
      const uid = d.data().userId;
      if (typeof uid === "string") {
        reviewCounts[uid] = (reviewCounts[uid] ?? 0) + 1;
      }
    });

    const rows: ReportRow[] = listResult.users.map((u) => {
      const fs = fsMap[u.uid] ?? {};
      const acq = fs.acquisition ?? {};
      const ft = acq.firstTouch ?? {};
      const lt = acq.lastTouch ?? {};
      const role =
        (fs.role as UserRole) ?? (u.customClaims?.role as UserRole) ?? "free";
      const tier =
        (fs.tier as string) ?? (u.customClaims?.tier as string) ?? "free";
      const domain = emailDomain(u.email ?? "");
      const mp = fs.marketingProfile ?? {};
      const behavior = fs.behavior ?? {};
      const geo = fs.geo ?? {};
      const isBusinessEmail = isBusinessDomain(domain);
      const marketingRole = (mp.role as string) ?? "";
      const searches = (behavior.searches as number) ?? 0;
      const profileViews = (behavior.profileViews as number) ?? 0;
      const reviewCount = reviewCounts[u.uid] ?? 0;
      const tracked = Array.isArray(fs.trackedCompanies)
        ? fs.trackedCompanies.length
        : 0;
      const lastActiveAt = (behavior.lastActiveAt as string) ?? "";
      const score = scoreUser({
        isBusinessEmail,
        marketingRole,
        searches,
        profileViews,
        reviewCount,
        trackedCompanies: tracked,
        lastActiveAt,
      });
      return {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName ?? "",
        emailDomain: domain,
        isBusinessEmail,
        marketingRole,
        companySize: (mp.companySize as string) ?? "",
        region: (geo.region as string) ?? "",
        country: (geo.country as string) ?? "",
        searches,
        profileViews,
        reviewCount,
        trackedCompanies: tracked,
        topIndustries: topIndustries(behavior.industries, 3),
        lastActiveAt,
        createdAt: u.metadata.creationTime ?? "",
        score,
        scoreBand: scoreBand(score),
        role,
        tier,
        isPaid: isPaidUser(role, tier),
        first_source: ft.utm_source ?? "",
        first_medium: ft.utm_medium ?? "",
        first_campaign: ft.utm_campaign ?? "",
        first_content: ft.utm_content ?? "",
        first_term: ft.utm_term ?? "",
        first_referrer: ft.referrer ?? "",
        first_landing: ft.landingPath ?? "",
        first_capturedAt: ft.capturedAt ?? "",
        last_source: lt.utm_source ?? "",
        last_medium: lt.utm_medium ?? "",
        last_campaign: lt.utm_campaign ?? "",
        last_content: lt.utm_content ?? "",
      };
    });

    // First-touch campaign rollup.
    const rollup: Record<
      string,
      {
        source: string;
        medium: string;
        campaign: string;
        content: string;
        signups: number;
        paid: number;
      }
    > = {};
    for (const r of rows) {
      const source = r.first_source || "(direct)";
      const medium = r.first_medium || "(none)";
      const campaign = r.first_campaign || "(none)";
      const content = r.first_content || "(none)";
      const key = [source, medium, campaign, content].join(" | ");
      if (!rollup[key]) {
        rollup[key] = { source, medium, campaign, content, signups: 0, paid: 0 };
      }
      rollup[key].signups += 1;
      if (r.isPaid) rollup[key].paid += 1;
    }
    const campaigns = Object.values(rollup)
      .map((c) => ({
        ...c,
        conversionRate: c.signups ? c.paid / c.signups : 0,
      }))
      .sort((a, b) => b.signups - a.signups);

    const attributed = rows.filter(
      (r) => r.first_source || r.first_medium || r.first_campaign,
    ).length;

    // Role rollup (from the post-signup role prompt).
    const roleRollup: Record<string, { role: string; signups: number; paid: number }> = {};
    for (const r of rows) {
      const key = r.marketingRole || "(unanswered)";
      if (!roleRollup[key]) roleRollup[key] = { role: key, signups: 0, paid: 0 };
      roleRollup[key].signups += 1;
      if (r.isPaid) roleRollup[key].paid += 1;
    }
    const roles = Object.values(roleRollup)
      .map((c) => ({ ...c, conversionRate: c.signups ? c.paid / c.signups : 0 }))
      .sort((a, b) => b.signups - a.signups);

    // Business vs personal email rollup.
    const emailTypeRollup: Record<string, { type: string; signups: number; paid: number }> = {};
    for (const r of rows) {
      const key = r.isBusinessEmail ? "business" : "personal";
      if (!emailTypeRollup[key]) emailTypeRollup[key] = { type: key, signups: 0, paid: 0 };
      emailTypeRollup[key].signups += 1;
      if (r.isPaid) emailTypeRollup[key].paid += 1;
    }
    const emailTypes = Object.values(emailTypeRollup)
      .map((c) => ({ ...c, conversionRate: c.signups ? c.paid / c.signups : 0 }))
      .sort((a, b) => b.signups - a.signups);

    // Region rollup (browser timezone) with activity, so you can see both where
    // signups come from and where the engaged usage is.
    const regionRollup: Record<
      string,
      {
        region: string;
        country: string;
        signups: number;
        paid: number;
        searches: number;
        profileViews: number;
      }
    > = {};
    for (const r of rows) {
      const region = r.region || "(unknown)";
      const g = (regionRollup[region] ??= {
        region,
        country: r.country,
        signups: 0,
        paid: 0,
        searches: 0,
        profileViews: 0,
      });
      g.signups += 1;
      if (r.isPaid) g.paid += 1;
      g.searches += r.searches;
      g.profileViews += r.profileViews;
      if (!g.country && r.country) g.country = r.country;
    }
    const regions = Object.values(regionRollup).sort(
      (a, b) =>
        b.signups - a.signups ||
        b.searches + b.profileViews - (a.searches + a.profileViews),
    );

    // Target accounts: business email domains grouped for outbound. Multiple
    // signups from one domain = warm account.
    const accountRollup: Record<
      string,
      {
        domain: string;
        signups: number;
        paid: number;
        roles: string[];
        trackedCompanies: number;
        searches: number;
        profileViews: number;
        reviews: number;
        score: number;
        industryCounts: Record<string, number>;
        lastSignupAt: string;
        users: { email: string; displayName: string; marketingRole: string; isPaid: boolean; createdAt: string }[];
      }
    > = {};
    for (const r of rows) {
      if (!r.isBusinessEmail) continue;
      const a = (accountRollup[r.emailDomain] ??= {
        domain: r.emailDomain,
        signups: 0,
        paid: 0,
        roles: [],
        trackedCompanies: 0,
        searches: 0,
        profileViews: 0,
        reviews: 0,
        score: 0,
        industryCounts: {},
        lastSignupAt: "",
        users: [],
      });
      a.signups += 1;
      if (r.isPaid) a.paid += 1;
      a.searches += r.searches;
      a.profileViews += r.profileViews;
      a.reviews += r.reviewCount;
      a.score += r.score;
      const userIndustries = fsMap[r.uid]?.behavior?.industries;
      if (userIndustries && typeof userIndustries === "object") {
        for (const [k, v] of Object.entries(userIndustries)) {
          if (typeof v === "number" && v > 0) {
            a.industryCounts[k] = (a.industryCounts[k] ?? 0) + v;
          }
        }
      }
      if (r.marketingRole && !a.roles.includes(r.marketingRole)) {
        a.roles.push(r.marketingRole);
      }
      const tracked = fsMap[r.uid]?.trackedCompanies;
      if (Array.isArray(tracked)) a.trackedCompanies += tracked.length;
      const parsed = r.createdAt ? new Date(r.createdAt) : null;
      const created =
        parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : "";
      if (created > a.lastSignupAt) a.lastSignupAt = created;
      a.users.push({
        email: r.email,
        displayName: r.displayName,
        marketingRole: r.marketingRole,
        isPaid: r.isPaid,
        createdAt: created,
      });
    }
    const accounts = Object.values(accountRollup)
      .map(({ industryCounts, ...a }) => ({
        ...a,
        topIndustries: topIndustries(industryCounts, 3),
      }))
      // Sort by lead score so the warmest outbound targets sit on top; signups
      // and recency break ties.
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.signups - a.signups ||
          (a.lastSignupAt < b.lastSignupAt ? 1 : -1),
      );

    // Activation funnel: how many signups reach each engagement step. Steps are
    // cumulative-ish signals derived from the counters (not strict timestamps).
    const funnel = {
      signedUp: rows.length,
      searched: rows.filter((r) => r.searches > 0).length,
      viewedProfile: rows.filter((r) => r.profileViews > 0).length,
      trackedCompany: rows.filter((r) => r.trackedCompanies > 0).length,
      submittedReview: rows.filter((r) => r.reviewCount > 0).length,
      paid: rows.filter((r) => r.isPaid).length,
    };

    // Conversion by engagement depth: does deeper early activity predict paid?
    // Buckets on profile views, the densest intent signal.
    const viewBuckets = [
      { label: "0 views", min: 0, max: 0 },
      { label: "1-2 views", min: 1, max: 2 },
      { label: "3-5 views", min: 3, max: 5 },
      { label: "6+ views", min: 6, max: Infinity },
    ];
    const engagementConversion = viewBuckets.map((b) => {
      const inBucket = rows.filter(
        (r) => r.profileViews >= b.min && r.profileViews <= b.max,
      );
      const paid = inBucket.filter((r) => r.isPaid).length;
      return {
        label: b.label,
        users: inBucket.length,
        paid,
        conversionRate: inBucket.length ? paid / inBucket.length : 0,
      };
    });

    // Dormancy: paid users gone quiet (churn risk) and signups that never did
    // anything (activation failures). Thresholds in days.
    const AT_RISK_DAYS = 30;
    const NEVER_ACTIVATED_DAYS = 7;
    const dormant = (r: ReportRow) => {
      const d = daysSince(r.lastActiveAt);
      return d === null || d >= AT_RISK_DAYS;
    };
    const atRiskPaid = rows
      .filter((r) => r.isPaid && dormant(r))
      .map((r) => ({
        email: r.email,
        displayName: r.displayName,
        emailDomain: r.emailDomain,
        tier: r.tier,
        lastActiveAt: r.lastActiveAt,
        daysSinceActive: daysSince(r.lastActiveAt),
      }))
      .sort(
        (a, b) => (b.daysSinceActive ?? 9999) - (a.daysSinceActive ?? 9999),
      );
    const neverActivated = rows
      .filter(
        (r) =>
          !r.isPaid &&
          r.searches === 0 &&
          r.profileViews === 0 &&
          r.reviewCount === 0 &&
          (daysSince(r.createdAt) ?? 0) >= NEVER_ACTIVATED_DAYS,
      )
      .map((r) => ({
        email: r.email,
        displayName: r.displayName,
        emailDomain: r.emailDomain,
        isBusinessEmail: r.isBusinessEmail,
        createdAt: r.createdAt,
        daysSinceSignup: daysSince(r.createdAt),
      }))
      .sort(
        (a, b) => (b.daysSinceSignup ?? 0) - (a.daysSinceSignup ?? 0),
      );

    return {
      rows,
      campaigns,
      roles,
      emailTypes,
      regions,
      accounts,
      funnel,
      engagementConversion,
      atRiskPaid,
      neverActivated,
      totalUsers: rows.length,
      attributedUsers: attributed,
      businessEmailUsers: rows.filter((r) => r.isBusinessEmail).length,
      roleAnsweredUsers: rows.filter((r) => r.marketingRole).length,
      generatedAt: new Date().toISOString(),
    };
  },
);
