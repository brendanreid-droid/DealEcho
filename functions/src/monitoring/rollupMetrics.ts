import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../lib/firebaseAdmin";
import { buildMetrics, deltas, MetricsUser, MetricsReview, MetricsSnapshot } from "./metrics";

/**
 * Daily product metrics, snapshotted to admin_metrics/{YYYY-MM-DD}.
 *
 * Scheduled rather than computed on demand for two reasons. The obvious one is
 * cost: every figure is an aggregate over all users and reviews, so computing
 * it per dashboard load scans both collections each time.
 *
 * The one that actually matters is history. "Active accounts this week vs last"
 * cannot be reconstructed after the fact - lastActiveAt only ever holds the
 * MOST RECENT value, so last week's active count is unrecoverable unless it was
 * written down at the time. Every day this does not run is a day of history
 * that cannot be backfilled.
 */

/** Read both collections once. Two scans per day, not two per dashboard load. */
async function collect(): Promise<{ users: MetricsUser[]; reviews: MetricsReview[] }> {
  const [usersSnap, reviewsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("reviews").get(),
  ]);

  return {
    users: usersSnap.docs.map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        tier: x["tier"],
        role: x["role"],
        subscriptionStatus: x["subscriptionStatus"] ?? null,
        behavior: { lastActiveAt: x["behavior"]?.lastActiveAt },
      };
    }),
    reviews: reviewsSnap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        userId: x["userId"],
        companyId: x["companyId"],
        createdAt: x["createdAt"],
        moderationStatus: x["moderationStatus"],
      };
    }),
  };
}

/** Compute today's snapshot and store it under its own date. */
export async function writeSnapshot(now = Date.now()): Promise<MetricsSnapshot> {
  const { users, reviews } = await collect();
  const snapshot = buildMetrics(users, reviews, now);
  // Keyed by date and merged, so a manual re-run replaces that day rather than
  // appending a second, conflicting record for it.
  await db.collection("admin_metrics").doc(snapshot.date).set(
    { ...snapshot, generatedAt: new Date(now).toISOString() },
    { merge: true },
  );
  return snapshot;
}

export const rollupMetrics = onSchedule(
  {
    schedule: "30 9 * * *", // 9:30am Sydney, after the 9am health check
    timeZone: "Australia/Sydney",
  },
  async () => {
    const snapshot = await writeSnapshot();
    console.log(
      `Metrics ${snapshot.date}: ${snapshot.users.total} users, ` +
        `${snapshot.active.last7} active(7d), ${snapshot.reviews.total} reviews, ` +
        `${snapshot.reviewers.sharePct}% have reviewed.`,
    );
  },
);

/**
 * Latest snapshot plus the movement since the one before it.
 *
 * Reads two documents regardless of how many users exist - the shape
 * adminGetAcquisitionReport should have had. That one calls listUsers(1000)
 * and then reads Firestore once per user, so it costs a read per account per
 * load and silently truncates at 1,001.
 */
export const adminGetMetrics = onCall({ cors: true }, async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }

  const snap = await db
    .collection("admin_metrics")
    .orderBy("date", "desc")
    .limit(2)
    .get();

  if (snap.empty) {
    // Before the first scheduled run. Compute one now so the panel is never
    // blank, but do not fabricate a comparison.
    const current = await writeSnapshot();
    return { current, previous: null, deltas: deltas(current, null), firstRun: true };
  }

  const [current, previous] = snap.docs.map((d) => d.data() as MetricsSnapshot);
  return {
    current,
    previous: previous ?? null,
    deltas: deltas(current, previous ?? null),
    firstRun: false,
  };
});
