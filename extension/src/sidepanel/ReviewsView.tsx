import { CSSProperties } from "react";
import { LookupResult } from "../lib/api";
import { theme, healthColor, statusColor } from "./theme";

const CARD_URL = "https://www.dealecho.io";

/** ISO string → "Feb 12, 2026". Falls back to the raw value if unparseable. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const eyebrow: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: theme.faint,
  fontWeight: 700,
};

const primaryBtn: CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "11px 12px",
  background: theme.navy,
  color: theme.white,
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 8,
  textDecoration: "none",
};

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? theme.navy }}>{value}</div>
      <div style={eyebrow}>{label}</div>
    </div>
  );
}

export function ReviewsView({
  result,
  companyHint,
}: {
  result: LookupResult;
  companyHint?: string;
}) {
  if (!result.matched) {
    const reviewUrl =
      `${CARD_URL}/review/new` + (companyHint ? `?company=${encodeURIComponent(companyHint)}` : "");
    return (
      <div style={{ fontSize: 14, color: theme.ink }}>
        <p style={{ marginTop: 0, color: theme.sub, fontSize: 13 }}>
          No reviews yet for this company on dealecho.
        </p>
        <a href={reviewUrl} target="_blank" rel="noreferrer" style={primaryBtn}>
          Be the first to leave a review →
        </a>
      </div>
    );
  }

  const { companyName, summary, persona, isPro, recentReviews, companyId } = result;

  return (
    <div style={{ fontSize: 14, lineHeight: 1.5, color: theme.ink }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.2, margin: "0 0 12px" }}>
        {companyName}
      </h2>

      {summary && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "12px 8px",
            background: theme.panel,
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            margin: "0 0 14px",
          }}
        >
          <Stat label="Rating" value={summary.rating.toFixed(1)} />
          <Stat label="Health" value={summary.healthIndex} color={healthColor(summary.healthIndex)} />
          <Stat label={summary.reviewCount === 1 ? "Review" : "Reviews"} value={summary.reviewCount} />
        </div>
      )}

      {persona?.summary && (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ ...eyebrow, marginBottom: 5 }}>Buyer persona</div>
          <p
            style={{
              background: theme.accent50,
              borderLeft: `3px solid ${theme.accent}`,
              padding: "10px 12px",
              borderRadius: 8,
              margin: 0,
              fontSize: 13,
              color: "#312e81",
            }}
          >
            {persona.summary}
          </p>
        </div>
      )}

      {isPro ? (
        <>
          <div style={{ ...eyebrow, marginBottom: 6 }}>Recent reviews</div>
          <div style={{ display: "grid", gap: 10 }}>
            {(recentReviews ?? []).map((r) => (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${theme.border}`,
                  borderRadius: 10,
                  padding: 12,
                  background: theme.white,
                  boxShadow: "0 1px 2px rgba(16,20,38,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontWeight: 700, color: statusColor(r.status) }}>{r.status}</span>
                  <span style={{ color: theme.faint }}>{formatDate(r.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: theme.ink }}>{r.content}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <a href="https://www.dealecho.io/pricing" target="_blank" rel="noreferrer" style={primaryBtn}>
          Upgrade to see reviews →
        </a>
      )}

      <p style={{ marginTop: 16, marginBottom: 0 }}>
        <a
          href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.accent, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          View full company card →
        </a>
      </p>
    </div>
  );
}
