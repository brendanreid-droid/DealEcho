import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../firebase/config";

/**
 * Fire-and-forget behavioral signal for the marketing dashboard (searches,
 * profile views, industries). Signed-in users only; server aggregates counters
 * on the user doc via the recordActivity callable. Must never block or break
 * the UI - every path swallows errors.
 *
 * dedupeKey (optional): suppresses repeat sends for the same action within a
 * browser session, e.g. re-viewing the same company profile.
 */
export function recordActivity(
  type: "search" | "profile_view",
  industry?: string,
  dedupeKey?: string,
): void {
  try {
    if (!auth.currentUser) return;
    if (dedupeKey) {
      const k = `dealecho_activity_${type}_${dedupeKey}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    }
    const fn = httpsCallable(
      getFunctions(undefined, "australia-southeast1"),
      "recordActivity",
    );
    void fn({ type, ...(industry ? { industry } : {}) }).catch(() => {});
  } catch {
    /* activity capture must never break the app */
  }
}
