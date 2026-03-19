import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { Company, Review } from "../types";
import { getAICompanyPersona, CompanyPersona } from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";

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
  const [isAggregateScoreHovered, setIsAggregateScoreHovered] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");

  useEffect(() => {
    if (!company && companyId) {
      setCompany({
        id: companyId,
        name: decodeURIComponent(companyId),
        industry: "Technology",
        country: "Global",
        description: "Enterprise target account.",
        logoUrl: `https://logo.clearbit.com/${decodeURIComponent(companyId).toLowerCase().replace(/\s/g, "")}.com`,
      });
    }
  }, [companyId, company]);

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

  // Update AI Persona when the filtered set of reviews changes
  useEffect(() => {
    if (company && filteredReviews.length > 0) {
      setIsAiLoading(true);
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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      {/* Header Profile */}
      <div className="bg-white p-12 rounded-[48px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center md:items-start md:space-x-12 relative z-[100]">
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
              <div
                className={`bg-slate-900 text-white px-8 py-4 rounded-[32px] text-center shadow-xl shadow-slate-200 border-t-4 border-t-indigo-500 relative ${hasReviews ? "cursor-help" : "opacity-40 cursor-not-allowed grayscale"}`}
                onMouseEnter={() =>
                  hasReviews && setIsAggregateScoreHovered(true)
                }
                onMouseLeave={() =>
                  hasReviews && setIsAggregateScoreHovered(false)
                }
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">
                  Buyer Score
                </div>
                <div className="text-3xl font-black">
                  {hasReviews ? `${statsSummary.healthIndex}%` : "--"}
                </div>

                {isAggregateScoreHovered && hasReviews && (
                  <div className="absolute top-full right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 mt-5 w-80 bg-slate-900 text-white p-7 rounded-[32px] shadow-[0_32_96px_-16px_rgba(0,0,0,0.6)] z-[110] animate-in fade-in slide-in-from-top-4 border border-white/10 text-left pointer-events-none">
                    <h4 className="text-[12px] font-black uppercase tracking-widest text-indigo-400 mb-4 border-b border-white/5 pb-3">
                      Strategic Intelligence Matrix
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-6 font-medium">
                      Aggregate identification of account velocity and risk
                      across {companyReviews.length} verified cycles:
                    </p>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Responsiveness
                        </span>
                        <span className="text-indigo-400 font-black text-xs">
                          {statsSummary.resp}/5.0
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Negotiation ease
                        </span>
                        <span className="text-amber-400 font-black text-xs">
                          {statsSummary.neg}/5.0
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Buyer Intent
                        </span>
                        <span className="text-rose-400 font-black text-xs">
                          {statsSummary.intent}/5.0
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Scope Maturity
                        </span>
                        <span className="text-emerald-400 font-black text-xs">
                          {statsSummary.scope}/5.0
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/5">
                      <div className="text-[9px] font-black text-indigo-300 uppercase leading-relaxed italic tracking-wide">
                        Scores above 80% indicate strategic accounts with high
                        procurement-readiness.
                      </div>
                    </div>
                    <div className="absolute bottom-full right-8 md:right-auto md:left-1/2 md:-translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 -mb-2"></div>
                  </div>
                )}
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
                {!user && <i className="fas fa-lock mr-2 text-[10px]"></i>}
                {isTracking ? "Tracking Account" : "Track Account"}
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
                  <i className="fas fa-lock text-white text-xl"></i>
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

          {filteredReviews.length > 0 ? (
            <div
              className={`relative p-2 rounded-[40px] transition-all duration-500 ${!isPro ? "bg-slate-100/80 border-2 border-dashed border-slate-200 overflow-hidden max-h-[600px]" : ""}`}
            >
              {!isPro && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6">
                  <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                  <div className="bg-white/95 backdrop-blur-lg p-8 md:p-12 rounded-[40px] border border-slate-200 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] text-center max-w-sm border-t-4 border-t-indigo-500 relative z-40 transform hover:scale-[1.02] transition-transform">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner border border-indigo-100/50">
                      <i className="fas fa-fingerprint"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-3">
                      Detailed Deal Mechanics
                    </h3>
                    <p className="text-slate-500 text-[14px] font-medium leading-relaxed mb-10">
                      Detailed communication logs, buying team dynamics, and
                      contract friction are reserved for Pro members.
                    </p>
                    <Link
                      to="/pricing"
                      className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all block"
                    >
                      Unlock Intelligence
                    </Link>
                  </div>
                </div>
              )}

              <div
                className={`space-y-6 transition-all duration-700 ${!isPro ? "filter blur-2xl opacity-40 pointer-events-none select-none scale-[0.98]" : ""}`}
              >
                {filteredReviews.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-8 md:p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                          <i className="fas fa-user-shield text-sm"></i>
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
            </div>
          ) : (
            <div className="bg-white p-12 md:p-16 rounded-[48px] border-2 border-dashed border-slate-200 text-center space-y-8 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-3xl flex items-center justify-center text-3xl shadow-inner mb-2 border border-indigo-100/50">
                <i className="fas fa-filter"></i>
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
          <i
            key={star}
            className={`fas fa-star text-sm transition-all duration-300 ${star <= value ? color : "text-slate-100"}`}
          ></i>
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
                <div className="flex items-center space-x-0.5 min-w-[35px]">
                  <span className="text-[9px] font-black">{idx + 1}</span>
                  <i className="fas fa-star text-[7px]"></i>
                </div>
                <div className="text-[10px] font-medium leading-tight">
                  {def}
                </div>
                {idx + 1 === value && (
                  <i className="fas fa-check-circle text-indigo-500 text-[10px]"></i>
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
