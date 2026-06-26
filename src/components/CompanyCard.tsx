import React from "react";
import { Link } from "react-router-dom";
import CompanyLogo from "../../components/CompanyLogo";
import ScoreRing from "./ScoreRing";
import MetricBar from "./MetricBar";

export interface CompanyCardData {
  id: string;
  name: string;
  industry: string;
  location: string;
  reports: number;
  excerpt: string;
  logoUrl?: string;
  healthIndex: number;
  responsiveness: number;
  negotiation: number;
  buyerIntent: number;
  scopeClarity: number;
}

interface CompanyCardProps {
  company: CompanyCardData;
  isPro: boolean;
}

/** The card used on Home and Search. Score ring + inline metric bars +
 *  a Pro gate that never renders gated content for free users. */
const CompanyCard: React.FC<CompanyCardProps> = ({ company, isPro }) => {
  return (
    <Link
      to={`/company/${company.id}`}
      state={{
        company: {
          id: company.id,
          name: company.name,
          industry: company.industry,
          country: company.location,
          logoUrl: company.logoUrl,
          healthIndex: company.healthIndex,
          reports: company.reports,
        },
      }}
      className="de-card-interactive p-6 block group"
    >
      {/* Header: logo + name + score ring */}
      <div className="flex justify-between items-start mb-5">
        <div className="flex gap-3 items-center min-w-0">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="md" />
          <div className="min-w-0">
            <h3 className="font-bold text-[16.5px] text-slate-900 truncate">
              {company.name}
            </h3>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {company.industry}
              {company.location ? ` · ${company.location}` : ""}
            </p>
          </div>
        </div>
        <ScoreRing score={company.healthIndex} />
      </div>

      {/* Metric micro-bars */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-5">
        <MetricBar label="Responsiveness" value={company.responsiveness} />
        <MetricBar label="Negotiation" value={company.negotiation} />
        <MetricBar label="Buyer intent" value={company.buyerIntent} />
        <MetricBar label="Scope clarity" value={company.scopeClarity} />
      </div>

      {/* Excerpt (public) or Pro gate */}
      {isPro ? (
        <p className="text-[13.5px] leading-relaxed text-slate-600 line-clamp-2 mb-4">
          {company.excerpt || "No summary available yet."}
        </p>
      ) : (
        <div className="bg-accent-50 border border-accent-100 rounded-control px-4 py-3 flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-accent-700 leading-snug">
              Full deal narrative is Pro intel
            </p>
            <p className="text-2xs text-accent-500 truncate">
              Buying team · cycle length · negotiation notes
            </p>
          </div>
          <span
            className="flex-shrink-0 bg-navy text-white px-3.5 py-2 rounded-lg text-2xs font-bold group-hover:bg-black transition-colors"
          >
            Unlock
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-semibold">
        <span className="text-slate-400">
          {company.reports} verified report{company.reports !== 1 ? "s" : ""}
        </span>
        <span className="text-accent group-hover:translate-x-0.5 transition-transform">
          View account →
        </span>
      </div>
    </Link>
  );
};

export default CompanyCard;
