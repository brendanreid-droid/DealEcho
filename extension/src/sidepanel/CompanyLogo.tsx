import { CSSProperties, useState } from "react";
import { theme } from "./theme";

const tile: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 7,
  background: theme.white,
  border: `1px solid ${theme.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  flexShrink: 0,
};

/** "Datadog Inc" → "DI"; single word → single letter. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * 32px logo tile. Favicon (same Google service the web app uses) when a
 * logo-safe domain is known; initials avatar otherwise or on image error.
 */
export function CompanyLogo({ name, domain }: { name: string; domain?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (domain && !failed) {
    return (
      <div style={tile}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          width={22}
          height={22}
          alt=""
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return (
    <div style={{ ...tile, background: theme.accent50, border: `1px solid ${theme.accent100}` }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: theme.accent }}>{initials(name)}</span>
    </div>
  );
}
