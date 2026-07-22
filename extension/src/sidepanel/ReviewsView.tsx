import { CSSProperties, Fragment, ReactNode, useState } from "react";
import { LookupResult, MetricScores, issueCustomToken } from "../lib/api";
import { theme, healthColor, statusColor } from "./theme";
import { buildFlags, FLAG_LABELS } from "./flags";
import { CompanyLogo } from "./CompanyLogo";

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

const HEALTH_HINT = "Overall health index (0–100), derived from the average rating.";

/** ISO string → "Feb 12, 2026". Falls back to the raw value if unparseable. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

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

/** Slim labelled section with a top rule — used for persona, red flags, and reviews. */
function Section({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0" }}>
      <div style={{ fontSize: 8, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NoMatchView({ reviewUrl }: { reviewUrl: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const token = await issueCustomToken();
      // Token travels in the URL fragment, never the query string: fragments are not
      // sent to the server, so they can't appear in hosting logs or analytics.
      const bridge = `${CARD_URL}/auth-bridge#ct=${encodeURIComponent(token)}&redirect=${encodeURIComponent(reviewUrl.replace(CARD_URL, ""))}`;
      window.open(bridge, "_blank");
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
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: theme.ink,
        background: "#fafbfc",
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `2px solid ${theme.navy}`,
          paddingBottom: 10,
          marginBottom: 10,
        }}
      >
        <CompanyLogo name={companyName ?? ""} domain={result.matchedDomain} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: theme.navy, letterSpacing: 0.3, textTransform: "uppercase" }}>
            {companyName}
          </div>
          {summary && (
            <div style={{ fontSize: 9, color: theme.faint, fontWeight: 600 }}>
              {summary.reviewCount} review{summary.reviewCount !== 1 ? "s" : ""} · avg rating {summary.rating.toFixed(1)}/5
            </div>
          )}
        </div>
        {summary && (
          <Tip text={HEALTH_HINT} style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: healthColor(summary.healthIndex) }}>
              {summary.healthIndex}
            </div>
            <div style={{ fontSize: 8, color: theme.faint, fontWeight: 700, textTransform: "uppercase" }}>Health</div>
          </Tip>
        )}
      </div>

      {summary?.metrics && (
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            {[[METRICS[0], METRICS[2]], [METRICS[1], METRICS[3]]].map(([left, right]) => (
              <tr key={left.key}>
                {[left, right].map((m) => (
                  <Fragment key={m.key}>
                    <td style={{ color: theme.sub, padding: "3px 0" }}>
                      <Tip text={m.hint} style={{ display: "inline-block" }}>{m.label}</Tip>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: healthColor(summary.metrics![m.key] * 20), paddingLeft: 8 }}>
                      {summary.metrics![m.key].toFixed(1)}
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {persona?.summary && (
        <Section label="Buyer persona" color={theme.accent}>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: theme.ink }}>{persona.summary}</div>
        </Section>
      )}

      {flags.length > 0 && (
        <Section label={`⚑ ${flags.length} red flag${flags.length !== 1 ? "s" : ""}`} color={theme.risk}>
          {flags.map((f) => (
            <div key={f.type} style={{ fontSize: 11, color: theme.ink, marginBottom: 3 }}>
              {FLAG_LABELS[f.type]} · <span style={{ color: theme.sub }}>{f.severity} · {f.reviewIds.length} report{f.reviewIds.length !== 1 ? "s" : ""}</span>
              {f.evidence && (
                <div style={{ fontSize: 10, fontStyle: "italic", color: theme.sub }}>"{f.evidence}"</div>
              )}
            </div>
          ))}
        </Section>
      )}

      {isPro ? (
        <Section label="Recent reviews" color={theme.faint}>
          {(recentReviews ?? []).map((r) => {
            const metaParts = [r.dealType, r.dealRegion, r.tcvBracket, r.dealPeriod ?? formatDate(r.createdAt)]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={r.id} style={{ fontSize: 11, lineHeight: 1.55, color: theme.ink, marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: statusColor(r.status), textTransform: "uppercase" }}>
                  {r.status}
                </span>
                {metaParts && <span style={{ color: theme.sub }}> · {metaParts}</span>}
                <div
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  "{r.content}"
                </div>
                <div style={{ fontSize: 10, color: theme.sub, marginTop: 2, display: "flex", gap: 0 }}>
                  {METRICS.map((m, i) => (
                    <Tip key={m.key} text={m.hint} style={{ display: "inline-block" }}>
                      <span>{i > 0 ? " · " : ""}{m.short} {r[m.key]}</span>
                    </Tip>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
          <a href="https://www.dealecho.io/pricing" target="_blank" rel="noreferrer" style={primaryBtn}>
            Upgrade to see reviews →
          </a>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 4, paddingTop: 8 }}>
        <a
          href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: theme.accent, fontSize: 11, fontWeight: 700, textDecoration: "none" }}
        >
          View full company card →
        </a>
      </div>
    </div>
  );
}
