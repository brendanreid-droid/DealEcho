export const DEFAULT_NOTIFICATION_EMAIL = "notifications@dealecho.io";
export const ENTERPRISE_PRICE_ENV = 'STRIPE_ENTERPRISE_PRICE_ID';

/**
 * Canonical base for email links. dealecho.io 307-redirects to www; email
 * clients (notably Outlook) will not follow a redirect on an <img>, so the
 * logo — and every other link — points straight at www to avoid the hop.
 */
export const APP_URL = "https://www.dealecho.io";

/**
 * Continue URL for Firebase Auth action links (password reset, invites).
 *
 * MUST be a domain on the project's Authorized Domains list, or
 * generatePasswordResetLink throws auth/unauthorized-continue-uri. Only
 * `www.dealecho.io` is listed - the apex `dealecho.io` is NOT, which is what
 * broke admin invites and custom password resets. Deliberately not read from
 * FRONTEND_URL: that variable is unset in CI and its apex default is the exact
 * value that fails.
 */
export const AUTH_ACTION_URL = APP_URL;
export const CONTROL_CENTRE_URL = `${APP_URL}/control-centre`;
export const SEARCH_URL = `${APP_URL}/search`;

// Rasterised from brand-assets/logo-lockup-dark-bg.svg. Email clients strip SVG,
// so the header lockup has to ship as a PNG served from public/.
export const EMAIL_LOGO_URL = `${APP_URL}/email-logo-dark.png`;
export const NEW_REVIEW_URL = `${APP_URL}/review/new`;

// Mirrors CHROME_EXTENSION_URL in src/constants/dealData.ts. Keep the two in
// step: the functions package can't import from the app's src/.
export const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/dealecho-sales-intelligen/khcgfhbpiinaaanphfoefbamkbcjffpb";
