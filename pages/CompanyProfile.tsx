import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { Company, Review } from "../types";
import { getAICompanyPersona, CompanyPersona } from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";
import { useSEO } from "../src/hooks/useSEO";
import Icon from "../src/components/Icon";
import ScoreRing from "../src/components/ScoreRing";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";

interface CompanyProfileProps {
  user: any;
  isPaid: boolean;
  onSignInClick: () => void;
  reviews: Review[];
  allTrackedIds: string[];
  onToggleTrack: (id: string) => void;
}

const RATING_DEFINITIONS: Record<string, string[]> = {
  Responsiveness: [
    "Ghosting (No replies)",
    "Poor (High latency)",
    "Average (Standard)",
    "Good (Proactive)",
    "Elite (Immediate)",
  ],
  "Negotiation Ease": [
    "Brutal (Aggressive)",
    "Difficult (Friction)",
    "Fair (Standard)",
    "Smooth (Flexible)",
    "Instant (No redlines)",
  ],
  "Buyer Intent": [
    "Tire Kicker (Benchmarking)",
    "Exploratory (Curious)",
    "Validated (Budgeted)",
    "Strategic (Priority)",
    "Critical (Urgent)",
  ],
  "Scope Maturity": [
    "Volatile (Shifting)",
    "Vague (Undefined)",
    "Consistent (Stable)",
    "Structured (Clear)",
    "Crystal (SOW Ready)",
  ],
};

