import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
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

    const rows: ReportRow[] = listResult.users.map((u) => {
      const fs = fsMap[u.uid] ?? {};
      const acq = fs.acquisition ?? {};
      const ft = acq.firstTouch ?? {};
      const lt = acq.lastTouch ?? {};
      const role =
        (fs.role as UserRole) ?? (u.customClaims?.role as UserRole) ?? "free";
      const tier =
        (fs.tier as string) ?? (u.customClaims?.tier as string) ?? "free";
      return {
        uid: u.uid,
        email: u.email ?? "",
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

    return {
      rows,
      campaigns,
      totalUsers: rows.length,
      attributedUsers: attributed,
      generatedAt: new Date().toISOString(),
    };
  },
);
