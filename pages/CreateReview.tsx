import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Company, Review } from "../types";
import {
  searchCompanies,
  moderateReview,
  isGeminiAvailable,
} from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";

interface CreateReviewProps {
  user: any;
  onAddReview: (review: Review) => void;
  onSignInClick?: () => void;
}

const DEPARTMENTS = [
  "IT / Engineering",
  "Security / InfoSec",
  "Data Privacy / DPO",
  "Procurement",
  "Finance / Treasury",
  "Legal / Compliance",
  "Executive Leadership (C-Suite)",
  "Marketing",
  "Sales / Business Development",
  "Operations / Enablement",
  "HR / People Ops",
  "Product Management",
  "Customer Success / Support",
  "Supply Chain / Logistics",
  "Facilities / Real Estate",
  "R&D / Innovation",
  "Strategy / Corporate Dev",
  "Quality Assurance / QA",
  "Regulatory / Gov Affairs",
  "External Consultants / Advisors",
  "Board of Directors",
].sort();

const TCV_BRACKETS = [
  "< $10k",
  "$10k - $25k",
  "$25k - $50k",
  "$50k - $100k",
  "$100k - $250k",
  "$250k - $500k",
  "$500k - $750k",
  "$750k - $1M",
  "$1M+",
];
const DURATION_BRACKETS = [
  "< 1 Month",
  "1-3 Months",
  "3-6 Months",
  "6-12 Months",
  "12+ Months",
];

