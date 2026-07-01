import React, { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Loader2 } from "lucide-react";
import Icon from "./Icon";
import { useMyReviews } from "../hooks/useMyReviews";

/**
 * Persistent surface where a user sees their own reviews that are NOT yet
 * publicly live — rejected ones (with the moderation reason + an edit/resubmit
 * flow) and pending ones (still under review). Approved reviews already appear
 * in the Workspace History list, so they're excluded here.
 */
const MySubmissions: React.FC<{ userId: string }> = ({ userId }) => {
  const { myReviews, isLoading } = useMyReviews(userId);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; msg: string } | null>(null);

  const pending = useMemo(
    () => myReviews.filter((r) => r.moderationStatus === "pending"),
    [myReviews],
  );
  const rejected = useMemo(
    () =>
      myReviews.filter(
        (r) => r.moderationStatus === "rejected" || r.moderationStatus === "flagged",
      ),
    [myReviews],
  );

  const handleResubmit = async (reviewId: string, content: string) => {
    if (content.trim().length < 20) {
      setErrorId({ id: reviewId, msg: "Review must be at least 20 characters." });
      return;
    }
    setSavingId(reviewId);
    setErrorId(null);
    try {
      const functions = getFunctions(undefined, "australia-southeast1");
      const resubmit = httpsCallable(functions, "resubmitReview");
      await resubmit({ reviewId, content });
      // The live query flips this review to 'pending' automatically.
      setEditing((prev) => {
        const next = { ...prev };
        delete next[reviewId];
        return next;
      });
    } catch (err: any) {
      setErrorId({ id: reviewId, msg: err?.message || "Failed to resubmit. Please try again." });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading || (pending.length === 0 && rejected.length === 0)) {
    return null; // nothing to surface
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center">
          <Icon name="fa-inbox" className="text-amber-500 mr-3" size={18} />
          My Submissions
        </h3>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {rejected.length} Needs Action &bull; {pending.length} In Review
        </span>
      </div>

      {rejected.map((r) => {
        const draft = editing[r.id] ?? r.content;
        const isOpen = r.id in editing;
        return (
          <div
            key={r.id}
            className="bg-white p-6 md:p-8 rounded-[28px] border-2 border-rose-100 shadow-sm space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-900">{r.companyName}</h4>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {r.industry} &bull; {r.country || r.location}
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100">
                Rejected
              </span>
            </div>

            <div className="flex items-start space-x-3 bg-rose-50/60 border border-rose-100 rounded-2xl p-4">
              <Icon name="fa-exclamation-triangle" className="text-rose-500 mt-0.5 shrink-0" size={14} />
              <div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">
                  Why this was rejected
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {r.moderationReason || "Flagged by content moderation."}
                </p>
              </div>
            </div>

            {isOpen ? (
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, [r.id]: e.target.value }))
                  }
                  className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-indigo-200 outline-none transition resize-none text-slate-700 leading-relaxed"
                />
                {errorId?.id === r.id && (
                  <p className="text-xs font-bold text-rose-600">{errorId.msg}</p>
                )}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleResubmit(r.id, draft)}
                    disabled={savingId === r.id}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center space-x-2"
                  >
                    {savingId === r.id ? (
                      <>
                        <Loader2 className="animate-spin" size={12} />
                        <span>Resubmitting…</span>
                      </>
                    ) : (
                      <span>Resubmit for Review</span>
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setEditing((prev) => {
                        const next = { ...prev };
                        delete next[r.id];
                        return next;
                      })
                    }
                    className="px-6 py-3 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing((prev) => ({ ...prev, [r.id]: r.content }))}
                className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center space-x-2"
              >
                <Icon name="fa-pen" size={10} />
                <span>Edit &amp; Resubmit</span>
              </button>
            )}
          </div>
        );
      })}

      {pending.map((r) => (
        <div
          key={r.id}
          className="bg-white p-6 rounded-[28px] border border-amber-100 shadow-sm flex items-center justify-between"
        >
          <div>
            <h4 className="font-bold text-slate-900">{r.companyName}</h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {r.industry} &bull; {r.country || r.location}
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100 flex items-center space-x-2">
            <Loader2 className="animate-spin" size={10} />
            <span>Under Review</span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default MySubmissions;
