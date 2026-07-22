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

/** Review outcome colour. Mirrors the web app's ReviewCard badge mapping. */
export function statusColor(status: string): string {
  if (status === "Won") return theme.healthy;
  if (status === "Lost" || status === "No Decision") return theme.risk;
  if (status === "Withdrew") return theme.caution;
  if (status === "Ongoing") return theme.accent;
  return theme.sub;
}

/** The dealecho logo lockup — icon mark + wordmark, matching the brand SVG. */
export function Wordmark({ height = 28 }: { height?: number }) {
  return (
    <svg viewBox="0 0 340 96" xmlns="http://www.w3.org/2000/svg" style={{ height, width: "auto", display: "block" }}>
      <g transform="translate(8,14) scale(0.8)">
        <rect x="8" y="71" width="16" height="9" rx="2" fill="#0e1426" opacity="0.35" />
        <rect x="8" y="59" width="16" height="9" rx="2" fill="#0e1426" opacity="1" />
        <rect x="8" y="47" width="16" height="9" rx="2" fill="#0e1426" opacity="1" />
        <rect x="32" y="71" width="16" height="9" rx="2" fill="#4f46e5" opacity="0.35" />
        <rect x="32" y="59" width="16" height="9" rx="2" fill="#4f46e5" opacity="1" />
        <rect x="32" y="47" width="16" height="9" rx="2" fill="#4f46e5" opacity="1" />
        <rect x="32" y="35" width="16" height="9" rx="2" fill="#4f46e5" opacity="1" />
        <rect x="56" y="71" width="16" height="9" rx="2" fill="#818cf8" opacity="0.35" />
        <rect x="56" y="59" width="16" height="9" rx="2" fill="#818cf8" opacity="1" />
        <rect x="56" y="47" width="16" height="9" rx="2" fill="#818cf8" opacity="1" />
        <rect x="56" y="35" width="16" height="9" rx="2" fill="#818cf8" opacity="1" />
        <rect x="56" y="23" width="16" height="9" rx="2" fill="#818cf8" opacity="1" />
        <circle cx="64" cy="8" r="12" fill="#818cf8" opacity="0.25" />
        <circle cx="64" cy="8" r="8" fill="#818cf8" />
      </g>
      <text x="82" y="64" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="52" fill="#0e1426">
        deal<tspan fill="#4f46e5">echo</tspan>
      </text>
    </svg>
  );
}
