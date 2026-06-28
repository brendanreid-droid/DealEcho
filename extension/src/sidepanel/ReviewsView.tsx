import { LookupResult } from "../lib/api";

const CARD_URL = "https://www.dealecho.io";
const INDIGO = "#4f46e5";

/** ISO string → "Feb 12, 2026". Falls back to the raw value if unparseable. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: "#9ca3af" }}>
        {label}
      </div>
    </div>
  );
}

export function ReviewsView({ result }: { result: LookupResult }) {
  if (!result.matched) {
    return (
      <p style={{ fontSize: 14, color: "#6b7280" }}>
        No reviews yet for this company on DealEcho.
      </p>
    );
  }

  const { companyName, summary, persona, isPro, recentReviews, companyId } = result;

  return (
    <div style={{ fontSize: 14, lineHeight: 1.5, color: "#1f2937" }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 10px" }}>{companyName}</h2>

      {summary && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 8px",
            background: "#f9fafb",
            border: "1px solid #eef0f3",
            borderRadius: 8,
            margin: "0 0 12px",
          }}
        >
          <Stat label="Rating" value={summary.rating.toFixed(1)} />
          <Stat label="Health" value={summary.healthIndex} />
          <Stat label={summary.reviewCount === 1 ? "Review" : "Reviews"} value={summary.reviewCount} />
        </div>
      )}

      {persona?.summary && (
        <div style={{ margin: "0 0 14px" }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            Buyer persona
          </div>
          <p
            style={{
              background: "#f3f4f6",
              padding: 10,
              borderRadius: 8,
              margin: 0,
              fontSize: 13,
              color: "#374151",
            }}
          >
            {persona.summary}
          </p>
        </div>
      )}

      {isPro ? (
        <div style={{ display: "grid", gap: 10 }}>
          {(recentReviews ?? []).map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid #eef0f3",
                borderRadius: 8,
                padding: 10,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600, color: statusColor(r.status) }}>{r.status}</span>
                <span>{formatDate(r.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13 }}>{r.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <a
          href="https://www.dealecho.io/pricing"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            padding: "10px 12px",
            background: INDIGO,
            color: "#fff",
            fontWeight: 600,
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Upgrade to see reviews →
        </a>
      )}

      <p style={{ marginTop: 14 }}>
        <a
          href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: INDIGO, fontSize: 13, fontWeight: 600 }}
        >
          View full company card →
        </a>
      </p>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "Won") return "#15803d";
  if (status === "Lost") return "#b91c1c";
  return "#6b7280";
}
