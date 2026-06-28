import { LookupResult } from "../lib/api";

const CARD_URL = "https://www.dealecho.io";

export function ReviewsView({ result }: { result: LookupResult }) {
  if (!result.matched) {
    return <p style={{ fontSize: 14 }}>No reviews yet for this company on DealEcho.</p>;
  }

  const { companyName, summary, persona, isPro, recentReviews, companyId } = result;

  return (
    <div style={{ fontSize: 14, lineHeight: 1.5 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>{companyName}</h2>

      {summary && (
        <p style={{ margin: "0 0 8px", color: "#374151" }}>
          Rating <strong>{summary.rating.toFixed(1)}</strong> · Health{" "}
          <strong>{summary.healthIndex}</strong> · {summary.reviewCount} review
          {summary.reviewCount === 1 ? "" : "s"}
        </p>
      )}

      {persona?.summary && (
        <p style={{ background: "#f3f4f6", padding: 8, borderRadius: 6, margin: "0 0 8px" }}>
          {persona.summary}
        </p>
      )}

      {isPro ? (
        <div style={{ display: "grid", gap: 8 }}>
          {(recentReviews ?? []).map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {r.status} · {r.createdAt}
              </div>
              <div>{r.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <a
          href="https://www.dealecho.io/pricing"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", color: "#4f46e5", fontWeight: 600 }}
        >
          Upgrade to see reviews →
        </a>
      )}

      <p style={{ marginTop: 12 }}>
        <a
          href={companyId ? `${CARD_URL}/company/${companyId}` : CARD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#4f46e5" }}
        >
          View full company card →
        </a>
      </p>
    </div>
  );
}
