/**
 * Cookie-consent state.
 *
 * We set non-essential cookies (Google Analytics, marketing attribution) only
 * after the visitor has opted in. The choice is stored in a first-party cookie
 * scoped to the root domain (like attribution, so it survives across the
 * marketing site and app subdomains).
 *
 * Categories:
 *   - necessary  — always on, no consent required (auth, this consent record).
 *   - analytics  — Google Analytics 4 (_ga, _ga_* cookies).
 *   - marketing  — utm/referrer attribution (dealecho_attribution cookie).
 *
 * `getConsent()` returns null until the visitor has made a choice — that null
 * is the signal to show the banner. Every path is defensive: a broken cookie
 * must never crash the app or silently opt someone in.
 */

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

/** Bump when the categories change so returning visitors are re-asked. */
const VERSION = 1;
const COOKIE = "dealecho_consent";
const MAX_AGE_DAYS = 180;

/** Fired on the window whenever consent is saved, so live features (analytics)
 *  can react without a page reload. */
export const CONSENT_EVENT = "dealecho:consent-changed";

interface StoredConsent extends ConsentState {
  v: number;
  ts: string;
}

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
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const domain = rootDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/${domainPart}; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  const domain = rootDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  // Clear both the root-domain and host-only variants to be safe.
  document.cookie = `${name}=; Max-Age=0; Path=/${domainPart}`;
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

/** The visitor's saved choice, or null if they haven't chosen yet (or the
 *  stored version is stale). Null = show the banner. */
export function getConsent(): ConsentState | null {
  try {
    const raw = readCookie(COOKIE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.v !== VERSION) return null;
    return {
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

export function hasChoice(): boolean {
  return getConsent() !== null;
}

/** Persist a choice and notify listeners. Revoking analytics also clears the
 *  GA cookies that may already have been set. */
export function setConsent(state: ConsentState): void {
  try {
    const stored: StoredConsent = {
      v: VERSION,
      analytics: state.analytics,
      marketing: state.marketing,
      ts: new Date().toISOString(),
    };
    writeCookie(COOKIE, JSON.stringify(stored));
    if (!state.analytics) clearAnalyticsCookies();
    if (!state.marketing) deleteCookie("dealecho_attribution");
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  } catch {
    /* never let a consent write crash the app */
  }
}

/** Remove Google Analytics cookies (_ga and any _ga_* property cookies). */
function clearAnalyticsCookies(): void {
  try {
    const gaNames = document.cookie
      .split("; ")
      .map((c) => c.split("=")[0])
      .filter((n) => n === "_ga" || n.startsWith("_ga_") || n.startsWith("_gid") || n.startsWith("_gat"));
    for (const n of gaNames) deleteCookie(n);
  } catch {
    /* best effort */
  }
}

/** Convenience presets used by the banner buttons. */
export const ACCEPT_ALL: ConsentState = { analytics: true, marketing: true };
export const NECESSARY_ONLY: ConsentState = { analytics: false, marketing: false };
