import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { ReviewSummary } from "../src/hooks/useReviewSummaries";
import CompanyCard, { CompanyCardData } from "../src/components/CompanyCard";
import { CardGridSkeleton } from "../src/components/Skeleton";
import { companyLogoUrl, guessDomainFromName } from "../src/utils/companyLogo";
import { MappedUser } from "../src/hooks/useAuth";
import Button from "../src/components/ui/Button";
import SectionHeading from "../src/components/ui/SectionHeading";
import CtaBand from "../src/components/ui/CtaBand";
import { Eye, Flag, Zap } from "lucide-react";

interface HomeProps {
  user: MappedUser | null;
  isPaid: boolean;
  onSignInClick: () => void;
  reviewSummaries: ReviewSummary[];
  trackedIds: string[];
  onToggleTrack: (id: string) => void;
  isLoading?: boolean;
}

const BENEFITS = [
  { Icon: Eye, title: "See how they buy", body: "Responsiveness, negotiation style, and decision process — before your first call." },
  { Icon: Flag, title: "Spot red flags early", body: "Ghosting, brutal procurement, champion risk — surfaced from real seller reports." },
  { Icon: Zap, title: "Win faster", body: "Walk in with the playbook instead of spending a quarter discovering it." },
];

const Home: React.FC<HomeProps> = ({ isPaid, reviewSummaries, isLoading }) => {
  useSEO({
    title: "dealecho - Sales Intelligence",
    description:
      "Know the buyer before the first call. Verified B2B buyer intelligence, red-flag analysis, and buying-team personas for elite tech accounts.",
    keywords: "B2B sales intelligence, MEDDPICC, buying teams, account planning, DealEcho",
  });

  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search)}`);
  };

  const companies: CompanyCardData[] = useMemo(() => {
    const stats: Record<string, any> = {};
    reviewSummaries.forEach((s) => {
      const name = s.companyName;
      if (!stats[name]) {
        stats[name] = { id: s.companyId, name: s.companyName, industry: s.industry, location: s.location, count: 0, respTotal: 0, negTotal: 0, wasteTotal: 0, scopeTotal: 0, lastDate: s.createdAt, excerpt: s.excerpt };
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
      .map((c) => {
        const avgResp = c.respTotal / c.count, avgNeg = c.negTotal / c.count, avgWaste = c.wasteTotal / c.count, avgScope = c.scopeTotal / c.count;
        return {
          id: c.id, name: c.name, industry: c.industry, location: c.location, reports: c.count, excerpt: c.excerpt,
          logoUrl: companyLogoUrl({ name: c.name, domain: guessDomainFromName(c.name) }),
          healthIndex: Math.round(((avgResp + avgNeg + avgWaste + avgScope) / 20) * 100),
          responsiveness: Math.round(avgResp * 20), negotiation: Math.round(avgNeg * 20),
          buyerIntent: Math.round(avgWaste * 20), scopeClarity: Math.round(avgScope * 20),
        };
      });
  }, [reviewSummaries]);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <section className="bg-navy text-white pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-signal-healthy-bright mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-healthy-bright animate-pulse-soft" />
            Live deal intelligence
          </div>
          <h1 className="font-extrabold text-4xl md:text-6xl leading-[1.04] tracking-tight mb-5">
            Know the buyer before
            <br className="hidden sm:block" /> the <span className="text-accent-soft">first call.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-xl mx-auto mb-9 leading-relaxed">
            Crowdsourced intelligence from real enterprise sales cycles. See how target accounts actually buy — before you spend a quarter finding out.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Button variant="primary" to="/pricing">Start 30-day Pro trial</Button>
            <Button variant="outline" to="/search" className="!text-white !border-white/25 hover:!border-white/50">Search an account</Button>
          </div>
        </div>
      </section>

      {/* Live feed */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <SectionHeading title="Recent intelligence" live />
        <p className="text-slate-500 text-sm mt-2 mb-7">Freshly analysed accounts from the seller community.</p>
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : companies.length === 0 ? (
          <div className="de-card p-12 text-center">
            <p className="text-slate-600 font-medium">No accounts yet. Be the first to share intel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} isPro={isPaid} />
            ))}
          </div>
        )}
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BENEFITS.map(({ Icon, title, body }) => (
            <div key={title} className="de-card p-7">
              <div className="w-11 h-11 rounded-control bg-accent-50 text-accent flex items-center justify-center mb-4">
                <Icon size={20} aria-hidden="true" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-1.5">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <CtaBand
        headline="Stop walking into deals blind."
        subtext="Full red-flag analysis, buyer personas, and deal mechanics on every account. Cancel anytime."
        ctaLabel="Start your 30-day trial"
        to="/pricing"
      />
    </div>
  );
};

export default Home;
