import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Dealecho — Company Reviews",
  version: "0.1.0",
  description: "See Dealecho deal intelligence for any company, on prospect sites or in your CRM.",
  action: { default_title: "Dealecho" },
  background: { service_worker: "src/background.ts", type: "module" },
  // "tabs" lets the worker read the active tab's URL on tab-switch/navigation
  // (domain only, no page injection) so the panel refreshes as the user browses.
  permissions: ["activeTab", "scripting", "storage", "sidePanel", "tabs"],
  host_permissions: [
    "https://identitytoolkit.googleapis.com/*",
    "https://securetoken.googleapis.com/*",
    "https://australia-southeast1-dealecho-io-sales-intel-hub.cloudfunctions.net/*",
  ],
  side_panel: { default_path: "index.html" },
  icons: { "128": "public/icons/icon-128.png" },
});
