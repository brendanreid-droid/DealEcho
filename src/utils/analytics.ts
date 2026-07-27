import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import app from "../firebase/config";
import { getConsent } from "./consent";

let analytics: Analytics | null = null;
let ready: Promise<void> | null = null;

/** Lazily initialise Firebase Analytics, but ONLY once the visitor has opted in
 *  to analytics cookies. No-ops when consent is absent/declined, when analytics
 *  is unsupported (some corporate browsers), or when no measurement ID is set.
 *
 *  Re-checks consent on every call, so analytics starts as soon as the user
 *  accepts — no page reload needed. */
function ensureAnalytics(): Promise<void> {
  if (!getConsent()?.analytics) {
    // Not opted in (or opted out): make sure nothing is initialised.
    analytics = null;
    return Promise.resolve();
  }
  if (analytics) return Promise.resolve();
  if (!ready) {
    ready = isSupported()
      .then((ok) => {
        if (ok && getConsent()?.analytics && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
          analytics = getAnalytics(app);
        }
      })
      .catch(() => {
        // analytics must never break the app; allow a later retry
        ready = null;
      });
  }
  return ready;
}

export async function track(
  event: string,
  params?: Record<string, unknown>,
): Promise<void> {
  try {
    await ensureAnalytics();
    if (analytics) logEvent(analytics, event, params);
  } catch {
    /* swallow - analytics must never break the app */
  }
}
