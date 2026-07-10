import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import app from "../firebase/config";

let analytics: Analytics | null = null;
let ready: Promise<void> | null = null;

/** Lazily initialise Firebase Analytics. No-ops when unsupported
 *  (some corporate browsers) or when no measurement ID is configured. */
function init(): Promise<void> {
  if (!ready) {
    ready = isSupported()
      .then((ok) => {
        if (ok && import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
          analytics = getAnalytics(app);
        }
      })
      .catch(() => {
        /* analytics must never break the app */
      });
  }
  return ready;
}

export async function track(
  event: string,
  params?: Record<string, unknown>,
): Promise<void> {
  try {
    await init();
    if (analytics) logEvent(analytics, event, params);
  } catch {
    /* swallow - analytics must never break the app */
  }
}
