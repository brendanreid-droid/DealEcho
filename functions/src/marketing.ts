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
 */
export const recordAcquisition = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  const uid = request.auth.uid;

  const firstTouch = sanitizeTouch(request.data?.firstTouch);
  const lastTouch = sanitizeTouch(request.data?.lastTouch);
  if (!firstTouch && !lastTouch) {
    return { status: "skipped", reason: "no attribution data" };
  }

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = (snap.exists ? snap.data()?.acquisition : undefined) ?? {};

  const nowIso = new Date().toISOString();
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

  await userRef.set({ acquisition }, { merge: true });
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
  searches: number;
  profileViews: number;
  reviewCount: number;
  topIndustries: string;
  lastActiveAt: string;
  createdAt: string;
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
      return {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName ?? "",
        emailDomain: domain,
        isBusinessEmail: isBusinessDomain(domain),
        marketingRole: (mp.role as string) ?? "",
        companySize: (mp.companySize as string) ?? "",
        searches: (behavior.searches as number) ?? 0,
        profileViews: (behavior.profileViews as number) ?? 0,
        reviewCount: reviewCounts[u.uid] ?? 0,
        topIndustries: topIndustries(behavior.industries, 3),
        lastActiveAt: (behavior.lastActiveAt as string) ?? "",
        createdAt: u.metadata.creationTime ?? "",
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
        industryCounts: {},
        lastSignupAt: "",
        users: [],
      });
      a.signups += 1;
      if (r.isPaid) a.paid += 1;
      a.searches += r.searches;
      a.profileViews += r.profileViews;
      a.reviews += r.reviewCount;
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
      .sort(
        (a, b) =>
          b.signups - a.signups || (a.lastSignupAt < b.lastSignupAt ? 1 : -1),
      );

    return {
      rows,
      campaigns,
      roles,
      emailTypes,
      accounts,
      totalUsers: rows.length,
      attributedUsers: attributed,
      businessEmailUsers: rows.filter((r) => r.isBusinessEmail).length,
      roleAnsweredUsers: rows.filter((r) => r.marketingRole).length,
      generatedAt: new Date().toISOString(),
    };
  },
);
