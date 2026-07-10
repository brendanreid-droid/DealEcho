import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Company, Review } from "../types";
import { searchCompanies } from "../services/geminiService";
import CompanyLogo from "../components/CompanyLogo";
import Icon from "../src/components/Icon";
import { Loader2 } from "lucide-react";
import { useToast } from "../src/components/Toast";
import { companyLogoUrl } from "../src/utils/companyLogo";
import { DEPARTMENTS, TCV_BRACKETS, DURATION_BRACKETS } from "../src/constants/dealData";
import { MappedUser } from "../src/hooks/useAuth";
import { ReviewCooldownError } from "../src/hooks/useReviews";
import { track } from "../src/utils/analytics";

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface CreateReviewProps {
  user: MappedUser | null;
  onAddReview: (review: Review) => Promise<boolean>;
  onSignInClick?: () => void;
}

const CreateReview: React.FC<CreateReviewProps> = ({
  user,
  onAddReview,
  onSignInClick,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const { search } = useLocation();
  const errorRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(
    () => new URLSearchParams(search).get("company") ?? ""
  );
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(
    locationState?.prefilledCompany || null,
  );



  const [tcvBracket, setTcvBracket] = useState<string>(TCV_BRACKETS[0]);
  const [cycleDuration, setCycleDuration] = useState<string>(DURATION_BRACKETS[0]);
  const [status, setStatus] = useState<"Won" | "Lost" | "Ongoing">("Won");
  const [isTender, setIsTender] = useState(false);
  const [buyingTeam, setBuyingTeam] = useState<string[]>([]);
  const [commRating, setCommRating] = useState(0);
  const [negotiation, setNegotiation] = useState(0);
  const [timeWaster, setTimeWaster] = useState(0);
  const [clarityScope, setClarityScope] = useState(0);
  const [content, setContent] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
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
    if (!acknowledged) {
      setError(
        "Please confirm the review guidelines checkbox before submitting.",
      );
      errorRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setIsSubmitting(true);
    setError(null);
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
      logoUrl: selectedCompany.logoUrl,
      createdAt: new Date().toISOString(),
    };
    onAddReview(newReview).then((success) => {
      setIsSubmitting(false);
      if (success) {
        toast.success("Review submitted for moderation.");
        track("review_submitted", { company: selectedCompany.name });
        navigate("/");
      } else {
        toast.error("Failed to save review. Please try again.");
      }
    }).catch((err) => {
      setIsSubmitting(false);
      if (err instanceof ReviewCooldownError) {
        const when = err.nextAllowedAt
          ? ` You can review ${selectedCompany.name} again after ${formatDate(err.nextAllowedAt)}.`
          : "";
        const msg = `You can only submit one review per company every 6 months.${when}`;
        setError(msg);
        errorRef.current?.scrollIntoView({ behavior: "smooth" });
        toast.error("Review limit reached for this company.");
        return;
      }
      console.error(err);
      toast.error("Failed to save review. Please try again.");
    });
  };

  if (!user) {
    return (
      <div className="bg-navy min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/5 blur-[120px] rounded-full"></div>
        <div className="max-w-xl w-full bg-white/5 border border-white/10 backdrop-blur-3xl rounded-card p-10 md:p-16 text-center space-y-10 relative z-10 shadow-2xl">
          <div className="w-20 h-20 bg-accent text-white rounded-card flex items-center justify-center mx-auto shadow-2xl">
            <Icon name="fa-pen-nib" size={30} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight uppercase tracking-widest">
              Write Review
            </h1>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
              Sharing sales reviews and deal mechanics requires a verified
              account to maintain the integrity of our network.
            </p>
          </div>
          <button
            onClick={onSignInClick}
            className="w-full bg-accent text-white py-5 rounded-control font-bold uppercase tracking-widest shadow-xl hover:bg-accent-700 transition-all flex items-center justify-center space-x-3"
          >
            <Icon name="fa-lock" className="opacity-50" size={12} />
            <span>Sign In to Contribute</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-4 md:px-6">
      <div className="bg-white rounded-card border border-slate-100 shadow-[0_20px_80px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="bg-navy p-8 md:p-12 text-white relative">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-accent/10 blur-[120px] rounded-full -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-4">
              <span className="bg-accent/30 text-accent-soft text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-accent/20 backdrop-blur-md flex items-center w-fit">
                <Icon name="fa-user-check" className="mr-2" size={10} />
                {user.isPro
                  ? "Sales Pro Verified"
                  : "Verified Community Member"}
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              Write Review
            </h2>
            <p className="text-slate-400 text-base md:text-lg mt-4 font-medium max-w-2xl opacity-80 leading-relaxed">
              Document deal mechanics and tactical hurdles for the community.
            </p>
          </div>
        </div>

        <div ref={errorRef}>
          {error && (
            <div className="mx-6 md:mx-12 mt-6 p-6 bg-rose-50 border border-rose-100 rounded-card text-rose-600 text-sm font-bold flex items-center shadow-sm">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center mr-5 shrink-0 text-rose-600">
                <Icon name="fa-exclamation-triangle" size={18} />
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
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-accent/30 shadow-md">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">
                Target Account
              </h3>
            </div>

            {!selectedCompany ? (
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300">
                    <Icon name="fa-search" size={20} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a company (e.g., Snowflake, Palantir)..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-card pl-16 pr-8 py-6 focus:bg-white focus:border-accent/30 outline-none transition text-slate-700 text-xl font-medium shadow-inner"
                  />
                  {isSearching && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2">
                      <Loader2 className="animate-spin text-accent" size={20} />
                    </div>
                  )}
                </div>

                {/* AI Search Result Dropdown */}
                {searchResults.length > 0 && !isSearching && (
                  <div className="bg-white border-2 border-slate-100 rounded-card overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50 px-8 py-3 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Select Verified Entity
                      </span>
                      <span className="text-[9px] font-bold text-accent uppercase flex items-center">
                        <Icon name="fa-magic" className="mr-1.5" size={12} /> Google Search
                        Grounding Active
                      </span>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                      {searchResults.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => setSelectedCompany(company)}
                          className="w-full text-left px-8 py-5 hover:bg-accent-50/50 flex items-center space-x-5 transition-colors group"
                        >
                          <CompanyLogo
                            name={company.name}
                            logoUrl={company.logoUrl}
                            size="md"
                            className="group-hover:scale-105 transition"
                          />
                          <div className="flex-grow">
                            <div className="font-bold text-slate-900 group-hover:text-accent transition-colors">
                              {company.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {company.industry} &bull; {company.country}
                            </div>
                          </div>
                          <Icon name="fa-plus" className="text-slate-200 group-hover:text-accent-soft opacity-0 group-hover:opacity-100 transition-all" size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isSearching && (
                  <div className="text-center py-10 space-y-3">
                    <div className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] animate-pulse">
                      Querying Google AI...
                    </div>
                  </div>
                )}

                {/* Verified Company Lookup Only Notice */}
                {!isSearching &&
                  searchResults.length === 0 &&
                  searchQuery.length > 2 && (
                    <div className="text-center py-8 bg-slate-50 rounded-control border-2 border-dashed border-slate-100 p-6">
                      <p className="text-slate-600 font-bold text-sm">
                        No validated companies found matching “{searchQuery}”
                      </p>
                      <p className="text-slate-400 text-xs mt-2 max-w-sm mx-auto leading-relaxed font-medium">
                        To maintain data integrity and prevent duplicates, all reviews must be submitted against verified company entities resolved via our Google search.
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-10 bg-accent-50/20 border-2 border-accent/30 rounded-card group transition-all hover:bg-accent-50/40 shadow-sm">
                <div className="flex items-center space-x-8">
                  <CompanyLogo
                    name={selectedCompany.name}
                    logoUrl={selectedCompany.logoUrl}
                    size="lg"
                    className="shadow-xl border-2 border-white"
                  />
                  <div>
                    <div className="flex items-center space-x-3">
                      <div className="font-bold text-3xl text-slate-900 leading-tight tracking-tight">
                        {selectedCompany.name}
                      </div>
                      <span className="bg-accent-100 text-accent text-[8px] font-bold px-2 py-1 rounded-md uppercase tracking-widest border border-accent/30">
                        Verified Account
                      </span>
                    </div>
                    <span className="text-[10px] text-accent uppercase tracking-widest font-bold bg-white px-2 py-1 rounded-md border border-accent/30 mt-2 inline-block">
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
                  <Icon name="fa-times" className="group-hover/btn:rotate-90 transition-transform" size={16} />
                </button>
              </div>
            )}
          </section>

          {/* Section 2: Deal Logistics */}
          <section className="space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-accent/30 shadow-md">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">
                Deal Logistics
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card space-y-4 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Outcome
                </label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "Won" | "Lost" | "Ongoing")
                  }
                  className="w-full bg-white border border-slate-200 rounded-control px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-accent/30 transition-colors"
                >
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                  <option value="Ongoing">Ongoing</option>
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card space-y-4 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  TCV Range
                </label>
                <select
                  value={tcvBracket}
                  onChange={(e) => setTcvBracket(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-control px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-accent/30"
                >
                  {TCV_BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card space-y-4 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Cycle Time
                </label>
                <select
                  value={cycleDuration}
                  onChange={(e) => setCycleDuration(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-control px-4 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer hover:border-accent/30"
                >
                  {DURATION_BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-8 bg-slate-50/80 border border-slate-200 rounded-card flex flex-col space-y-4 shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  RFx / Tender
                </label>
                <div className="grid grid-cols-2 bg-white p-1.5 rounded-control border border-slate-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsTender(true)}
                    className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${isTender ? "bg-accent text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTender(false)}
                    className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${!isTender ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 border border-slate-200 rounded-card space-y-8 shadow-inner">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-900 uppercase tracking-widest block mb-1">
                    Buying Team Map
                  </label>
                  <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                    Select departments involved in the deal evaluation
                  </p>
                </div>
                <div className="bg-white px-5 py-2 rounded-xl border border-slate-200 text-[10px] font-bold text-accent uppercase tracking-widest shadow-sm">
                  {buyingTeam.length} Stakeholders Identified
                </div>
              </div>

              <div className="max-w-xl">
                <select
                  onChange={handleDeptAdd}
                  className="w-full bg-white border-2 border-slate-100 rounded-control px-6 py-4 text-sm font-bold text-slate-700 outline-none shadow-sm hover:border-accent/30 transition-colors cursor-pointer"
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
                      className="bg-accent text-white px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center space-x-3 group"
                    >
                      <span>{dept}</span>
                      <button
                        type="button"
                        onClick={() => removeDept(dept)}
                        className="w-4 h-4 rounded-full bg-accent-700 flex items-center justify-center hover:bg-rose-500 transition-colors text-white"
                      >
                        <Icon name="fa-times" size={8} />
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
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-accent/30 shadow-md">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">
                Scorecard
              </h3>
            </div>
            <div className="bg-slate-50/50 p-10 rounded-card border border-slate-100 shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ScorecardCard
                  label="Responsiveness"
                  value={commRating}
                  onChange={setCommRating}
                  icon="fa-comments"
                  starTooltips={[
                    "Ghosting",
                    "Poor",
                    "Average",
                    "Good",
                    "Elite",
                  ]}
                />
                <ScorecardCard
                  label="Negotiation"
                  value={negotiation}
                  onChange={setNegotiation}
                  icon="fa-handshake"
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
                  icon="fa-bullseye"
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
                  icon="fa-map"
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
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm border-2 border-accent/30 shadow-md">
                4
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">
                Strategic Context
              </h3>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share tactical advice about the deal. Do NOT include individual names, job titles/positions, weblinks, or confidential commercial details..."
              className="w-full h-72 bg-slate-50 border-2 border-slate-100 rounded-card px-12 py-10 focus:bg-white focus:border-accent/30 outline-none transition resize-none text-slate-700 leading-relaxed text-lg shadow-inner"
            />
            <div className="flex items-center justify-between px-4">
              <p className="text-sm text-slate-500 font-medium">
                {content.trim().split(/\s+/).length < 50 ? (
                  <>Share what <strong>worked</strong> and what <strong>didn't</strong> in your sales cycle</>
                ) : (
                  <span className="text-emerald-600 font-bold">✓ Ready to submit</span>
                )}
              </p>
              <div className={`text-sm font-bold ${content.trim().split(/\s+/).length >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {content.trim().split(/\s+/).filter(w => w).length}/50 words
              </div>
            </div>
          </section>

          {/* Review guidelines + required acknowledgement */}
          <section className="space-y-5">
            <div className="p-8 bg-amber-50/60 border border-amber-100 rounded-card space-y-4">
              <div className="flex items-center space-x-3 text-amber-700">
                <Icon name="fa-shield-halved" size={16} />
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em]">
                  Before you submit
                </h4>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Reviews must be <strong>honest and based on your own direct
                experience</strong>. To protect everyone, do not include:
              </p>
              <ul className="text-sm text-slate-600 leading-relaxed font-medium space-y-1.5 list-disc pl-5">
                <li>Names of individuals, or job titles / positions that identify a specific person</li>
                <li>Web links or URLs</li>
                <li>Confidential, commercially sensitive, or personal information (exact pricing, contract terms, contact details)</li>
              </ul>
              <p className="text-[11px] text-slate-400 font-medium">
                Generic department references (e.g. "the procurement team") are fine. Reviews are moderated and rejected if they breach these rules.
              </p>
            </div>

            <label className="flex items-start space-x-4 cursor-pointer group p-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-accent focus:ring-accent cursor-pointer shrink-0"
              />
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors leading-relaxed">
                I confirm this review is honest and based on my own experience, and
                contains no confidential, commercial, or personal information, and
                does not identify any individual.
              </span>
            </label>
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
              buyingTeam.length === 0 ||
              !acknowledged
            }
            className="w-full bg-navy text-white py-10 rounded-card font-bold text-2xl hover:bg-black transition-all disabled:bg-slate-100 disabled:text-slate-300 shadow-xl shadow-slate-200/50"
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
      className={`p-8 rounded-card border-2 transition-all flex flex-col items-center text-center group hover:scale-[1.02] ${value > 0 ? "bg-white border-accent shadow-lg ring-4 ring-accent-50" : "bg-slate-50/50 border-slate-200 shadow-sm"}`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-colors ${current > 0 ? "bg-accent text-white" : "bg-slate-200 text-slate-400"}`}
      >
        <Icon name={icon} size={24} />
      </div>
      <h4 className="font-bold text-slate-900 text-[12px] uppercase tracking-[0.15em] mb-4">
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
            className={`text-2xl transition-all flex items-center justify-center ${s <= (hoveredStar || value) ? "text-accent" : "text-slate-200"}`}
          >
            <Icon name="fa-star" size={24} />
          </button>
        ))}
      </div>
      <div className="h-4 mt-4 text-[10px] font-bold text-accent uppercase tracking-widest">
        {current > 0 ? starTooltips[current - 1] : ""}
      </div>
    </div>
  );
};

export default CreateReview;
