/**
 * Marketing attribution capture.
 *
 * On every app load we read utm_* params + referrer from the URL and persist
 * them in a first-party cookie scoped to the root domain (so it survives if the
 * marketing site and app ever move to different subdomains). We keep BOTH:
 *   - firstTouch: set once, never overwritten (the campaign that first brought
 *     the visitor to the site).
 *   - lastTouch:  refreshed on every utm-tagged visit (the most recent campaign
 *     before an action such as signup).
 *
 * On signup, App.tsx reads these via getAttribution() and sends them to the
 * recordAcquisition callable, which writes them to the user's Firestore doc.
 * Attribution must never break the app: every path is wrapped in try/catch.
 */

export interface Touch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt?: string;
}

export interface Attribution {
  firstTouch?: Touch;
  lastTouch?: Touch;
}

const COOKIE = "dealecho_attribution";
const MAX_AGE_DAYS = 90;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Root domain for the cookie, e.g. app.dealecho.io -> ".dealecho.io".
 *  Returns "" on localhost / raw IP so the cookie stays host-only. */
function rootDomain(): string {
  const host = window.location.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return "." + host;
  return "." + parts.slice(-2).join(".");
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const domain = rootDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; Max-Age=${maxAge}; Path=/${domainPart}; SameSite=Lax`;
}

function parseTouchFromUrl(): Touch | null {
  const params = new URLSearchParams(window.location.search);
  const touch: Touch = {};
  let hasUtm = false;
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) {
      touch[k] = v.slice(0, 200);
      hasUtm = true;
    }
  }
  if (!hasUtm) return null; // no campaign tag on this visit
  const ref = document.referrer;
  if (ref) touch.referrer = ref.slice(0, 300);
  touch.landingPath = (
    window.location.pathname + window.location.search
  ).slice(0, 300);
  touch.capturedAt = new Date().toISOString();
  return touch;
}

/** Call once on app boot. Records a utm-tagged visit into the attribution cookie. */
export function captureAttribution(): void {
  try {
    const touch = parseTouchFromUrl();
    if (!touch) return; // nothing to record on this load
    const existing = getAttribution();
    const next: Attribution = {
      firstTouch: existing.firstTouch ?? touch, // immutable first touch
      lastTouch: touch, // always refresh last touch
    };
    writeCookie(COOKIE, JSON.stringify(next));
  } catch {
    /* attribution must never break the app */
  }
}

/** Read the stored attribution. Returns {} when absent or unparseable. */
export function getAttribution(): Attribution {
  try {
    const raw = readCookie(COOKIE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Attribution) : {};
  } catch {
    return {};
  }
}

/** True when we have any attribution worth sending to the server. */
export function hasAttribution(a: Attribution): boolean {
  return Boolean(a.firstTouch || a.lastTouch);
}
