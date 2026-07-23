import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import CompanyCard, { CompanyCardData } from "../src/components/CompanyCard";
import CompanyLogo from "../components/CompanyLogo";
import { CardGridSkeleton } from "../src/components/Skeleton";
import { Loader2 } from "lucide-react";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";
import { searchCompanies } from "../services/geminiService";
import { recordActivity } from "../src/utils/activity";
import { Company } from "../types";
import Button from "../src/components/ui/Button";

interface SearchProps {
  user: any;
  isPaid: boolean;
  onSignInClick: () => void;
  reviewSummaries: ReviewSummary[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

const AiCompanyCard: React.FC<{ company: Company }> = ({ company }) => {
  return (
    <Link
      to={`/company/${company.id}`}
      state={{ company }}
      className="de-card-interactive p-6 block group"
    >
      {/* Header: logo + name + "No Reviews" badge */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex gap-3 items-center min-w-0">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="md" />
          <div className="min-w-0">
            <h3 className="font-bold text-[16.5px] text-slate-900 truncate">
              {company.name}
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {company.industry}
              {company.country ? ` · ${company.country}` : ""}
            </p>
          </div>
        </div>
        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
          No Reviews
        </span>
      </div>

      {/* Excerpt/Description (holds space to match reviewed card) */}
      <p className="text-[13.5px] leading-relaxed text-slate-500 line-clamp-3 mb-6 min-h-[60px]">
        {company.description || "No description available. Be the first to start tracking or review this account."}
      </p>

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-semibold">
        <span className="text-accent group-hover:underline">
          Be the first to review
        </span>
        <span className="text-slate-400 group-hover:translate-x-0.5 transition-transform">
          View Profile →
        </span>
      </div>
    </Link>
  );
};

const Search: React.FC<SearchProps> = ({
  user,
  isPaid,
  reviewSummaries,
  isLoading,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";
  const [localQuery, setLocalQuery] = useState(q);

  const [aiCompanies, setAiCompanies] = useState<Company[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);

  useSEO({
    title: q ? `Search "${q}" - Dealecho` : "Search - Dealecho",
    description: `Find buyer intelligence and account insights${q ? ` for ${q}` : ""}.`,
    keywords: "B2B sales intelligence, account planning, buyer research",
  });

  // Keep search input synced with URL query parameter
  useEffect(() => {
    setLocalQuery(q);
  }, [q]);

  // Aggregate local Firestore reviews summaries into company stats
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

    return Object.values(stats).map((c) => {
      const avgResp = c.respTotal / c.count;
      const avgNeg = c.negTotal / c.count;
      const avgWaste = c.wasteTotal / c.count;
      const avgScope = c.scopeTotal / c.count;
      const domainGuess = guessDomainFromName(c.name);
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        location: c.location,
        reports: c.count,
        excerpt: c.excerpt,
        logoUrl: companyLogoUrl({ name: c.name, domain: domainGuess }),
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

  // Distinct industries present in reviewed companies (for the hero quick-chips).
  const industries = useMemo(
    () =>
      Array.from(new Set(companies.map((c) => c.industry).filter(Boolean)))
        .sort()
        .slice(0, 6),
    [companies],
  );

  // Most-recently-reviewed accounts for the landing grid (mirrors Home's sort-by-lastDate).
  const recentCompanies = useMemo(() => {
    const stats: Record<string, any> = {};
    reviewSummaries.forEach((s) => {
      const name = s.companyName;
      if (!stats[name]) {
        stats[name] = {
          id: s.companyId, name: s.companyName, industry: s.industry, location: s.location,
          count: 0, respTotal: 0, negTotal: 0, wasteTotal: 0, scopeTotal: 0,
          lastDate: s.createdAt, excerpt: s.excerpt,
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
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .slice(0, 6)
      .map((c) => {
        const avgResp = c.respTotal / c.count, avgNeg = c.negTotal / c.count,
          avgWaste = c.wasteTotal / c.count, avgScope = c.scopeTotal / c.count;
        const domainGuess = guessDomainFromName(c.name);
        return {
          id: c.id, name: c.name, industry: c.industry, location: c.location,
          reports: c.count, excerpt: c.excerpt,
          logoUrl: companyLogoUrl({ name: c.name, domain: domainGuess }),
          healthIndex: Math.round(((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100),
          responsiveness: Math.round(avgResp * 20), negotiation: Math.round(avgNeg * 20),
          buyerIntent: Math.round(avgWaste * 20), scopeClarity: Math.round(avgScope * 20),
        };
      });
  }, [reviewSummaries]);

  // Filter reviewed companies locally
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const query = q.toLowerCase();
    return companies
      .filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.industry.toLowerCase().includes(query),
      )
      .sort((a, b) => b.healthIndex - a.healthIndex);
  }, [q, companies]);

  // Behavioral signal for the marketing dashboard: count each distinct search
  // per session; attach an industry when the query matches a known one.
  useEffect(() => {
    if (!q.trim()) return;
    const query = q.trim().toLowerCase();
    const industry = reviewSummaries
      .map((s) => s.industry)
      .find((i) => i && i.toLowerCase() === query);
    recordActivity("search", industry, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Search company entities via Gemini Google Search tool in Cloud Function
  useEffect(() => {
    if (!q.trim()) {
      setAiCompanies([]);
      return;
    }

    let active = true;
    const fetchAiCompanies = async () => {
      setIsAiSearching(true);
      try {
        const results = await searchCompanies(q);
        if (active) {
          setAiCompanies(results);
        }
      } catch (err) {
        console.error("AI search failed:", err);
      } finally {
        if (active) {
          setIsAiSearching(false);
        }
      }
    };

    fetchAiCompanies();

    return () => {
      active = false;
    };
  }, [q]);

  // Exclude AI search results that are already present in the reviewed accounts
  const filteredAiCompanies = useMemo(() => {
    const reviewedNames = new Set(results.map((r) => r.name.toLowerCase()));
    return aiCompanies.filter((c) => !reviewedNames.has(c.name.toLowerCase()));
  }, [aiCompanies, results]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) navigate(`/search?q=${encodeURIComponent(localQuery)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navy command hero */}
      <section className="bg-navy text-white pt-16 pb-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-signal-healthy-bright mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
            Search intelligence
          </div>
          <h1 className="font-extrabold text-3xl md:text-5xl leading-[1.05] tracking-tight mb-6">
            Find how any <span className="text-accent-soft">account buys</span>
          </h1>
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
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
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search any company or industry"
                aria-label="Company search"
                className="w-full rounded-card bg-white text-slate-900 placeholder-slate-400 pl-12 pr-28 py-4 text-base shadow-hero focus:outline-none focus:ring-4 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-accent text-white px-6 rounded-control font-bold text-sm hover:bg-accent-700 transition-colors"
              >
                Search
              </button>
            </div>
          </form>
          {industries.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {industries.map((ind) => {
                const active = q.toLowerCase() === ind.toLowerCase();
                return (
                  <Link
                    key={ind}
                    to={`/search?q=${encodeURIComponent(ind)}`}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      active ? "bg-accent text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                  >
                    {ind}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Content area */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {q ? (
          <>
            <h2 className="font-display font-semibold text-2xl tracking-tight mb-1">
              Results for “{q}”
            </h2>
            <p className="text-slate-500 text-sm mb-7">
              {results.length + filteredAiCompanies.length} account{results.length + filteredAiCompanies.length !== 1 ? "s" : ""} found
            </p>

            <div className="space-y-10">
              {/* 1. Reviewed Accounts Section */}
              {isLoading ? (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Loading reviewed accounts...
                  </h2>
                  <CardGridSkeleton count={3} />
                </div>
              ) : results.length > 0 ? (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Reviewed Accounts ({results.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {results.map((c) => (
                      <CompanyCard key={c.id} company={c} isPro={isPaid} isLoggedIn={!!user} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 2. AI / Global Search Accounts Section */}
              {isAiSearching ? (
                <div>
                  <div role="status" className="flex items-center gap-3 bg-accent-50 border border-accent-100 rounded-card px-4 py-3 mb-4">
                    <Loader2 className="animate-spin text-accent shrink-0" size={18} />
                    <div>
                      <p className="text-accent font-bold text-sm">Searching our global database…</p>
                      <p className="text-accent-soft text-xs">
                        Scanning the web for accounts matching “{q}”. This can take a few seconds.
                      </p>
                    </div>
                  </div>
                  <CardGridSkeleton count={3} />
                </div>
              ) : filteredAiCompanies.length > 0 ? (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Other Accounts ({filteredAiCompanies.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAiCompanies.map((c) => (
                      <AiCompanyCard key={c.id} company={c} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* No results placeholder */}
              {!isLoading && !isAiSearching && results.length === 0 && filteredAiCompanies.length === 0 && (
                <div className="de-card p-12 text-center">
                  <p className="text-slate-600 font-medium">
                    No accounts match “{q}”.
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Try a broader term, or be the first to add intel on this
                    account.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button variant="primary" to="/review/new">Share intel on this account</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-8">
            {recentCompanies.length > 0 ? (
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  Recently reviewed
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recentCompanies.map((c) => (
                    <CompanyCard key={c.id} company={c} isPro={isPaid} isLoggedIn={!!user} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="de-card p-12 text-center">
                <p className="text-slate-600 font-medium">No accounts reviewed yet.</p>
                <p className="text-slate-400 text-sm mt-1">Be the first to add intel on an account.</p>
                <div className="mt-5 flex justify-center">
                  <Button variant="primary" to="/review/new">Share intel on an account</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
