// Known CRM / SaaS hosts where the page domain is NOT the prospect company.
const CRM_HOSTS = [
  "salesforce.com",
  "force.com",
  "lightning.force.com",
  "hubspot.com",
  "pipedrive.com",
  "zoho.com",
  "dynamics.com",
];

/** Normalize any URL or hostname to its registrable domain (no protocol, no www, no subdomain). */
export function registrableDomain(input: string): string {
  if (!input) return "";
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, ""); // strip protocol
  host = host.split("/")[0]; // strip path
  host = host.split("?")[0];
  if (!host) return "";
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  // Keep the last two labels (good enough for .com/.io/.co; refine later if needed).
  return parts.slice(-2).join(".");
}

/** True when the host belongs to a CRM/SaaS app rather than a prospect's own site. */
export function isCrmHost(input: string): boolean {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split("/")[0];
  return CRM_HOSTS.some((crm) => host === crm || host.endsWith("." + crm));
}
