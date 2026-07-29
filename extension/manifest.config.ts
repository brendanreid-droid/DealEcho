import { defineManifest } from "@crxjs/vite-plugin";
import { readFileSync, existsSync } from "node:fs";

/**
 * The Web Store item's public key, which pins the extension ID.
 *
 * Without it, a locally loaded build gets a random ID that differs from the
 * published one - and since chrome.identity.getRedirectURL() derives the OAuth
 * redirect URI from that ID, dev and store builds need separately registered
 * URIs, which is how the redirect_uri_mismatch on launch day happened. With it,
 * an unpacked build loads as khcgfhbpiinaaanphfoefbamkbcjffpb and shares the
 * store build's redirect URI.
 *
 * The key is public (Chrome ships it inside every published .crx), so it is
 * safe in source control. It lives in a file rather than inline only because it
 * is 400+ characters of base64 that nobody should have to scroll past.
 *
 * Get it from: Web Store dashboard → the item → Package → "View public key".
 * Paste the base64 body (no BEGIN/END lines, no newlines) into extension-key.txt.
 */
const KEY_FILE = new URL("./extension-key.txt", import.meta.url).pathname;
const publicKey = existsSync(KEY_FILE) ? readFileSync(KEY_FILE, "utf8").trim() : "";

export default defineManifest({
  // Omitted rather than empty when absent: an empty `key` is a manifest error,
  // and a build without it still works - it just gets an unstable ID.
  ...(publicKey ? { key: publicKey } : {}),
  manifest_version: 3,
  name: "Dealecho - Sales Intelligence",
  version: "0.1.2",
  description: "See Dealecho deal intelligence for any company, on prospect sites or in your CRM.",
  action: {
    default_title: "Dealecho",
    default_icon: {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png",
      "48": "public/icons/icon-48.png",
    },
  },
  background: { service_worker: "src/background.ts", type: "module" },
  // "tabs" lets the worker read the active tab's URL on tab-switch/navigation
  // (domain only, no page injection) so the panel refreshes as the user browses.
  permissions: ["activeTab", "scripting", "storage", "sidePanel", "tabs", "contextMenus", "identity"],
  host_permissions: [
    "https://identitytoolkit.googleapis.com/*",
    "https://securetoken.googleapis.com/*",
    "https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net/*",
  ],
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'none'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net; frame-src 'none';",
  },
  side_panel: { default_path: "index.html" },
  icons: {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png",
  },
});
