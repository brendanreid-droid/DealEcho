import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { Company, Review } from "../types";
import { getAICompanyPersona, CompanyPersona } from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";
import { useSEO } from "../src/hooks/useSEO";
import Icon from "../src/components/Icon";
import ScoreRing from "../src/components/ScoreRing";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";
import { MappedUser } from "../src/hooks/useAuth";
import VerdictCard from "../src/components/intel/VerdictCard";
import FlagList from "../src/components/intel/FlagList";
import TrendStrip from "../src/components/intel/TrendStrip";
import Playbook from "../src/components/intel/Playbook";
import EvidenceList from "../src/components/intel/EvidenceList";
import { getAccountSignal, AccountSignal } from "../services/accountSignal";

interface CompanyProfileProps {
  user: MappedUser | null;
  isPaid: boolean;
  onSignInClick: () => void;
  reviews: Review[];
  allTrackedIds: string[];
  onToggleTrack: (id: string) => void;
}

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
  const [signal, setSignal] = useState<AccountSignal | null>(null);
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

  useEffect(() => {
    if (company && companyReviews.length > 0) {
      getAccountSignal(company.name, companyReviews).then(setSignal);
    } else {
      setSignal(null);
    }
  }, [company, companyReviews]);

  const healthDelta = useMemo(() => {
    if (!signal || signal.trend.length === 0) return 0;
    const avg = (i: number) =>
      signal.trend.reduce((a, t) => a + (t.points[t.points.length - 1 - i] || 0), 0) / signal.trend.length;
    const latest = avg(0);
    const prev = avg(1);
    if (!prev) return 0;
    return Math.round(((latest - prev) / 20) * 100);
  }, [signal]);

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
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <VerdictCard
        name={company.name}
        meta={`${company.industry} \u00b7 ${company.country}`}
        health={hasReviews ? statsSummary.healthIndex : 0}
        healthDelta={healthDelta}
        headline={signal?.headline ?? company.description ?? ""}
        reportCount={companyReviews.length}
      />

      <section aria-labelledby="flags-heading" className="space-y-2">
        <h2 id="flags-heading" className="text-sm font-semibold text-slate-500">Red flags</h2>
        <FlagList flags={signal?.flags ?? []} isPro={isPro} />
      </section>

      {isPro && signal && (
        <section aria-labelledby="trend-heading" className="space-y-2">
          <h2 id="trend-heading" className="text-sm font-semibold text-slate-500">Recent trend</h2>
          <TrendStrip trend={signal.trend} />
        </section>
      )}

      {isPro ? (
        aiPersona && <Playbook persona={aiPersona} />
      ) : (
        <Link to="/pricing" className="block bg-navy text-white rounded-card p-6 text-center">
          <span className="text-sm font-semibold">Unlock the AI playbook and full review evidence with Sales Pro</span>
        </Link>
      )}

      {isPro && hasReviews && (
        <section aria-labelledby="evidence-heading" className="space-y-3">
          <h2 id="evidence-heading" className="text-sm font-semibold text-slate-500">Evidence</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTeam("all")}
              className={`px-3 py-1.5 rounded-control text-2xs font-semibold uppercase tracking-wider ${
                selectedTeam === "all" ? "bg-accent text-white" : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              All stakeholders
            </button>
            {availableTeams.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`px-3 py-1.5 rounded-control text-2xs font-semibold uppercase tracking-wider ${
                  selectedTeam === team ? "bg-accent text-white" : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                {team}
              </button>
            ))}
          </div>
          <EvidenceList reviews={sortedReviews} />
        </section>
      )}

      {showReviewRuleModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60">
          <div className="bg-white rounded-card p-10 max-w-md w-full text-center space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Review policy</h3>
            <p className="text-slate-500">
              Users can leave one review per company every 6 months. Your last review for {company.name} was recent.
            </p>
            <button
              onClick={() => setShowReviewRuleModal(false)}
              className="w-full bg-navy text-white py-4 rounded-control font-semibold uppercase tracking-widest"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyProfile;
