// Brand tokens lifted from the web app (tailwind.config.js): Inter, accent indigo
// #4f46e5, navy #0e1426 for primary actions, emerald/amber/rose health bands.
export const theme = {
  navy: "#0e1426",
  accent: "#4f46e5",
  accentSoft: "#818cf8",
  accent50: "#eef2ff",
  accent100: "#e0e7ff",
  ink: "#1f2937",
  sub: "#6b7280",
  faint: "#9ca3af",
  border: "#e9ebf0",
  panel: "#f9fafb",
  white: "#ffffff",
  healthy: "#059669",
  caution: "#d97706",
  risk: "#e11d48",
  font: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

/** Health-index band colour (0–100), mirroring the site's healthy/caution/risk thresholds. */
export function healthColor(v: number): string {
  if (v >= 70) return theme.healthy;
  if (v >= 40) return theme.caution;
  return theme.risk;
}

/** Won = emerald, Lost = rose, anything else = muted. */
export function statusColor(status: string): string {
  if (status === "Won") return theme.healthy;
  if (status === "Lost") return theme.risk;
  return theme.sub;
}

/** The dealecho wordmark — "deal" in navy, "echo" in accent purple (matches the site header). */
export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: -0.3, color: theme.navy }}>
      deal<span style={{ color: theme.accent }}>echo</span>
    </span>
  );
}