const CompanyProfile: React.FC<CompanyProfileProps> = ({
  user,
  isPaid,
  onSignInClick,
  reviews,
  allTrackedIds,
  onToggleTrack,
}) => {
  const { companyId } = useParams<{ companyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(
    location.state?.company || null,
  );
  const [aiPersona, setAiPersona] = useState<CompanyPersona | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const [showReviewRuleModal, setShowReviewRuleModal] = useState(false);

  // Mapping TCV bracket strings to numeric order for sorting
  const TCV_ORDER: Record<string, number> = {
    "< $10k": 1,
    "$10k - $25k": 2,
    "$25k - $50k": 3,
    "$50k - $100k": 4,
    "$100k - $250k": 5,
    "$250k - $500k": 6,
    "$500k - $750k": 7,
    "$750k - $1M": 8,
    "$1M+": 9,
  };

  useEffect(() => {
    if (companyId) {
      const matchingReview = reviews.find((r) => r.companyId === companyId);
      
      // If we don't have a company state, or if the current company name is just the ID (placeholder) and we found a matching review
      if (!company || (company.name === company.id && matchingReview && matchingReview.companyName !== matchingReview.companyId)) {
        const name = matchingReview?.companyName || decodeURIComponent(companyId);
        setCompany({
          id: companyId,
          name: name,
          industry: "Technology",
          country: "Global",
          description: "Enterprise target account.",
          logoUrl: companyLogoUrl({ name, domain: guessDomainFromName(name) }),
        });
      }
    }
  }, [companyId, company, reviews]);

  const companyReviews = useMemo(() => {
    if (!company) return [];
    return reviews.filter(
      (r) => r.companyId === company.id || r.companyName === company.name,
    );
  }, [reviews, company]);

  // Extract unique buying teams available in this company's reviews
  const availableTeams = useMemo(() => {
    const teams = new Set<string>();
    companyReviews.forEach((r) => r.buyingTeam.forEach((t) => teams.add(t)));
    return Array.from(teams).sort();
  }, [companyReviews]);

  // Filtered reviews based on user selection
  const filteredReviews = useMemo(() => {
    if (selectedTeam === "all") return companyReviews;
    return companyReviews.filter((r) => r.buyingTeam.includes(selectedTeam));
  }, [companyReviews, selectedTeam]);

  // Sorted reviews based on user selection
  const sortedReviews = useMemo(() => {
    const sorted = [...filteredReviews];
    switch (sortOrder) {
      case "newest":
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "deal-high":
        return sorted.sort((a, b) => (TCV_ORDER[b.tcvBracket] || 0) - (TCV_ORDER[a.tcvBracket] || 0));
      case "deal-low":
        return sorted.sort((a, b) => (TCV_ORDER[a.tcvBracket] || 0) - (TCV_ORDER[b.tcvBracket] || 0));
      default:
        return sorted;
    }
  }, [filteredReviews, sortOrder, TCV_ORDER]);

  // Aggregated Stats for Header
  const statsSummary = useMemo(() => {
    if (companyReviews.length === 0)
      return { healthIndex: 0, resp: 0, neg: 0, intent: 0, scope: 0 };
    const totals = companyReviews.reduce(
      (acc, r) => ({
        resp: acc.resp + r.communicationRating,
        neg: acc.neg + r.negotiationLevel,
        intent: acc.intent + r.timeWasterLevel,
        scope: acc.scope + (r.clarityOfScope || 3),
      }),
      { resp: 0, neg: 0, intent: 0, scope: 0 },
    );

    const count = companyReviews.length;
    return {
      healthIndex: Math.round(
        ((totals.resp + totals.neg + totals.intent + totals.scope) /
          (count * 20)) *
          100,
      ),
      resp: (totals.resp / count).toFixed(1),
      neg: (totals.neg / count).toFixed(1),
      intent: (totals.intent / count).toFixed(1),
      scope: (totals.scope / count).toFixed(1),
    };
  }, [companyReviews]);

  // Construct structured Google-friendly aggregate review schema (JSON-LD)
  const seoSchema = useMemo(() => {
    if (!company) return undefined;
    const count = companyReviews.length;
    const baseSchema: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": company.name,
      "description": company.description || `${company.name} target account overview and B2B sales intelligence.`,
      "url": window.location.href,
      "logo": company.logoUrl || companyLogoUrl({ name: company.name, domain: company.domain || guessDomainFromName(company.name) }) || "",
    };

    if (count > 0) {
      const averageRating = (
        (parseFloat(statsSummary.resp) +
         parseFloat(statsSummary.neg) +
         parseFloat(statsSummary.intent) +
         parseFloat(statsSummary.scope)) / 4
      ).toFixed(1);

      baseSchema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": averageRating,
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": count.toString(),
      };
    }
    return baseSchema;
  }, [company, companyReviews, statsSummary]);

  useSEO({
    title: company ? `${company.name} B2B Buyer Intelligence & Ratings | DealEcho` : "B2B Target Account Sales Intel | DealEcho",
    description: company 
      ? `Access verified sales reviews, aggregate buyer responsiveness, negotiation scores, and MEDDPICC buying team personas for ${company.name}.`
      : "Access B2B sales cycle insights, buyer personas, and MEDDPICC deal execution ratings for enterprise target accounts.",
    keywords: company ? `${company.name} sales, ${company.name} reviews, ${company.name} MEDDPICC, B2B sales intelligence` : "B2B sales intelligence, MEDDPICC, account planning",
    schema: seoSchema,
  });

  // Update AI Persona when the filtered set of reviews changes
  useEffect(() => {
    if (company && filteredReviews.length > 0) {
      // Synchronously check if cached to avoid loading spinner flash for instant premium experience!
      const reviewsSignature = filteredReviews
        .map((r) => `${r.id}_${r.createdAt}`)
        .sort()
        .join("|");
      const normalizedCompany = company.name.trim().toLowerCase();
      const cacheKey = `dealecho_persona_cache:${normalizedCompany}:${reviewsSignature}`;
      let isCached = false;
      try {
        isCached = !!sessionStorage.getItem(cacheKey);
      } catch (e) {
        // Fail silently
      }

      if (!isCached) {
        setIsAiLoading(true);
      }
      getAICompanyPersona(company.name, filteredReviews)
        .then(setAiPersona)
        .finally(() => setIsAiLoading(false));
    } else {
      setAiPersona(null);
    }
  }, [company, filteredReviews]);

  if (!company)
    return (
      <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest">
        Loading...
      </div>
    );

  const isTracking = allTrackedIds.includes(company.id);
  const isPro = isPaid;
  const hasReviews = companyReviews.length > 0;

  const handleTrackToggle = () => {
    if (!user) {
      onSignInClick();
    } else {
      onToggleTrack(company.id);
    }
  };

  const handleLeaveReview = () => {
    if (!user) {
      onSignInClick();
      return;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const hasRecentReview = companyReviews.some(
      (r) => r.userId === user.id && new Date(r.createdAt) > sixMonthsAgo
    );

    if (hasRecentReview) {
      setShowReviewRuleModal(true);
    } else {
      navigate("/review/new", { state: { prefilledCompany: company } });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      {/* Header Profile */}
      <div className="bg-white p-12 rounded-[48px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start md:space-x-12 relative">
        <CompanyLogo
          name={company.name}
          logoUrl={company.logoUrl}
          size="xl"
          className="shadow-inner relative z-10"
        />
        <div className="flex-grow w-full">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-2">
                {company.name}
              </h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                {company.industry} &bull; {company.country}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 relative">
              <div className="flex items-center gap-4">
                <ScoreRing score={hasReviews ? statsSummary.healthIndex : 0} size={72} showLabel />
                <div className="text-left">
                  <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                    Buyer health
                  </div>
                  <div className="text-sm text-slate-500 max-w-[200px] mt-1">
                    Aggregate account velocity and risk across {companyReviews.length} report
                    {companyReviews.length !== 1 ? "s" : ""}.
                  </div>
                </div>
              </div>

              <button
                onClick={handleTrackToggle}
                className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center ${
                  !user
                    ? "bg-slate-200 text-slate-500 hover:bg-slate-300"
                    : isTracking
                      ? "bg-emerald-500 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {!user && <Icon name="fa-lock" className="mr-2" size={10} />}
                {isTracking ? "Tracking Account" : "Track Account"}
              </button>

              <button
                onClick={handleLeaveReview}
                className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <Icon name="fa-pen" size={10} className="text-indigo-500" />
                Leave Review
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            <HeaderStat
              label="Responsiveness"
              value={hasReviews ? statsSummary.resp : "--"}
              color="emerald"
            />
            <HeaderStat
              label="Negotiation"
              value={hasReviews ? statsSummary.neg : "--"}
              color="amber"
            />
            <HeaderStat
              label="Buyer Intent"
              value={hasReviews ? statsSummary.intent : "--"}
              color="rose"
            />
            <HeaderStat
              label="Scope Clarity"
              value={hasReviews ? statsSummary.scope : "--"}
              color="indigo"
            />
          </div>

          <p className="text-slate-600 mt-10 text-lg leading-relaxed font-medium opacity-80 max-w-3xl">
            {company.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: Strategic Persona (Reacts to Filter) */}
        <div className="space-y-8">
          <div className="bg-[#101426] p-10 rounded-[40px] text-white relative overflow-hidden min-h-[400px] shadow-2xl border border-white/5">
            <h3 className="font-bold text-xl mb-6 flex items-center">
              <span className="w-2 h-2 bg-indigo-400 rounded-full mr-3"></span>
              {selectedTeam === "all"
                ? "Strategic Persona"
                : `${selectedTeam} Playbook`}
            </h3>

            {isPro ? (
              isAiLoading ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-4 bg-slate-800 rounded w-full"></div>
                  <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                  <div className="h-4 bg-slate-800 rounded w-4/6"></div>
                  <div className="space-y-3 pt-6">
                    <div className="h-2 bg-slate-800 rounded w-1/2"></div>
                    <div className="h-10 bg-slate-800 rounded w-full"></div>
                    <div className="h-2 bg-slate-800 rounded w-1/2"></div>
                    <div className="h-10 bg-slate-800 rounded w-full"></div>
                  </div>
                </div>
              ) : aiPersona ? (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <p className="text-slate-300 text-sm leading-relaxed italic border-l-2 border-indigo-500/40 pl-4">
                    "{aiPersona.summary}"
                  </p>

                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      {selectedTeam === "all"
                        ? "MEDDPICC Blueprint"
                        : `${selectedTeam} Strategic Drivers`}
                    </div>
                    <div className="grid gap-4">
                      {Object.entries(aiPersona.meddpicc)
                        .slice(0, selectedTeam === "all" ? 4 : 8)
                        .map(([k, v]) => (
                          <div key={k}>
                            <div className="text-[9px] font-black text-slate-500 uppercase">
                              {k.replace(/([A-Z])/g, " $1").trim()}
                            </div>
                            <div className="text-xs text-slate-300">{v}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  No data available to generate persona.
                </p>
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-[#101426]/95 backdrop-blur-xl z-20">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
                  <Icon name="fa-lock" className="text-white text-xl" size={20} />
                </div>
                <h4 className="font-bold text-lg mb-3">AI Account Persona</h4>
                <p className="text-[11px] text-slate-400 mb-8 leading-relaxed px-4">
                  Upgrade to Sales Pro to reveal AI-generated strategic
                  playbooks and MEDDPICC analysis.
                </p>
                <Link
                  to="/pricing"
                  className="bg-indigo-600 px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all w-full"
                >
                  Upgrade Plan
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Main Feed: Tactical Intelligence */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Intelligence Feed
                </h2>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedTeam === "all"
                    ? companyReviews.length
                    : filteredReviews.length}{" "}
                  Verified Reports
                  {selectedTeam !== "all" && ` for ${selectedTeam}`}
                </span>
              </div>

              {/* Sort Dropdown */}
              {hasReviews && (
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Sort by
                  </span>
                  <div className="relative">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-bold pl-4 pr-9 py-2.5 rounded-xl cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all shadow-sm"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="deal-high">Deal Size (High → Low)</option>
                      <option value="deal-low">Deal Size (Low → High)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <Icon name="fa-chevron-down" size={10} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Buying Team Filter Pill List */}
            {hasReviews && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTeam("all")}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedTeam === "all"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "bg-white text-slate-400 border border-slate-200 hover:border-indigo-200 hover:text-indigo-500"
                  }`}
                >
                  All Stakeholders
                </button>
                {availableTeams.map((team) => (
                  <button
                    key={team}
                    onClick={() => setSelectedTeam(team)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedTeam === team
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                        : "bg-white text-slate-400 border border-slate-200 hover:border-indigo-200 hover:text-indigo-500"
                    }`}
                  >
                    {team}
                  </button>
                ))}
              </div>
            )}
          </div>

          {sortedReviews.length > 0 ? (
            !isPro ? (
              /* Free users: gate only — no review content rendered at all */
              <div className="de-card p-10 md:p-14 text-center max-w-lg mx-auto border-t-4 border-t-accent bg-white">
                <div className="w-16 h-16 bg-accent-50 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl border border-accent-100">
                  <Icon name="fa-fingerprint" size={26} />
                </div>
                <h3 className="font-display text-xl font-semibold text-slate-900 mb-3">
                  Detailed deal mechanics
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Communication logs, buying-team dynamics, and contract friction across{" "}
                  {sortedReviews.length} verified report{sortedReviews.length !== 1 ? "s" : ""}{" "}
                  are reserved for Pro members.
                </p>
                <Link to="/pricing" className="de-btn-accent inline-block">
                  Unlock intelligence
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedReviews.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-8 md:p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                          <Icon name="fa-user-shield" size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-800 tracking-tight">
                            Verified User
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${r.status === "Won" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"}`}
                      >
                        Outcome: {r.status}
                      </div>
                    </div>

                    <p className="text-slate-600 text-base md:text-lg italic leading-relaxed font-medium bg-slate-50/50 p-6 rounded-[24px] border border-slate-50">
                      "{r.content}"
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-2">
                      <TacticalStars
                        label="Responsiveness"
                        value={r.communicationRating}
                        color="text-emerald-500"
                      />
                      <TacticalStars
                        label="Negotiation Ease"
                        value={r.negotiationLevel}
                        color="text-amber-500"
                      />
                      <TacticalStars
                        label="Buyer Intent"
                        value={r.timeWasterLevel}
                        color="text-rose-500"
                      />
                      <TacticalStars
                        label="Scope Maturity"
                        value={r.clarityOfScope || 3}
                        color="text-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-slate-50">
                      <div className="text-center md:text-left">
                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">
                          TCV Range
                        </div>
                        <div className="text-[11px] font-black text-slate-600 uppercase">
                          {r.tcvBracket}
                        </div>
                      </div>
                      <div className="text-center md:text-left">
                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">
                          Duration
                        </div>
                        <div className="text-[11px] font-black text-slate-600 uppercase">
                          {r.cycleDuration}
                        </div>
                      </div>
                      <div className="text-center md:text-left">
                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">
                          Tender
                        </div>
                        <div className="text-[11px] font-black text-slate-600 uppercase">
                          {r.isTender ? "Yes" : "Direct"}
                        </div>
                      </div>
                      <div className="text-center md:text-left">
                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">
                          Buying Team
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.buyingTeam.map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="bg-white p-12 md:p-16 rounded-[48px] border-2 border-dashed border-slate-200 text-center space-y-8 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center shadow-inner mb-2 border border-indigo-100/50">
                <Icon name="fa-filter" size={30} />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  No data for this filter.
                </h3>
                <p className="text-slate-500 text-sm md:text-base font-medium max-w-sm mx-auto leading-relaxed">
                  Try clearing the filter or documenting your own sales cycle
                  mechanics to build the intelligence layer for this stakeholder
                  group.
                </p>
              </div>
              <button
                onClick={() => setSelectedTeam("all")}
                className="bg-[#0f172a] text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review Rule Modal */}
      {showReviewRuleModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] p-10 md:p-16 max-w-xl w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300 text-center space-y-10">
            <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[32px] flex items-center justify-center mx-auto shadow-inner border border-rose-100/50">
              <Icon name="fa-history" size={36} />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                Review Policy
              </h3>
              <p className="text-slate-500 text-lg font-medium leading-relaxed">
                To maintain the integrity of our intelligence network, users can only leave <span className="text-slate-900 font-bold">one review per company every 6 months</span>.
              </p>
              <p className="text-slate-400 text-sm font-medium">
                Your last review for {company.name} was submitted recently. You can contribute to a different target account or check back later.
              </p>
            </div>

            <button
              onClick={() => setShowReviewRuleModal(false)}
              className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const HeaderStat: React.FC<{
  label: string;
  value: string | number;
  color: string;
}> = ({ label, value, color }) => {
  const colors: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-50 border-emerald-100",
    amber: "text-amber-500 bg-amber-50 border-amber-100",
    rose: "text-rose-500 bg-rose-50 border-rose-100",
    indigo: "text-indigo-500 bg-indigo-50 border-indigo-100",
  };
  return (
    <div
      className={`p-4 rounded-2xl border ${colors[color]} flex flex-col items-center justify-center text-center`}
    >
      <div className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">
        {label}
      </div>
      <div className="text-lg font-black">
        {value}
        {typeof value === "number" || !isNaN(Number(value)) ? "/5" : ""}
      </div>
    </div>
  );
};

const TacticalStars: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const definitions = RATING_DEFINITIONS[label] || [];

  return (
    <div className="relative group">
      <div className="flex justify-between items-center mb-1">
        <div
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-help border-b border-dashed border-slate-200"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {label}
        </div>
      </div>
      <div
        className="flex items-center space-x-1 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name="fa-star"
            size={14}
            className={`transition-all duration-300 ${star <= value ? color : "text-slate-100"}`}
          />
        ))}
        <span className="text-[11px] font-black text-slate-900 ml-2">
          {value}/5
        </span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-3 w-64 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3 pb-2 border-b border-slate-700">
            {label} Logic
          </h4>
          <div className="space-y-2">
            {definitions.map((def, idx) => (
              <div
                key={idx}
                className={`flex items-center space-x-3 ${idx + 1 === value ? "opacity-100" : "opacity-40"}`}
              >
                <div className="flex items-center space-x-0.5 min-w-[35px] text-[7px] text-slate-400">
                  <span className="text-[9px] font-black text-white">{idx + 1}</span>
                  <Icon name="fa-star" size={8} />
                </div>
                <div className="text-[10px] font-medium leading-tight text-slate-300">
                  {def}
                </div>
                {idx + 1 === value && (
                  <Icon name="fa-check-circle" className="text-indigo-500" size={10} />
                )}
              </div>
            ))}
          </div>
          <div className="absolute top-full left-6 w-3 h-3 bg-slate-900 rotate-45 -mt-1.5"></div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfile;
