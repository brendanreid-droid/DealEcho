import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "DealEcho — Company Reviews",
  version: "0.1.0",
  description: "See DealEcho deal intelligence for any company, on prospect sites or in your CRM.",
  action: { default_title: "DealEcho" },
  background: { service_worker: "src/background.ts", type: "module" },
  permissions: ["activeTab", "scripting", "storage", "sidePanel"],
  side_panel: { default_path: "index.html" },
  icons: { "128": "public/icons/icon-128.png" },
});
