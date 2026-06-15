import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import CompanyCard, { CompanyCardData } from "../src/components/CompanyCard";
import IntelTicker from "../src/components/IntelTicker";
import { CardGridSkeleton } from "../src/components/Skeleton";

interface HomeProps {
  user: any;
  isPaid: boolean;
  onSignInClick: () => void;
  reviewSummaries: ReviewSummary[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

/** Animated count-up number. Respects reduced motion by jumping to final value. */
const CountUp: React.FC<{ end: number; className?: string }> = ({
  end,
  className,
}) => {
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setVal(end);
      return;
    }
    const t0 = performance.now();
    const dur = 1400;
    const step = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setVal(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end]);

  return <span className={className}>{val.toLocaleString()}</span>;
};

const Home: React.FC<HomeProps> = ({
  isPaid,
  reviewSummaries,
  isLoading,
}) => {
  useSEO({
    title: "DealEcho - Crowdsourced B2B Sales Intelligence & Account Insights",
    description:
      "Access verified B2B buyer intelligence, aggregate sales execution ratings, stakeholder buying team personas, and real customer-side feedback for elite tech accounts.",
    keywords:
      "B2B sales intelligence, MEDDPICC, buying teams, account planning, sales feedback, DealEcho",
  });

  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search)}`);
  };

  // Aggregate summaries into company cards
  const companies: CompanyCardData[] = useMemo(() => {
    const stats: Record<string, any> = {};
    reviewSummaries.forEach((s) => {
      const name = s.companyName;
      if (!stats[name]) {
        stats[name] = {
          id: s.companyId,
          name: s.companyName,
          industry: s.industry,
          location: s.location,
          count: 0,
          respTotal: 0,
          negTotal: 0,
          wasteTotal: 0,
          scopeTotal: 0,
          lastDate: s.createdAt,
          excerpt: s.excerpt,
        };
      }
      stats[name].count++;
      stats[name].respTotal += s.communicationRating;
      stats[name].negTotal += s.negotiationLevel;
      stats[name].wasteTotal += s.timeWasterLevel;
      stats[name].scopeTotal += s.clarityOfScope || 3;
      if (new Date(s.createdAt) > new Date(stats[name].lastDate)) {
        stats[name].lastDate = s.createdAt;
        stats[name].excerpt = s.excerpt;
      }
    });

    return Object.values(stats)
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime(),
      )
      .map((c) => {
        const avgResp = c.respTotal / c.count;
        const avgNeg = c.negTotal / c.count;
        const avgWaste = c.wasteTotal / c.count;
        const avgScope = c.scopeTotal / c.count;
        const domain =
          c.name.toLowerCase().replace(/\s/g, "").replace(/\./g, "") + ".com";
        return {
          id: c.id,
          name: c.name,
          industry: c.industry,
          location: c.location,
          reports: c.count,
          excerpt: c.excerpt,
          logoUrl: `https://logo.clearbit.com/${domain}`,
          healthIndex: Math.round(
            ((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100,
          ),
          responsiveness: Math.round(avgResp * 20),
          negotiation: Math.round(avgNeg * 20),
          buyerIntent: Math.round(avgWaste * 20),
          scopeClarity: Math.round(avgScope * 20),
        };
      });
  }, [reviewSummaries]);

  const accountsCovered = companies.length;

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-b from-navy-900 to-navy-800 text-white pt-20 px-6 overflow-hidden">
        {/* glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(640px 320px at 50% -8%, rgba(99,102,241,.22), transparent 70%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-signal-healthy-bright mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
            Live · {reviewSummaries.length.toLocaleString()} verified deal reports
          </div>
          <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.06] tracking-tight mb-5">
            Know the buyer before
            <br />
            the <span className="text-accent-soft">first call.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mx-auto mb-9 leading-relaxed">
            Crowdsourced intelligence from real enterprise sales cycles — see
            how target accounts actually buy before you spend a quarter finding
            out.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <svg
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Look up any account — try “Atlassian”"
                aria-label="Company lookup"
                className="w-full rounded-card bg-white text-slate-900 placeholder-slate-400 pl-12 pr-32 py-4 text-base shadow-hero focus:outline-none focus:ring-4 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-accent text-white px-6 rounded-control font-bold text-sm hover:bg-accent-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>

          {/* Count-up stats */}
          <div className="flex flex-wrap justify-center gap-x-14 gap-y-6 py-12">
            {[
              { n: reviewSummaries.length, l: "Verified reports" },
              { n: accountsCovered, l: "Accounts covered" },
              { n: 38, l: "Industries" },
              { n: 92, l: "% seller-verified" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <CountUp
                  end={s.n}
                  className="font-display font-bold text-3xl text-white"
                />
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ticker seam between dark hero and light body */}
        <div className="relative -mx-6">
          <IntelTicker summaries={reviewSummaries} />
        </div>
      </section>

      {/* ── Feed ── */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display font-semibold text-[26px] tracking-tight flex items-center gap-3">
            Recent intelligence
            <span className="font-mono text-2xs text-signal-healthy border border-emerald-200 bg-emerald-50 rounded-md px-2 py-0.5 tracking-[0.1em] inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy animate-pulse-soft" />
              LIVE
            </span>
          </h2>
        </div>
        <p className="text-slate-500 text-sm mb-7">
          Freshly analysed accounts from the seller community.
        </p>

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : companies.length === 0 ? (
          <div className="de-card p-12 text-center">
            <p className="text-slate-600 font-medium">
              No accounts yet. Be the first to{" "}
              <button
                onClick={() => navigate("/write-review")}
                className="text-accent font-semibold underline-offset-2 hover:underline"
              >
                share intel
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} isPro={isPaid} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
