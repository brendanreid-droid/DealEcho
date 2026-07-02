import { CSSProperties, ReactNode, useState } from "react";
import { LookupResult, MetricScores, issueCustomToken } from "../lib/api";
import { theme, healthColor, statusColor } from "./theme";
import { buildFlags, FLAG_LABELS } from "./flags";

const CARD_URL = "https://www.dealecho.io";

// The four review elements (each 1–5, high = good). Labels + hover hints match the
// web app's review form (star tooltips run low→high).
const METRICS: { key: keyof MetricScores; label: string; short: string; hint: string }[] = [
  {
    key: "communicationRating",
    label: "Responsiveness",
    short: "Resp",
    hint: "How responsive the buyer was (1–5). 1 = Ghosting, 5 = Elite.",
  },
  {
    key: "negotiationLevel",
    label: "Negotiation",
    short: "Neg",
    hint: "How easy negotiation was (1–5). 1 = Brutal, 5 = Instant.",
  },
  {
    key: "timeWasterLevel",
    label: "Buyer intent",
    short: "Intent",
    hint: "Seriousness of buyer intent (1–5). 1 = Tire kicker, 5 = Critical.",
  },
  {
    key: "clarityOfScope",
    label: "Scope clarity",
    short: "Scope",
    hint: "How well-defined the scope was (1–5). 1 = Volatile, 5 = Crystal clear.",
  },
];

const RATING_HINT = "Average of all four review scores (1–5). Higher is better.";
const HEALTH_HINT = "Overall health index (0–100), derived from the average rating.";
const REVIEWS_HINT = "Number of reviews submitted for this company on dealecho.";

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

const unit: CSSProperties = { fontSize: 11, fontWeight: 600, color: theme.faint };

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

const tipPopup: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginTop: 6,
  background: theme.navy,
  color: theme.white,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.4,
  padding: "6px 9px",
  borderRadius: 6,
  width: 150,
  textAlign: "center",
  zIndex: 30,
  boxShadow: "0 6px 16px rgba(16,20,38,0.25)",
  pointerEvents: "none",
};

/** Hover tooltip — a styled popup (native `title` is unreliable inside the panel). */
function Tip({ text, children, style }: { text: string; children: ReactNode; style?: CSSProperties }) {
  const [show, setShow] = useState(false);
  return (
    <div
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative", cursor: "help", ...style }}
    >
      {children}
      {show && <div style={tipPopup}>{text}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
  hint,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
  hint: string;
}) {
  return (
    <Tip text={hint} style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? theme.navy }}>
        {value}
        {suffix && <span style={unit}>{suffix}</span>}
      </div>
      <div style={eyebrow}>{label}</div>
    </Tip>
  );
}

/** Aggregate metric with a labelled bar (value out of 5). */
function MetricBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <Tip text={hint}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: theme.sub }}>{label}</span>
        <span style={{ fontWeight: 700, color: theme.ink }}>
          {value.toFixed(1)}
          <span style={unit}>/5</span>
        </span>
      </div>
      <div style={{ height: 5, background: theme.border, borderRadius: 3 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: healthColor(value * 20),
            borderRadius: 3,
          }}
        />
      </div>
    </Tip>
  );
}

function NoMatchView({ reviewUrl }: { reviewUrl: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const token = await issueCustomToken();
      const sep = reviewUrl.includes("?") ? "&" : "?";
      window.open(`${reviewUrl}${sep}ct=${encodeURIComponent(token)}`, "_blank");
    } catch {
      window.open(reviewUrl, "_blank");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontSize: 14, color: theme.ink }}>
      <p style={{ marginTop: 0, color: theme.sub, fontSize: 13 }}>
        No reviews yet for this company on dealecho.
      </p>
      <button onClick={handleClick} disabled={busy} style={{ ...primaryBtn, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Opening…" : "Be the first to leave a review →"}
      </button>
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
    const baseReviewUrl =
      `${CARD_URL}/review/new` + (companyHint ? `?company=${encodeURIComponent(companyHint)}` : "");
    return <NoMatchView reviewUrl={baseReviewUrl} />;
  }

  const { companyName, summary, persona, isPro, recentReviews, companyId } = result;
  // Red flags from the available reviews (Pro sees the review set; same rules as the site).
  const flags = isPro && recentReviews ? buildFlags(recentReviews) : [];

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
          <Stat label="Rating" value={summary.rating.toFixed(1)} suffix="/5" hint={RATING_HINT} />
          <Stat
            label="Health"
            value={summary.healthIndex}
            suffix="/100"
            color={healthColor(summary.healthIndex)}
            hint={HEALTH_HINT}
          />
          <Stat
            label={summary.reviewCount === 1 ? "Review" : "Reviews"}
            value={summary.reviewCount}
            hint={REVIEWS_HINT}
          />
        </div>
      )}

      {summary?.metrics && (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ ...eyebrow, marginBottom: 8 }}>Score breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {METRICS.map((m) => (
              <MetricBar key={m.key} label={m.label} value={summary.metrics![m.key]} hint={m.hint} />
            ))}
          </div>
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

      {flags.length > 0 && (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ ...eyebrow, marginBottom: 6 }}>Red flags</div>
          <div style={{ display: "grid", gap: 8 }}>
            {flags.map((f) => {
              const color = f.severity === "critical" ? theme.risk : theme.caution;
              return (
                <div
                  key={f.type}
                  style={{
                    borderLeft: `3px solid ${color}`,
                    background: theme.white,
                    border: `1px solid ${theme.border}`,
                    borderLeftWidth: 3,
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>
                    {FLAG_LABELS[f.type]}
                    <span style={{ ...unit, color: theme.faint, marginLeft: 6 }}>
                      {f.severity} · {f.reviewIds.length} report{f.reviewIds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {f.evidence && (
                    <p style={{ fontSize: 11, fontStyle: "italic", color: theme.sub, margin: "3px 0 0" }}>
                      “{f.evidence}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
                <div style={{ fontSize: 13, color: theme.ink, marginBottom: 10 }}>{r.content}</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                    borderTop: `1px solid ${theme.border}`,
                    paddingTop: 8,
                  }}
                >
                  {METRICS.map((m) => (
                    <Tip key={m.key} text={m.hint} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: healthColor((r[m.key] || 0) * 20) }}>
                        {r[m.key]}
                        <span style={unit}>/5</span>
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: theme.faint,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        {m.short}
                      </div>
                    </Tip>
                  ))}
                </div>
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
