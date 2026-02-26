import React, { useState, useEffect, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../src/firebase/config";
import { useAuth } from "../src/hooks/useAuth";
import { Navigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = "free" | "paid" | "admin";

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: UserRole;
  tier: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

interface AdminReview {
  id: string;
  companyName?: string;
  content?: string;
  rating?: number;
  userId?: string;
  userName?: string;
  status?: string;
  createdAt?: string;
  editedByAdmin?: boolean;
}

type Tab = "users" | "content" | "pricing";

// ── Role badge UI ─────────────────────────────────────────────────────────────
const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  paid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  free: "bg-slate-100 text-slate-500 border border-slate-200",
};

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest ${ROLE_STYLES[role]}`}
  >
    {role}
  </span>
);

// ── Toast notification ────────────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}
let _toastId = 0;

// ── Main Admin Page ───────────────────────────────────────────────────────────
const Admin: React.FC = () => {
  const { isAdmin, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contentSearchQuery, setContentSearchQuery] = useState("");
  const [contentUserFilter, setContentUserFilter] = useState<string | null>(
    null,
  );

  // Edit modal state
  const [editReview, setEditReview] = useState<AdminReview | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Pricing state
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [pricingCurrency, setPricingCurrency] = useState("aud");
  const [currentPricing, setCurrentPricing] = useState<any>(null);

  const functions = getFunctions(undefined, "australia-southeast1");

  const addToast = (message: string, type: "success" | "error") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3500,
    );
  };

  // Load users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const fn = httpsCallable<object, { users: AdminUser[] }>(
        functions,
        "adminGetUsers",
      );
      const result = await fn({});
      setUsers(result.data.users);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      addToast(msg, "error");
    } finally {
      setUsersLoading(false);
    }
  }, [functions]);

  // Load reviews from Firestore via Admin SDK (using existing auth)
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const { getFirestore, collection, getDocs, orderBy, query, limit } =
        await import("firebase/firestore");
      const db = getFirestore();
      const q = query(
        collection(db, "reviews"),
        orderBy("createdAt", "desc"),
        limit(100),
      );
      const snap = await getDocs(q);
      setReviews(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminReview),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load reviews";
      addToast(msg, "error");
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  // Load pricing config
  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const fn = httpsCallable<object, any>(functions, "adminGetPricing");
      const result = await fn({});
      const data = result.data;
      setCurrentPricing(data);
      setMonthlyPrice(((data.monthlyAmount ?? 0) / 100).toFixed(2));
      setAnnualPrice(((data.annualAmount ?? 0) / 100).toFixed(2));
      setPricingCurrency(data.currency ?? "aud");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load pricing";
      addToast(msg, "error");
    } finally {
      setPricingLoading(false);
    }
  }, [functions]);

  // Update pricing
  const handleUpdatePricing = async () => {
    const monthly = Math.round(parseFloat(monthlyPrice) * 100);
    const annual = Math.round(parseFloat(annualPrice) * 100);

    if (isNaN(monthly) || isNaN(annual) || monthly < 100 || annual < 100) {
      addToast("Prices must be at least $1.00", "error");
      return;
    }

    if (
      !window.confirm(
        `Update prices to $${(monthly / 100).toFixed(2)}/mo and $${(annual / 100).toFixed(2)}/yr? This creates new Stripe price objects.`,
      )
    ) {
      return;
    }

    setPricingSaving(true);
    try {
      const fn = httpsCallable<any, any>(functions, "adminUpdatePricing");
      const result = await fn({
        monthlyAmount: monthly,
        annualAmount: annual,
        currency: pricingCurrency,
      });
      setCurrentPricing(result.data);
      addToast(
        "Pricing updated successfully! New subscribers will see updated prices.",
        "success",
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update pricing";
      addToast(msg, "error");
    } finally {
      setPricingSaving(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !isLoading) {
      loadUsers();
      loadReviews();
      loadPricing();
    }
  }, [isAdmin, isLoading, loadUsers, loadReviews]);

  // Real-time Firestore listener: reflect role/subscription changes without refresh
  useEffect(() => {
    if (!isAdmin || isLoading) return;

    let unsubscribe: (() => void) | null = null;

    (async () => {
      const { getFirestore, collection, onSnapshot } =
        await import("firebase/firestore");
      const db = getFirestore();
      unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const changes: Record<string, any> = {};
        snapshot.docs.forEach((doc) => {
          changes[doc.id] = doc.data();
        });
        setUsers((prev) =>
          prev.map((u) => {
            const fsData = changes[u.uid];
            if (!fsData) return u;
            return {
              ...u,
              role: (fsData.role as UserRole) ?? u.role,
              tier: fsData.tier ?? u.tier,
              subscriptionStatus:
                fsData.subscriptionStatus ?? u.subscriptionStatus,
              currentPeriodEnd: fsData.currentPeriodEnd ?? u.currentPeriodEnd,
            };
          }),
        );
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAdmin, isLoading]);

  // Change user role
  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      const fn = httpsCallable<
        { targetUid: string; role: UserRole },
        {
          success: boolean;
          role: UserRole;
          tier: string;
          subscriptionStatus: string | null;
        }
      >(functions, "adminSetRole");
      const res = await fn({ targetUid: uid, role: newRole });
      const { role, tier, subscriptionStatus } = res.data;
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid ? { ...u, role, tier, subscriptionStatus } : u,
        ),
      );
      addToast("Role updated successfully", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      addToast(msg, "error");
    }
  };

  // Delete review
  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    try {
      const fn = httpsCallable(functions, "adminDeleteContent");
      await fn({ reviewId });
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      addToast("Review deleted", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete review";
      addToast(msg, "error");
    }
  };

  // Edit review
  const handleSaveEdit = async () => {
    if (!editReview) return;
    setEditSaving(true);
    try {
      const fn = httpsCallable(functions, "adminEditContent");
      await fn({ reviewId: editReview.id, updates: { content: editContent } });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === editReview.id
            ? { ...r, content: editContent, editedByAdmin: true }
            : r,
        ),
      );
      setEditReview(null);
      addToast("Review updated", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update review";
      addToast(msg, "error");
    } finally {
      setEditSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.companyName?.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
      r.content?.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
      r.userName?.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
      r.userId?.toLowerCase().includes(contentSearchQuery.toLowerCase());

    const matchesUser = contentUserFilter
      ? r.userId === contentUserFilter
      : true;

    return matchesSearch && matchesUser;
  });

  const stats = {
    total: users.length,
    paid: users.filter((u) => u.role === "paid").length,
    admins: users.filter((u) => u.role === "admin").length,
    reviews: reviews.length,
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Toast notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all animate-fade-in ${
              t.type === "success"
                ? "bg-emerald-900/90 border border-emerald-500/30 text-emerald-200"
                : "bg-rose-900/90 border border-rose-500/30 text-rose-200"
            }`}
          >
            <i
              className={`fas ${t.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}
            />
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-shield-alt text-white text-sm" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Admin Panel</h1>
              <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
                DealEcho Control Centre
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <i className="fas fa-user-shield text-indigo-400" />
            <span className="font-semibold">{auth.currentUser?.email}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Users",
              value: stats.total,
              icon: "fa-users",
              color: "text-indigo-400",
            },
            {
              label: "Paid Users",
              value: stats.paid,
              icon: "fa-star",
              color: "text-emerald-400",
            },
            {
              label: "Admins",
              value: stats.admins,
              icon: "fa-shield-alt",
              color: "text-amber-400",
            },
            {
              label: "Reviews",
              value: stats.reviews,
              icon: "fa-comment-alt",
              color: "text-sky-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white/5 border border-white/10 rounded-3xl p-5"
            >
              <div className={`text-2xl mb-1 ${s.color}`}>
                <i className={`fas ${s.icon}`} />
              </div>
              <div className="text-3xl font-black">{s.value}</div>
              <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 w-fit mb-6">
          {(["users", "content", "pricing"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black capitalize transition-all ${
                tab === t
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <i
                className={`fas ${t === "users" ? "fa-users" : t === "content" ? "fa-comment-alt" : "fa-tags"} mr-2`}
              />
              {t === "users"
                ? `Users (${stats.total})`
                : t === "content"
                  ? `Reviews (${stats.reviews})`
                  : "Pricing"}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            <div className="mb-4">
              <div className="relative max-w-sm">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-white/10">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      {[
                        "User",
                        "Role",
                        "Tier",
                        "Subscription",
                        "Period End",
                        "Joined",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr
                        key={u.uid}
                        className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                          i % 2 === 0 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-sm font-black text-indigo-400">
                              {(u.displayName || u.email)?.[0]?.toUpperCase() ??
                                "?"}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-white">
                                {u.displayName || "—"}
                              </div>
                              <div className="text-slate-500 text-xs">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-400 text-xs font-semibold">
                            {u.tier}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-xs font-bold ${
                              u.subscriptionStatus === "active"
                                ? "text-emerald-400"
                                : u.subscriptionStatus
                                  ? "text-amber-400"
                                  : "text-slate-500"
                            }`}
                          >
                            {u.subscriptionStatus ?? "None"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-400 text-xs">
                            {u.currentPeriodEnd
                              ? new Date(
                                  u.currentPeriodEnd,
                                ).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-400 text-xs">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  u.uid,
                                  e.target.value as UserRole,
                                )
                              }
                              className="bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-indigo-500 transition-colors"
                              style={{ colorScheme: "dark" }}
                            >
                              <option
                                value="free"
                                className="bg-[#0f172a] text-white"
                              >
                                Free
                              </option>
                              <option
                                value="paid"
                                className="bg-[#0f172a] text-white"
                              >
                                Paid
                              </option>
                              <option
                                value="admin"
                                className="bg-[#0f172a] text-white"
                              >
                                Admin
                              </option>
                            </select>
                            <button
                              onClick={() => {
                                setContentUserFilter(u.uid);
                                setTab("content");
                              }}
                              className="px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold hover:bg-indigo-600/40 transition-colors"
                              title="View user posts"
                            >
                              <i className="fas fa-eye mr-1" />
                              Content
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-16 text-slate-500">
                    <i className="fas fa-search text-3xl mb-3 block" />
                    No users match your search
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT TAB ── */}
        {tab === "content" && (
          <div>
            <div className="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative w-full max-w-sm">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                <input
                  type="text"
                  placeholder="Search reviews or UID…"
                  value={contentSearchQuery}
                  onChange={(e) => setContentSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {contentUserFilter && (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl">
                  <span className="text-xs font-bold text-indigo-400">
                    <i className="fas fa-filter mr-2" />
                    Filtering by User ID: {contentUserFilter.slice(0, 8)}…
                  </span>
                  <button
                    onClick={() => setContentUserFilter(null)}
                    className="text-indigo-400 hover:text-white transition-colors"
                  >
                    <i className="fas fa-times-circle" />
                  </button>
                </div>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-white/10">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      {[
                        "Company",
                        "Review Excerpt",
                        "Author",
                        "Status",
                        "Date",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReviews.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          i % 2 === 0 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-semibold text-sm text-white">
                            {r.companyName ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-slate-400 text-xs line-clamp-2">
                            {r.content ?? "—"}
                          </p>
                          {r.editedByAdmin && (
                            <span className="text-amber-400 text-[10px] font-bold mt-1 block">
                              ✏ Edited by admin
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <span className="text-white text-xs font-semibold">
                              {r.userName ?? "—"}
                            </span>
                            <span className="text-slate-600 text-[10px] font-mono block">
                              {r.userId?.slice(0, 8) ?? ""}…
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-lg ${
                              r.status === "Won"
                                ? "bg-emerald-900/40 text-emerald-400"
                                : r.status === "Lost"
                                  ? "bg-rose-900/40 text-rose-400"
                                  : "bg-amber-900/40 text-amber-400"
                            }`}
                          >
                            {r.status ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-400 text-xs">
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditReview(r);
                                setEditContent(r.content ?? "");
                              }}
                              className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40 transition-colors flex items-center justify-center"
                              title="Edit"
                            >
                              <i className="fas fa-pen text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteReview(r.id)}
                              className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/40 transition-colors flex items-center justify-center"
                              title="Delete"
                            >
                              <i className="fas fa-trash text-xs" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredReviews.length === 0 && (
                  <div className="text-center py-16 text-slate-500">
                    <i className="fas fa-search text-3xl mb-3 block" />
                    {contentUserFilter
                      ? "This user has no posts"
                      : "No reviews match your search"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PRICING TAB ── */}
        {tab === "pricing" && (
          <div className="max-w-2xl">
            {pricingLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Current Pricing Info */}
                {currentPricing && (
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
                      <i className="fas fa-info-circle text-indigo-400 mr-2" />
                      Current Active Prices
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          Monthly
                        </div>
                        <div className="text-2xl font-black text-white">
                          {currentPricing.currency?.toUpperCase() ?? "AUD"} $
                          {((currentPricing.monthlyAmount ?? 0) / 100).toFixed(
                            2,
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {currentPricing.monthlyPriceId ?? "env default"}
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          Annual
                        </div>
                        <div className="text-2xl font-black text-white">
                          {currentPricing.currency?.toUpperCase() ?? "AUD"} $
                          {((currentPricing.annualAmount ?? 0) / 100).toFixed(
                            2,
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {currentPricing.annualPriceId ?? "env default"}
                        </div>
                      </div>
                    </div>
                    {currentPricing.updatedAt && (
                      <div className="text-[10px] text-slate-500 mt-3">
                        Last updated:{" "}
                        {new Date(currentPricing.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Update Form */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">
                    <i className="fas fa-edit text-indigo-400 mr-2" />
                    Update Subscription Prices
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Currency
                      </label>
                      <select
                        value={pricingCurrency}
                        onChange={(e) => setPricingCurrency(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 text-white text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="aud" className="bg-[#0f172a]">
                          AUD (Australian Dollar)
                        </option>
                        <option value="usd" className="bg-[#0f172a]">
                          USD (US Dollar)
                        </option>
                        <option value="gbp" className="bg-[#0f172a]">
                          GBP (British Pound)
                        </option>
                        <option value="eur" className="bg-[#0f172a]">
                          EUR (Euro)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Monthly Price ({pricingCurrency.toUpperCase()})
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={monthlyPrice}
                          onChange={(e) => setMonthlyPrice(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                          placeholder="15.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Annual Price ({pricingCurrency.toUpperCase()})
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={annualPrice}
                          onChange={(e) => setAnnualPrice(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                          placeholder="144.00"
                        />
                      </div>
                      {monthlyPrice && annualPrice && (
                        <div className="text-[10px] text-indigo-400 font-bold mt-2">
                          That's ${(parseFloat(annualPrice) / 12).toFixed(2)}/mo
                          —{" "}
                          {Math.round(
                            (1 -
                              parseFloat(annualPrice) /
                                12 /
                                parseFloat(monthlyPrice)) *
                              100,
                          )}
                          % savings vs monthly
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleUpdatePricing}
                      disabled={pricingSaving}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors disabled:opacity-60 mt-4"
                    >
                      {pricingSaving ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2" /> Creating
                          Stripe Prices...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save mr-2" /> Update Prices
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      <i className="fas fa-info-circle mr-1" />
                      This creates new Stripe Price objects and updates the
                      checkout flow. Existing subscribers keep their current
                      price. Only new subscribers will see the updated price.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-black mb-2">Edit Review</h3>
            <p className="text-slate-500 text-sm mb-5">
              Review by{" "}
              <span className="text-indigo-400 font-mono">
                {editReview.userId?.slice(0, 12)}…
              </span>{" "}
              for{" "}
              <span className="text-white font-semibold">
                {editReview.companyName}
              </span>
            </p>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="Review content…"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-colors disabled:opacity-60"
              >
                {editSaving ? (
                  <i className="fas fa-spinner fa-spin" />
                ) : (
                  "Save Changes"
                )}
              </button>
              <button
                onClick={() => setEditReview(null)}
                className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-400 font-black text-sm rounded-2xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
