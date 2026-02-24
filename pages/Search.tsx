import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Company, Review } from "../types";
import { searchCompanies, isGeminiAvailable } from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";

interface SearchProps {
  reviews: Review[];
  isLoading?: boolean;
}

interface CompanyStats {
  count: number;
  avgResp: number;
  avgNeg: number;
  avgIntent: number;
  avgScope: number;
  healthIndex: number;
}

const Search: React.FC<SearchProps> = ({ reviews, isLoading }) => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Company[]>([]);
  const navigate = useNavigate();

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);

    // Try AI search first, then fall back to local review data
    if (isGeminiAvailable()) {
      const companies = await searchCompanies(searchTerm);
      setResults(companies);
    } else {
      // Fallback: search company names from existing reviews
      const term = searchTerm.toLowerCase();
      const uniqueCompanies = new Map<string, Company>();
      reviews.forEach((r) => {
        if (
          r.companyName.toLowerCase().includes(term) ||
          r.industry?.toLowerCase().includes(term)
        ) {
          if (!uniqueCompanies.has(r.companyName.toLowerCase())) {
            const domain =
              r.companyName
                .toLowerCase()
                .replace(/\s/g, "")
                .replace(/\./g, "") + ".com";
            uniqueCompanies.set(r.companyName.toLowerCase(), {
              id: r.companyId,
              name: r.companyName,
              industry: r.industry || "Unknown",
              country: r.country || r.location || "Unknown",
              description: "",
              logoUrl: `https://logo.clearbit.com/${domain}`,
            });
          }
        }
      });
      setResults(Array.from(uniqueCompanies.values()));
    }

    setIsSearching(false);
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  // Calculate industry averages for comparison in tooltips
  const industryAverages = useMemo(() => {
    const indStats: Record<string, { total: number; count: number }> = {};
    reviews.forEach((r) => {
      // Scale sum of 4 metrics (1-5 each) to 100
      const hScore =
        r.communicationRating +
        r.negotiationLevel +
        r.timeWasterLevel +
        (r.clarityOfScope || 3);
      if (!indStats[r.industry]) indStats[r.industry] = { total: 0, count: 0 };
      indStats[r.industry].total += hScore;
      indStats[r.industry].count += 1;
    });

    const avgs: Record<string, number> = {};
    Object.entries(indStats).forEach(([ind, data]) => {
      avgs[ind] = Math.round((data.total / (data.count * 20)) * 100);
    });
    return avgs;
  }, [reviews]);

  // Memoize review stats for the current results
  const resultStats = useMemo(() => {
    const stats: Record<string, CompanyStats> = {};
    results.forEach((company) => {
      const companyReviews = reviews.filter(
        (r) =>
          r.companyName.toLowerCase().trim() ===
            company.name.toLowerCase().trim() || r.companyId === company.id,
      );

      if (companyReviews.length > 0) {
        const count = companyReviews.length;
        const avgResp =
          companyReviews.reduce((acc, r) => acc + r.communicationRating, 0) /
          count;
        const avgNeg =
          companyReviews.reduce((acc, r) => acc + r.negotiationLevel, 0) /
          count;
        const avgIntent =
          companyReviews.reduce((acc, r) => acc + r.timeWasterLevel, 0) / count;
        const avgScope =
          companyReviews.reduce((acc, r) => acc + (r.clarityOfScope || 3), 0) /
          count;

        const healthIndex = Math.round(
          ((avgResp + avgNeg + avgIntent + avgScope) / 20) * 100,
        );

        stats[company.id] = {
          count,
          avgResp,
          avgNeg,
          avgIntent,
          avgScope,
          healthIndex,
        };
      }
    });
    return stats;
  }, [results, reviews]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl md:text-5xl font-black text-[#1e293b] tracking-tight">
            Company Search
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
            Search verified entities. If there's no data yet, you can be the
            pioneer for that account.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="max-w-3xl mx-auto relative group"
        >
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <i className="fas fa-search text-xl"></i>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a company (e.g., 'Snowflake', 'Docusign')..."
            className="w-full bg-white border-2 border-slate-200 rounded-[28px] pl-16 pr-32 py-7 text-xl focus:border-indigo-600 focus:ring-8 focus:ring-indigo-50 outline-none transition shadow-2xl shadow-slate-300/20"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-3 top-3 bottom-3 bg-indigo-600 text-white px-8 rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition disabled:bg-slate-400 shadow-xl shadow-indigo-100"
          >
            {isSearching ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {isLoading && (
          <div className="py-24 text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
            <div className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">
              Syncing Global Intelligence...
            </div>
          </div>
        )}

        {isSearching && (
          <div className="py-24 text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin shadow-inner"></div>
            </div>
            <div className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">
              {isGeminiAvailable()
                ? "Querying Google AI for Entity Verification..."
                : "Searching Community Intelligence..."}
            </div>
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Found {results.length} Potential Entities
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {results.map((company) => {
                const stats = resultStats[company.id];
                const hasReviews = !!stats;
                const domain =
                  company.name
                    .toLowerCase()
                    .replace(/\s/g, "")
                    .replace(/\./g, "") + ".com";

                return (
                  <div
                    key={company.id}
                    onClick={() =>
                      navigate(`/company/${encodeURIComponent(company.id)}`, {
                        state: { company },
                      })
                    }
                    className="bg-white p-8 md:p-10 rounded-[40px] border border-slate-200 hover:border-indigo-400 hover:shadow-[0_20px_80px_-20px_rgba(79,70,229,0.15)] hover:-translate-y-1 transition-all cursor-pointer flex flex-col group relative shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:z-[100]"
                  >
                    <div className="flex items-start space-x-6 mb-6">
                      <CompanyLogo
                        name={company.name}
                        logoUrl={company.logoUrl}
                        size="lg"
                        className="group-hover:scale-105 transition border-2 border-slate-50"
                      />
                      <div className="flex-grow space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl md:text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight tracking-tight">
                            {company.name}
                          </h3>
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">
                            {company.industry} &bull; {company.country}
                          </p>
                          <span className="text-indigo-500 font-bold text-[10px] flex items-center mt-1.5 opacity-80">
                            <i className="fas fa-link text-[8px] mr-2"></i>
                            {domain}
                          </span>
                        </div>
                      </div>
                    </div>

                    {hasReviews ? (
                      <div className="space-y-6 mb-8 relative">
                        <Tooltip
                          content={
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-400 border-b border-white/10 pb-3">
                                Buyer Score Calculation
                              </h4>
                              <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                                Aggregate health derived from {stats.count}{" "}
                                verified sales cycle reports:
                              </p>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Responsiveness
                                  </span>
                                  <span className="text-[10px] font-black text-indigo-400">
                                    {stats.avgResp.toFixed(1)}/5.0
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Negotiation ease
                                  </span>
                                  <span className="text-[10px] font-black text-amber-400">
                                    {stats.avgNeg.toFixed(1)}/5.0
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Buyer Intent
                                  </span>
                                  <span className="text-[10px] font-black text-rose-400">
                                    {stats.avgIntent.toFixed(1)}/5.0
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    Scope Maturity
                                  </span>
                                  <span className="text-[10px] font-black text-emerald-400">
                                    {stats.avgScope.toFixed(1)}/5.0
                                  </span>
                                </div>
                              </div>
                              <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest pt-3 italic border-t border-white/5">
                                Verified community intelligence.
                              </div>
                            </div>
                          }
                        >
                          <div className="flex items-center justify-between bg-slate-900 text-white p-5 rounded-[24px] shadow-xl border-t-4 border-t-indigo-500 cursor-help group-hover:bg-black transition-colors relative">
                            <div>
                              <div className="text-[8px] font-black uppercase tracking-widest text-indigo-400">
                                Buyer Score
                              </div>
                              <div className="text-2xl font-black">
                                {stats.healthIndex}%
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                                Verification
                              </div>
                              <div className="text-[10px] font-black text-indigo-200">
                                {stats.count} Reports
                              </div>
                            </div>
                          </div>
                        </Tooltip>

                        <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-4 gap-2 border border-slate-100 shadow-inner">
                          <CompactMetric
                            label="Resp."
                            value={stats.avgResp}
                            color="text-indigo-500"
                            tooltip="Responsiveness"
                          />
                          <CompactMetric
                            label="Negot."
                            value={stats.avgNeg}
                            color="text-amber-500"
                            tooltip="Negotiation"
                          />
                          <CompactMetric
                            label="Intent"
                            value={stats.avgIntent}
                            color="text-rose-500"
                            tooltip="Buyer Intent"
                          />
                          <CompactMetric
                            label="Scope"
                            value={stats.avgScope}
                            color="text-emerald-500"
                            tooltip="Scope Clarity"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-10 p-6 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200 text-center">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          No community intel yet
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Be the first to share tactics for this account.
                        </p>
                      </div>
                    )}

                    <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-100">
                      {hasReviews ? (
                        <span className="text-indigo-600 text-[11px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform inline-flex items-center">
                          View Intelligence Feed{" "}
                          <i className="fas fa-arrow-right ml-2 text-[10px]"></i>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/review/new", {
                              state: { prefilledCompany: company },
                            });
                          }}
                          className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-700 hover:bg-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center"
                        >
                          <i className="fas fa-pen-nib mr-2 text-[8px]"></i>
                          Write First Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isSearching && results.length === 0 && query && (
          <div className="text-center py-32 space-y-8 bg-white rounded-[48px] border-2 border-slate-200 border-dashed shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-3xl shadow-inner flex items-center justify-center mx-auto text-slate-200">
              <i className="fas fa-search-minus text-5xl"></i>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                No Verified Entity Found
              </h3>
              <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
                We couldn't identify "{query}". Try using the full legal name or
                the official domain (e.g. snowflake.com).
              </p>
            </div>
            <button
              onClick={() => setQuery("")}
              className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CompactMetric: React.FC<{
  label: string;
  value: number;
  color: string;
  tooltip: string;
}> = ({ label, value, color, tooltip }) => {
  return (
    <div className="text-center relative py-1">
      <Tooltip content={<div className="text-[10px] p-1">{tooltip}</div>}>
        <div className="cursor-help">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">
            {label}
          </div>
          <div className="flex items-center justify-center space-x-1">
            <span className={`text-[12px] font-black ${color}`}>
              {value.toFixed(1)}
            </span>
            <i className={`fas fa-star text-[9px] ${color} opacity-60`}></i>
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

const Tooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
}> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div
      className="relative inline-block w-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-5 w-72 bg-slate-900 text-white p-6 rounded-[28px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] z-[110] animate-in fade-in slide-in-from-top-2 pointer-events-none text-left font-medium border border-white/5">
          {content}
          {/* Upward pointing arrow */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45 -mb-2"></div>
        </div>
      )}
    </div>
  );
};

export default Search;