const CreateReview: React.FC<CreateReviewProps> = ({
  user,
  onAddReview,
  onSignInClick,
}) => {
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const errorRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(
    locationState?.prefilledCompany || null,
  );

  // Manual company entry fallback (when Gemini AI is unavailable)
  const [showManualEntry, setShowManualEntry] = useState(!isGeminiAvailable());
  const [manualName, setManualName] = useState("");
  const [manualIndustry, setManualIndustry] = useState("Technology");
  const [manualCountry, setManualCountry] = useState("United States");
  const MANUAL_INDUSTRIES = [
    "Technology",
    "Finance",
    "Healthcare",
    "Manufacturing",
    "Retail",
    "Energy",
    "Telecommunications",
    "Media & Entertainment",
    "Professional Services",
    "Education",
    "Government",
    "Real Estate",
    "Transportation",
    "Agriculture",
    "Other",
  ];

  const handleManualCompanySelect = () => {
    if (!manualName.trim()) return;
    const domain =
      manualName.trim().toLowerCase().replace(/\s/g, "").replace(/\./g, "") +
      ".com";
    setSelectedCompany({
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      industry: manualIndustry,
      country: manualCountry,
      description: "",
      logoUrl: `https://logo.clearbit.com/${domain}`,
    });
  };

  const [tcvBracket, setTcvBracket] = useState(TCV_BRACKETS[0]);
  const [cycleDuration, setCycleDuration] = useState(DURATION_BRACKETS[0]);
  const [status, setStatus] = useState<"Won" | "Lost" | "Ongoing">("Won");
  const [isTender, setIsTender] = useState(false);
  const [buyingTeam, setBuyingTeam] = useState<string[]>([]);
  const [commRating, setCommRating] = useState(0);
  const [negotiation, setNegotiation] = useState(0);
  const [timeWaster, setTimeWaster] = useState(0);
  const [clarityScope, setClarityScope] = useState(0);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompany || searchQuery.length <= 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchCompanies(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedCompany]);

  const handleDeptAdd = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dept = e.target.value;
    if (dept && !buyingTeam.includes(dept)) {
      setBuyingTeam((prev) => [...prev, dept]);
    }
    e.target.value = "";
  };

  const removeDept = (dept: string) => {
    setBuyingTeam((prev) => prev.filter((d) => d !== dept));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !selectedCompany ||
      !content ||
      commRating === 0 ||
      negotiation === 0 ||
      timeWaster === 0 ||
      clarityScope === 0 ||
      buyingTeam.length === 0
    ) {
      setError(
        "Please complete all sections, including selecting at least one department in the Buying Team.",
      );
      errorRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const moderation = await moderateReview(content);
    if (!moderation.isSafe) {
      setError(
        `Flagged: ${moderation.reason}. Please ensure no personal names are included.`,
      );
      setIsSubmitting(false);
      return;
    }
    const newReview: Review = {
      id: Math.random().toString(36).substr(2, 9),
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      userId: user?.id || "user-1",
      userName: user?.name || "Anonymous",
      currency: "USD",
      tcvBracket,
      cycleDuration,
      status,
      isTender,
      buyingTeam,
      location: selectedCompany.country,
      communicationRating: commRating,
      negotiationLevel: negotiation,
      timeWasterLevel: timeWaster,
      clarityOfScope: clarityScope,
      industry: selectedCompany.industry,
      country: selectedCompany.country,
      content,
      createdAt: new Date().toISOString(),
    };
    onAddReview(newReview);
    setIsSubmitting(false);
    navigate("/");
  };

  if (!user) {
    return (
      <div className="bg-[#101426] min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] rounded-full"></div>
        <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[48px] p-10 md:p-16 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-[28px] flex items-center justify-center mx-auto text-3xl shadow-2xl border-b-4 border-indigo-700">
            <i className="fas fa-pen-nib"></i>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase tracking-widest">
              Write Review
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
              Sharing sales reviews and deal mechanics requires a verified
              account to maintain the integrity of our network.
            </p>
          </div>
          <button
            onClick={onSignInClick}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 hover:bg-indigo-500 transition-all flex items-center justify-center space-x-3"
          >
            <i className="fas fa-lock text-xs opacity-50"></i>
            <span>Sign In to Contribute</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-4 md:px-6">
      <div className="bg-white rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-[0_20px_80px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="bg-[#0f172a] p-8 md:p-12 text-white relative">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-indigo-500/10 blur-[120px] rounded-full -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-4">
              <span className="bg-indigo-600/30 text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-indigo-500/20 backdrop-blur-md">
                <i className="fas fa-user-check mr-2 text-[8px]"></i>
                {user.isPro
                  ? "Sales Pro Verified"
                  : "Verified Community Member"}
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
              Write Review
            </h2>
            <p className="text-slate-400 text-base md:text-lg mt-4 font-medium max-w-2xl opacity-80 leading-relaxed">
              Document deal mechanics and tactical hurdles for the community.
            </p>
          </div>
        </div>

        <div ref={errorRef}>
          {error && (
            <div className="mx-6 md:mx-12 mt-6 p-6 bg-rose-50 border border-rose-100 rounded-[28px] text-rose-600 text-sm font-bold flex items-center shadow-sm">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center mr-5 shrink-0">
                <i className="fas fa-exclamation-triangle text-lg"></i>
              </div>
              <span>{error}</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 md:p-12 space-y-12 md:space-y-20"
        >
          {/* Section 1: Target Account with AI Search */}
          <section className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-indigo-500 shadow-md">
                1
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                Target Account
              </h3>
            </div>

            {!selectedCompany ? (
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300">
                    <i className="fas fa-search text-xl"></i>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a company (e.g., Snowflake, Palantir)..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-[32px] pl-16 pr-8 py-6 focus:bg-white focus:border-indigo-100 outline-none transition text-slate-700 text-xl font-medium shadow-inner"
                  />
                  {isSearching && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <i className="fas fa-spinner fa-spin text-indigo-500"></i>
                    </div>
                  )}
                </div>

                {/* AI Search Result Dropdown */}
                {searchResults.length > 0 && !isSearching && (
                  <div className="bg-white border-2 border-slate-100 rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50 px-8 py-3 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Select Verified Entity
                      </span>
                      <span className="text-[9px] font-black text-indigo-500 uppercase flex items-center">
                        <i className="fas fa-magic mr-1.5"></i> Google Search
                        Grounding Active
                      </span>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                      {searchResults.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => setSelectedCompany(company)}
                          className="w-full text-left px-8 py-5 hover:bg-indigo-50/50 flex items-center space-x-5 transition-colors group"
                        >
                          <CompanyLogo
                            name={company.name}
                            logoUrl={company.logoUrl}
                            size="md"
                            className="group-hover:scale-105 transition"
                          />
                          <div className="flex-grow">
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {company.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {company.industry} &bull; {company.country}
                            </div>
                          </div>
                          <i className="fas fa-plus text-slate-200 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"></i>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isSearching && (
                  <div className="text-center py-10 space-y-3">
                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] animate-pulse">
                      Querying Google AI...
                    </div>
                  </div>
                )}

                {/* Manual Company Entry Fallback */}
                {!showManualEntry &&
                  !isSearching &&
                  searchResults.length === 0 &&
                  searchQuery.length > 2 && (
                    <div className="text-center py-4">
                      <button
                        type="button"
                        onClick={() => setShowManualEntry(true)}
                        className="text-indigo-600 text-sm font-bold hover:underline"
                      >
                        <i className="fas fa-plus-circle mr-2"></i>
                        Can't find it? Enter company details manually
                      </button>
                    </div>
                  )}

                {showManualEntry && (
                  <div className="bg-white border-2 border-indigo-100 rounded-[32px] overflow-hidden shadow-lg p-8 space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                          Manual Entry
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          Enter the company details below
                        </p>
                      </div>
                      {isGeminiAvailable() && (
                        <button
                          type="button"
                          onClick={() => setShowManualEntry(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          <i className="fas fa-times mr-1"></i>Back to AI Search
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="e.g., Snowflake Inc."
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-200 outline-none transition text-slate-700 font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          Industry
                        </label>
                        <select
                          value={manualIndustry}
                          onChange={(e) => setManualIndustry(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-indigo-200"
                        >
                          {MANUAL_INDUSTRIES.map((i) => (
                            <option key={i} value={i}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                          Country
                        </label>
                        <input
                          type="text"
                          value={manualCountry}
                          onChange={(e) => setManualCountry(e.target.value)}
                          placeholder="e.g., United States"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-200 outline-none transition text-slate-700 font-medium"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleManualCompanySelect}
                          disabled={!manualName.trim()}
                          className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg"
                        >
                          <i className="fas fa-check mr-2"></i>Confirm Company
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show manual entry hint when Gemini is unavailable and manual form isn't already showing */}
                {!isGeminiAvailable() && !showManualEntry && (
                  <div className="text-center py-6">
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(true)}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                    >
                      <i className="fas fa-building mr-2"></i>
                      Enter Company Manually
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-10 bg-indigo-50/20 border-2 border-indigo-100 rounded-[40px] group transition-all hover:bg-indigo-50/40 shadow-sm">
                <div className="flex items-center space-x-8">
                  <CompanyLogo
                    name={selectedCompany.name}
                    logoUrl={selectedCompany.logoUrl}
                    size="lg"
                    className="shadow-xl border-2 border-white"
                  />
                  <div>
                    <div className="flex items-center space-x-3">
                      <div className="font-black text-3xl text-slate-900 leading-tight tracking-tight">
                        {selectedCompany.name}
                      </div>
                      <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-indigo-200">
                        Verified Account
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-500 uppercase tracking-widest font-black bg-white px-2 py-1 rounded-md border border-indigo-100 mt-2 inline-block">
                      {selectedCompany.industry}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompany(null);
                    setSearchQuery("");
                  }}
                  className="w-12 h-12 rounded-2xl bg-white text-slate-300 hover:text-rose-500 transition-all shadow-sm border border-slate-100 flex items-center justify-center group/btn"
                >
                  <i className="fas fa-times group-hover/btn:rotate-90 transition-transform"></i>
                </button>
              </div>
            )}
          </section>

          {/* Section 2: Deal Logistics */}
          <section className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-indigo-500 shadow-md">
                2
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                Deal Logistics
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-[32px] space-y-4 shadow-sm">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Outcome
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "Won" | "Lost" | "Ongoing")
                  }
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-indigo-200 transition-colors"
                >
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                  <option value="Ongoing">Ongoing</option>
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-[32px] space-y-4 shadow-sm">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  TCV Range
                </label>
                <select
                  value={tcvBracket}
                  onChange={(e) => setTcvBracket(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-indigo-200"
                >
                  {TCV_BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-[32px] space-y-4 shadow-sm">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Cycle Time
                </label>
                <select
                  value={cycleDuration}
                  onChange={(e) => setCycleDuration(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-indigo-200"
                >
                  {DURATION_BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-[32px] flex flex-col space-y-4 shadow-sm">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  RFx / Tender
                </label>
                <div className="grid grid-cols-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsTender(true)}
                    className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isTender ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTender(false)}
                    className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${!isTender ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 border border-slate-200 rounded-[40px] space-y-8 shadow-inner">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-900 uppercase tracking-widest block mb-1">
                    Buying Team Map
                  </label>
                  <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                    Select departments involved in the deal evaluation
                  </p>
                </div>
                <div className="bg-white px-5 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-indigo-600 uppercase tracking-widest shadow-sm">
                  {buyingTeam.length} Stakeholders Identified
                </div>
              </div>

              <div className="max-w-xl">
                <select
                  onChange={handleDeptAdd}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm hover:border-indigo-200 transition-colors cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a department to add...
                  </option>
                  {DEPARTMENTS.map((dept) => (
                    <option
                      key={dept}
                      value={dept}
                      disabled={buyingTeam.includes(dept)}
                    >
                      {dept} {buyingTeam.includes(dept) ? "✓" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {buyingTeam.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {buyingTeam.map((dept) => (
                    <div
                      key={dept}
                      className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center space-x-3 group"
                    >
                      <span>{dept}</span>
                      <button
                        type="button"
                        onClick={() => removeDept(dept)}
                        className="w-4 h-4 rounded-full bg-indigo-700 flex items-center justify-center hover:bg-rose-500 transition-colors"
                      >
                        <i className="fas fa-times text-[8px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Scorecard */}
          <section className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-indigo-500 shadow-md">
                3
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                Scorecard
              </h3>
            </div>
            <div className="bg-slate-50/50 p-10 rounded-[40px] border border-slate-100 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ScorecardCard
                  label="Responsiveness"
                  value={commRating}
                  onChange={setCommRating}
                  icon="fas fa-comments"
                  starTooltips={[
                    "Ghosting",
                    "Poor",
                    "Average",
                    "Good",
                    "Elite",
                  ]}
                />
                <ScorecardCard
                  label="Negotiation Ease"
                  value={negotiation}
                  onChange={setNegotiation}
                  icon="fas fa-handshake"
                  starTooltips={[
                    "Brutal",
                    "Difficult",
                    "Fair",
                    "Smooth",
                    "Instant",
                  ]}
                />
                <ScorecardCard
                  label="Buyer Intent"
                  value={timeWaster}
                  onChange={setTimeWaster}
                  icon="fas fa-bullseye"
                  starTooltips={[
                    "Tire Kicker",
                    "Exploratory",
                    "Validated",
                    "Strategic",
                    "Critical",
                  ]}
                />
                <ScorecardCard
                  label="Scope Maturity"
                  value={clarityScope}
                  onChange={setClarityScope}
                  icon="fas fa-map"
                  starTooltips={[
                    "Volatile",
                    "Vague",
                    "Consistent",
                    "Structured",
                    "Crystal",
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Section 4: Strategic Context */}
          <section className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-indigo-500 shadow-md">
                4
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                Strategic Context
              </h3>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share tactical advice (AI will anonymize sensitive names)..."
              className="w-full h-72 bg-slate-50 border-2 border-slate-100 rounded-[40px] px-12 py-10 focus:bg-white focus:border-indigo-200 outline-none transition resize-none text-slate-700 leading-relaxed text-lg shadow-inner"
            />
          </section>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !selectedCompany ||
              !content ||
              commRating === 0 ||
              negotiation === 0 ||
              timeWaster === 0 ||
              clarityScope === 0 ||
              buyingTeam.length === 0
            }
            className="w-full bg-[#0f172a] text-white py-10 rounded-[40px] font-black text-2xl hover:bg-black transition-all disabled:bg-slate-100 disabled:text-slate-300 shadow-xl shadow-slate-200/50"
          >
            {isSubmitting
              ? "Publishing Review..."
              : "Publish Intelligence Review"}
          </button>
        </form>
      </div>
    </div>
  );
};

const ScorecardCard: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: string;
  starTooltips: string[];
}> = ({ label, value, onChange, icon, starTooltips }) => {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const current = hoveredStar || value;
  return (
    <div
      className={`p-8 rounded-[32px] border-2 transition-all flex flex-col items-center text-center group hover:scale-[1.02] ${value > 0 ? "bg-white border-indigo-600 shadow-lg ring-4 ring-indigo-50" : "bg-slate-50/50 border-slate-200 shadow-sm"}`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-colors ${current > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"}`}
      >
        <i className={icon}></i>
      </div>
      <h4 className="font-black text-slate-900 text-[12px] uppercase tracking-[0.15em] mb-4">
        {label}
      </h4>
      <div className="flex space-x-2.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHoveredStar(s)}
            onMouseLeave={() => setHoveredStar(null)}
            className={`text-2xl transition-all ${s <= (hoveredStar || value) ? "text-indigo-600" : "text-slate-200"}`}
          >
            <i className="fas fa-star"></i>
          </button>
        ))}
      </div>
      <div className="h-4 mt-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
        {current > 0 ? starTooltips[current - 1] : ""}
      </div>
    </div>
  );
};

export default CreateReview;
