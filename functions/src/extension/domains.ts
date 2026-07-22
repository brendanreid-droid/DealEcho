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

/**
 * Normalize any URL or hostname to a stable lookup key: strip protocol, path/query
 * and a leading "www.". We deliberately KEEP the full remaining host rather than
 * slicing to the last two labels — slicing collapses multi-part TLDs (e.g. every
 * "*.com.au" → "com.au"), which would map unrelated companies to one cache key.
 */
export function registrableDomain(input: string): string {
  if (!input) return "";
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, ""); // strip protocol
  host = host.split("/")[0].split("?")[0]; // strip path + query
  host = host.replace(/^www\./, ""); // strip leading www.
  return host;
}

/** True when the host belongs to a CRM/SaaS app rather than a prospect's own site. */
export function isCrmHost(input: string): boolean {
  const host = input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").split("/")[0];
  return CRM_HOSTS.some((crm) => host === crm || host.endsWith("." + crm));
}

/**
 * Domain that is SAFE to show a favicon for in the panel header.
 * Only the domain-resolution path qualifies: an explicit name means the page
 * the name was found on (a CRM, news site, dealecho itself) is usually NOT the
 * company's own site, and CRM hosts are never the prospect. Null = the client
 * shows an initials avatar instead.
 */
export function logoDomain(
  domain: string | undefined,
  name: string | undefined,
): string | null {
  if (name && name.trim()) return null;
  if (!domain || isCrmHost(domain)) return null;
  return registrableDomain(domain) || null;
}
