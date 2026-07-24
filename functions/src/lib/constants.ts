export const DEFAULT_NOTIFICATION_EMAIL = "notifications@dealecho.io";
export const ENTERPRISE_PRICE_ENV = 'STRIPE_ENTERPRISE_PRICE_ID';

/**
 * Canonical base for email links. dealecho.io 307-redirects to www; email
 * clients (notably Outlook) will not follow a redirect on an <img>, so the
 * logo — and every other link — points straight at www to avoid the hop.
 */
export const APP_URL = "https://www.dealecho.io";
export const CONTROL_CENTRE_URL = `${APP_URL}/control-centre`;
export const SEARCH_URL = `${APP_URL}/search`;

// Rasterised from brand-assets/logo-lockup-dark-bg.svg. Email clients strip SVG,
// so the header lockup has to ship as a PNG served from public/.
export const EMAIL_LOGO_URL = `${APP_URL}/email-logo-dark.png`;
export const NEW_REVIEW_URL = `${APP_URL}/review/new`;

// Mirrors CHROME_EXTENSION_URL in src/constants/dealData.ts.
// TODO: replace PLACEHOLDER_EXTENSION_ID once the listing is published.
export const CHROME_EXTENSION_URL =
  "https://chrome.google.com/webstore/detail/dealecho-sales-intelligence/PLACEHOLDER_EXTENSION_ID";
