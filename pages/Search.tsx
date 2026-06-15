import React, { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import CompanyCard, { CompanyCardData } from "../src/components/CompanyCard";
import { CardGridSkeleton } from "../src/components/Skeleton";

interface SearchProps {
  user: any;
  isPaid: boolean;
  onSignInClick: () => void;
  reviewSummaries: ReviewSummary[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

const Search: React.FC<SearchProps> = ({
  isPaid,
  reviewSummaries,
  isLoading,
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";
  const [localQuery, setLocalQuery] = useState(q);

  useSEO({
    title: q ? `Search "${q}" - DealEcho` : "Search - DealEcho",
    description: `Find buyer intelligence and account insights${q ? ` for ${q}` : ""}.`,
    keywords: "B2B sales intelligence, account planning, buyer research",
  });

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim())
      navigate(`/search?q=${encodeURIComponent(localQuery)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <form onSubmit={handleSearch} className="mb-10">
          <div className="relative max-w-2xl mx-auto">
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
              placeholder="Search by company name or industry…"
              className="w-full rounded-card border-2 border-slate-200 bg-white pl-12 pr-32 py-4 text-base focus:border-accent focus:outline-none transition-colors"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 bottom-2 bg-navy text-white px-6 rounded-control font-bold text-sm hover:bg-black transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {q ? (
          <>
            <h1 className="font-display font-semibold text-2xl tracking-tight mb-1">
              Results for “{q}”
            </h1>
            <p className="text-slate-500 text-sm mb-7">
              {results.length} account{results.length !== 1 ? "s" : ""} found
            </p>

            {isLoading ? (
              <CardGridSkeleton count={3} />
            ) : results.length === 0 ? (
              <div className="de-card p-12 text-center">
                <p className="text-slate-600 font-medium">
                  No accounts match “{q}”.
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Try a broader term, or be the first to add intel on this
                  account.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {results.map((c) => (
                  <CompanyCard key={c.id} company={c} isPro={isPaid} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="de-card p-12 text-center">
            <p className="text-slate-600 font-medium">
              Enter a company name or industry to search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
