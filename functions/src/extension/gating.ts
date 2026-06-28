// Mirrors isPro() in firestore.rules. Keep these in sync.
const PRO_ROLES = ["paid", "admin", "free_full"];

export function isProRole(role: string | undefined | null): boolean {
  return !!role && PRO_ROLES.includes(role);
}
