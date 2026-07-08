import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Dealecho - Sales Intelligence",
  version: "0.1.0",
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
