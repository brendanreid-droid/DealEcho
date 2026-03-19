import React from "react";
import { useParams, Link } from "react-router-dom";
import { Review } from "../types";
import CompanyLogo from "../components/CompanyLogo";

interface UserReviewsProps {
  reviews: Review[];
}

const UserReviews: React.FC<UserReviewsProps> = ({ reviews }) => {
  const { userId } = useParams<{ userId: string }>();

  const userReviews = reviews.filter((r) => r.userId === userId);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      <div className="flex items-center justify-between border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 flex items-center">
            <i className="fas fa-user-shield text-indigo-600 mr-4"></i>
            {userReviews[0]?.userName || "Contributor"} Intel
          </h1>
          <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-[0.2em]">
            {userReviews.length} Reports Submitted
          </p>
        </div>
        <div className="hidden md:block">
          <div className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest">
            Elite Reporter Status
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {userReviews.length > 0 ? (
          userReviews.map((r) => (
            <div
              key={r.id}
              className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-6 hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-5">
                  <CompanyLogo
                    name={r.companyName}
                    logoUrl={`https://logo.clearbit.com/${r.companyName.toLowerCase().replace(/\s/g, "").replace(/\./g, "")}.com`}
                    size="lg"
                  />
                  <div>
                    <Link
                      to={`/company/${encodeURIComponent(r.companyId)}`}
                      className="text-2xl font-bold text-slate-900 hover:text-indigo-600 transition-colors block leading-tight"
                    >
                      {r.companyName}
                    </Link>
                    <div className="text-[10px] block text-slate-400 uppercase tracking-widest font-black mt-1">
                      {r.industry} &bull; {r.location} &bull;{" "}
                      {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    r.status === "Won"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : r.status === "Lost"
                        ? "bg-rose-50 text-rose-600 border border-rose-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                  }`}
                >
                  {r.status}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-slate-50">
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    TCV
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {r.tcvBracket}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    Duration
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {r.cycleDuration}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    Responsiveness
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    {r.communicationRating}/5
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    Buying Team
                  </div>
                  <div className="text-xs font-bold text-slate-600 truncate">
                    {r.buyingTeam.join(", ") || "N/A"}
                  </div>
                </div>
              </div>

              <p className="text-slate-600 text-[15px] leading-relaxed font-medium italic bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                "{r.content}"
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Negotiation Ease
                    </span>
                    <span className="text-xs font-black text-indigo-600">
                      {r.negotiationLevel}/5
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${(r.negotiationLevel / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Buyer Intent
                    </span>
                    <span className="text-xs font-black text-rose-600">
                      {r.timeWasterLevel}/5
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${(r.timeWasterLevel / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Scope Clarity
                    </span>
                    <span className="text-xs font-black text-emerald-600">
                      {r.clarityOfScope || 3}/5
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${((r.clarityOfScope || 3) / 5) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-24 bg-slate-50 rounded-[48px] border-2 border-dashed border-slate-200">
            <i className="fas fa-ghost text-slate-200 text-6xl mb-6"></i>
            <p className="text-slate-400 font-bold text-lg">
              No intelligence reported by this contributor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserReviews;
