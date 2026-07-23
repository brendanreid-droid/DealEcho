import React, { useState, useEffect, useCallback } from "react";
import Icon from "../src/components/Icon";
import { Loader2 } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../src/firebase/config";
import { useAuth } from "../src/hooks/useAuth";
import { Navigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = "free" | "paid" | "admin" | "free_full" | "enterprise";

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  role: UserRole;
  tier: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  suspended?: boolean;
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
  moderationStatus?: string;
  moderationReason?: string;
  flaggedSegments?: string[];
  moderatedAt?: string;
}

type Tab = "users" | "content" | "flagged" | "pricing" | "newsletter" | "marketing";

// ── Marketing attribution report ──────────────────────────────────────────────
interface AcquisitionRow {
  uid: string;
  email: string;
  displayName: string;
  emailDomain: string;
  isBusinessEmail: boolean;
  marketingRole: string;
  companySize: string;
  createdAt: string;
  role: string;
  tier: string;
  isPaid: boolean;
  first_source: string;
  first_medium: string;
  first_campaign: string;
  first_content: string;
  first_term: string;
  first_referrer: string;
  first_landing: string;
  first_capturedAt: string;
  last_source: string;
  last_medium: string;
  last_campaign: string;
  last_content: string;
}

interface CampaignRollup {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  signups: number;
  paid: number;
  conversionRate: number;
}

interface RoleRollup {
  role: string;
  signups: number;
  paid: number;
  conversionRate: number;
}

interface EmailTypeRollup {
  type: string;
  signups: number;
  paid: number;
  conversionRate: number;
}

interface AccountUser {
  email: string;
  displayName: string;
  marketingRole: string;
  isPaid: boolean;
  createdAt: string;
}

interface AccountRollup {
  domain: string;
  signups: number;
  paid: number;
  roles: string[];
  trackedCompanies: number;
  lastSignupAt: string;
  users: AccountUser[];
}

interface AcquisitionReport {
  rows: AcquisitionRow[];
  campaigns: CampaignRollup[];
  roles: RoleRollup[];
  emailTypes: EmailTypeRollup[];
  accounts: AccountRollup[];
  totalUsers: number;
  attributedUsers: number;
  businessEmailUsers: number;
  roleAnsweredUsers: number;
  generatedAt: string;
}

// Build a CSV string from an array of objects, ordered by the given columns.
// Values are quoted and internal quotes doubled per RFC 4180.
function toCsv<T extends Record<string, unknown>>(
  columns: (keyof T)[],
  rows: T[],
): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = columns.map((c) => escape(String(c))).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(r[c])).join(","))
    .join("\r\n");
  return header + "\r\n" + body;
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Role badge UI ─────────────────────────────────────────────────────────────
const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  paid: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  free_full: "bg-sky-100 text-sky-700 border border-sky-200",
  free: "bg-slate-100 text-slate-500 border border-slate-200",
  enterprise: "bg-violet-100 text-violet-700 border border-violet-200",
};

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest ${ROLE_STYLES[role]}`}
  >
    {role === "free_full" ? "free full" : role}
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

  // Flagged reviews state
  const [flaggedReviews, setFlaggedReviews] = useState<AdminReview[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(true);

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

  // Newsletter state
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterPreheader, setNewsletterPreheader] = useState("");
  const [newsletterTitle, setNewsletterTitle] = useState("");
  const [newsletterContent, setNewsletterContent] = useState("");
  const [newsletterSending, setNewsletterSending] = useState(false);
  const [newsletterTestEmail, setNewsletterTestEmail] = useState("");
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [newslettersLoading, setNewslettersLoading] = useState(false);
  const [newsletterSubTab, setNewsletterSubTab] = useState<"compose" | "history">("compose");
  const [selectedHistoryNewsletter, setSelectedHistoryNewsletter] = useState<any | null>(null);

  // Create User modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("free");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreateSuccess, setIsCreateSuccess] = useState(false);

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setIsCreateSuccess(false);
    setCreateEmail("");
    setCreateDisplayName("");
    setCreateRole("free");
  };

  const functions = getFunctions(undefined, "australia-southeast1");

  // Marketing attribution report state
  const [report, setReport] = useState<AcquisitionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

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

  // Load marketing attribution report
  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const fn = httpsCallable<object, AcquisitionReport>(
        functions,
        "adminGetAcquisitionReport",
      );
      const result = await fn({});
      setReport(result.data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load marketing report";
      addToast(msg, "error");
    } finally {
      setReportLoading(false);
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

  // Load flagged reviews
  const loadFlaggedReviews = useCallback(async () => {
    setFlaggedLoading(true);
    try {
      const { getFirestore, collection, getDocs, query, where, orderBy, limit } =
        await import("firebase/firestore");
      const db = getFirestore();
      const q = query(
        collection(db, "reviews"),
        where("moderationStatus", "==", "flagged"),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const snap = await getDocs(q);
      setFlaggedReviews(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminReview),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load flagged reviews";
      addToast(msg, "error");
    } finally {
      setFlaggedLoading(false);
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

  // Load newsletters campaign history
  const loadCampaigns = useCallback(async () => {
    setNewslettersLoading(true);
    try {
      const { getFirestore, collection, getDocs, orderBy, query } =
        await import("firebase/firestore");
      const db = getFirestore();
      const q = query(collection(db, "newsletters"), orderBy("sentAt", "desc"));
      const snap = await getDocs(q);
      setNewsletters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load newsletter campaigns.";
      addToast(msg, "error");
    } finally {
      setNewslettersLoading(false);
    }
  }, []);

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
      loadFlaggedReviews();
      loadCampaigns();
    }
  }, [isAdmin, isLoading, loadUsers, loadReviews, loadFlaggedReviews, loadCampaigns]);

  // Lazy-load the marketing report the first time its tab is opened (it lists
  // all users server-side, so we avoid running it on every admin page load).
  useEffect(() => {
    if (isAdmin && !isLoading && tab === "marketing" && !report && !reportLoading) {
      loadReport();
    }
  }, [isAdmin, isLoading, tab, report, reportLoading, loadReport]);

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

  // Create User Manually
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createDisplayName || !createRole) {
      addToast("All fields are required", "error");
      return;
    }
    setIsCreatingUser(true);
    try {
      const fn = httpsCallable<
        { email: string; displayName: string; role: UserRole },
        { success: boolean; user: AdminUser }
      >(functions, "adminCreateUser");
      const res = await fn({
        email: createEmail,
        displayName: createDisplayName,
        role: createRole,
      });
      if (res.data.success) {
        setUsers((prev) => [res.data.user, ...prev]);
        setIsCreateSuccess(true);
        addToast("User created successfully! Invitation sent.", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      addToast(msg, "error");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Toggle suspension state of user
  const handleToggleSuspension = async (uid: string, currentSuspended: boolean) => {
    const action = currentSuspended ? "reactivate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const fn = httpsCallable<
        { targetUid: string; suspend: boolean },
        { success: boolean; uid: string; suspended: boolean }
      >(functions, "adminToggleUserSuspension");
      const res = await fn({ targetUid: uid, suspend: !currentSuspended });
      if (res.data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === uid ? { ...u, suspended: res.data.suspended } : u
          )
        );
        addToast(
          `User ${res.data.suspended ? "suspended" : "reactivated"} successfully`,
          "success"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle suspension";
      addToast(msg, "error");
    }
  };

  // Delete User from Auth and Firestore (keep reviews)
  const handleDeleteUser = async (uid: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this user? Their profile and Auth credentials will be wiped, but all of their posts/reviews will remain in the database."
      )
    ) {
      return;
    }

    try {
      const fn = httpsCallable<
        { targetUid: string },
        { success: boolean; uid: string }
      >(functions, "adminDeleteUser");
      const res = await fn({ targetUid: uid });
      if (res.data.success) {
        setUsers((prev) => prev.filter((u) => u.uid !== uid));
        addToast("User deleted successfully. Posts remain active.", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
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
      setFlaggedReviews((prev) => prev.filter((r) => r.id !== reviewId));
      addToast("Review deleted", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete review";
      addToast(msg, "error");
    }
  };

  // Approve a flagged review
  const handleApproveReview = async (reviewId: string) => {
    try {
      const fn = httpsCallable(functions, "adminEditContent");
      await fn({ reviewId, updates: { moderationStatus: "approved", moderationReason: null, flaggedSegments: null } });
      setFlaggedReviews((prev) => prev.filter((r) => r.id !== reviewId));
      addToast("Review approved and published", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve review";
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

  // Mass send or test send the newsletter via adminSendNewsletter callable function
  const handleSendNewsletter = async (isTest: boolean) => {
    if (!newsletterSubject || !newsletterTitle || !newsletterContent) {
      addToast("Subject, Title, and Content are required.", "error");
      return;
    }

    if (isTest && !newsletterTestEmail) {
      addToast("Test email address is required.", "error");
      return;
    }

    if (!isTest) {
      const activeCount = users.filter((u) => !u.suspended).length;
      if (
        !window.confirm(
          `Are you sure you want to MASS BROADCAST this newsletter to all active subscribed users? This will instantly trigger delivery to up to ${activeCount} active user profiles.`
        )
      ) {
        return;
      }
    }

    setNewsletterSending(true);
    try {
      const fn = httpsCallable<
        {
          subject: string;
          preheaderText: string;
          title: string;
          content: string;
          isTest: boolean;
          testEmail?: string;
        },
        { success: boolean; sentCount: number; isTest: boolean }
      >(functions, "adminSendNewsletter");

      const res = await fn({
        subject: newsletterSubject,
        preheaderText: newsletterPreheader,
        title: newsletterTitle,
        content: newsletterContent,
        isTest,
        testEmail: isTest ? newsletterTestEmail : undefined,
      });

      if (res.data.success) {
        if (res.data.isTest) {
          addToast(`Test newsletter successfully sent to ${newsletterTestEmail}!`, "success");
        } else {
          addToast(`Newsletter successfully broadcasted to ${res.data.sentCount} active users!`, "success");
          // Clear composer states on successful mass delivery
          setNewsletterSubject("");
          setNewsletterPreheader("");
          setNewsletterTitle("");
          setNewsletterContent("");
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to deliver newsletter.";
      addToast(msg, "error");
    } finally {
      setNewsletterSending(false);
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
    flagged: flaggedReviews.length,
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Toast notifications */}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all animate-fade-in ${
              t.type === "success"
                ? "bg-emerald-900/90 border border-emerald-500/30 text-emerald-200"
                : "bg-rose-900/90 border border-rose-500/30 text-rose-200"
            }`}
          >
            <Icon
              name={t.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}
              className="mr-2 inline-block"
              size={14}
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
              <Icon name="fa-shield-alt" className="text-white text-sm" size={14} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Admin Panel</h1>
              <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
                Dealecho Control Centre
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Icon name="fa-user-shield" className="text-indigo-400" size={14} />
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
                <Icon name={s.icon} size={24} />
              </div>
              <div className="text-3xl font-black">{s.value}</div>
              <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-1">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap bg-white/5 border border-white/10 rounded-2xl p-1 w-fit mb-6">
          {(["users", "content", "flagged", "pricing", "newsletter", "marketing"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black capitalize transition-all relative ${
                tab === t
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon
                name={
                  t === "users"
                    ? "fa-users"
                    : t === "content"
                      ? "fa-comment-alt"
                      : t === "flagged"
                        ? "fa-shield-alt"
                        : t === "pricing"
                          ? "fa-tags"
                          : t === "newsletter"
                            ? "fa-paper-plane"
                            : "fa-chart-line"
                }
                className="mr-2 inline-block"
                size={14}
              />
              {t === "users"
                ? `Users (${stats.total})`
                : t === "content"
                  ? `Reviews (${stats.reviews})`
                  : t === "flagged"
                    ? `Flagged`
                    : t === "pricing"
                      ? "Pricing"
                      : t === "newsletter"
                        ? "Newsletter"
                        : "Marketing"}
              {t === "flagged" && stats.flagged > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0f1e]">
                  {stats.flagged}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div>
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Icon name="fa-search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10"
              >
                <Icon name="fa-user-plus" size={12} />
                Create User
              </button>
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
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                              u.suspended 
                                ? "bg-rose-950/40 text-rose-400 border border-rose-500/20" 
                                : "bg-indigo-600/30 text-indigo-400"
                            }`}>
                              {u.suspended ? (
                                <Icon name="fa-lock" size={12} />
                              ) : (
                                (u.displayName || u.email)?.[0]?.toUpperCase() ?? "?"
                              )}
                            </div>
                            <div>
                              <div className={`font-semibold text-sm flex items-center gap-2 ${u.suspended ? "text-slate-500 line-through" : "text-white"}`}>
                                {u.displayName || "—"}
                                {u.suspended && (
                                  <span className="bg-rose-900/40 border border-rose-500/30 text-rose-300 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                                    Locked
                                  </span>
                                )}
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
                                value="free_full"
                                className="bg-[#0f172a] text-white"
                              >
                                Free Full
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
                              className="px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold hover:bg-indigo-600/40 transition-colors flex items-center gap-1"
                              title="View user posts"
                            >
                              <Icon name="fa-eye" size={12} />
                              Content
                            </button>
                            <button
                              onClick={() => handleToggleSuspension(u.uid, u.suspended ?? false)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
                                u.suspended
                                  ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/40"
                                  : "bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-600/40"
                              }`}
                              title={u.suspended ? "Reactivate User" : "Suspend User"}
                            >
                              <Icon name={u.suspended ? "fa-unlock" : "fa-ban"} size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.uid)}
                              className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/40 transition-colors flex items-center justify-center"
                              title="Delete User"
                            >
                              <Icon name="fa-trash-alt" size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-16 text-slate-500">
                    <Icon name="fa-search" className="mx-auto mb-3 block" size={30} />
                    No users match your search
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MARKETING TAB ── */}
        {tab === "marketing" && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-white">
                  Marketing Attribution
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Signups by first-touch campaign (from utm tags on your
                  LinkedIn posts and ads). Export raw rows to feed back into
                  Hermes for optimisation.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadReport}
                  disabled={reportLoading}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {reportLoading ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Icon name="fa-sync-alt" size={12} />
                  )}
                  Refresh
                </button>
                <button
                  onClick={() => {
                    if (!report) return;
                    const cols: (keyof AcquisitionRow)[] = [
                      "uid", "email", "displayName", "emailDomain",
                      "isBusinessEmail", "marketingRole", "companySize",
                      "createdAt", "role", "tier", "isPaid",
                      "first_source", "first_medium", "first_campaign",
                      "first_content", "first_term", "first_referrer",
                      "first_landing", "first_capturedAt", "last_source",
                      "last_medium", "last_campaign", "last_content",
                    ];
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadCsv(
                      `dealecho-acquisition-raw-${stamp}.csv`,
                      toCsv(cols, report.rows),
                    );
                  }}
                  disabled={!report || report.rows.length === 0}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Icon name="fa-download" size={12} />
                  Raw CSV
                </button>
                <button
                  onClick={() => {
                    if (!report) return;
                    const cols: (keyof CampaignRollup)[] = [
                      "source", "medium", "campaign", "content",
                      "signups", "paid", "conversionRate",
                    ];
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadCsv(
                      `dealecho-acquisition-campaigns-${stamp}.csv`,
                      toCsv(cols, report.campaigns),
                    );
                  }}
                  disabled={!report || report.campaigns.length === 0}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/10"
                >
                  <Icon name="fa-download" size={12} />
                  Campaign CSV
                </button>
                <button
                  onClick={() => {
                    if (!report) return;
                    const rows = (report.accounts ?? []).map((a) => ({
                      domain: a.domain,
                      signups: a.signups,
                      paid: a.paid,
                      roles: a.roles.join("; "),
                      trackedCompanies: a.trackedCompanies,
                      lastSignupAt: a.lastSignupAt,
                      users: a.users.map((u) => u.email).join("; "),
                    }));
                    const stamp = new Date().toISOString().slice(0, 10);
                    downloadCsv(
                      `dealecho-target-accounts-${stamp}.csv`,
                      toCsv(
                        ["domain", "signups", "paid", "roles",
                         "trackedCompanies", "lastSignupAt", "users"],
                        rows,
                      ),
                    );
                  }}
                  disabled={!report || (report.accounts ?? []).length === 0}
                  className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-black transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Icon name="fa-download" size={12} />
                  Accounts CSV
                </button>
              </div>
            </div>

            {reportLoading && !report ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-indigo-400" size={28} />
              </div>
            ) : !report ? (
              <div className="text-center py-24 text-slate-500 text-sm">
                No report loaded yet.
              </div>
            ) : (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  {[
                    { label: "Total Signups", value: report.totalUsers },
                    { label: "Attributed", value: report.attributedUsers },
                    {
                      label: "Direct / Unknown",
                      value: report.totalUsers - report.attributedUsers,
                    },
                    { label: "Campaigns", value: report.campaigns.length },
                    {
                      label: "Business Email",
                      value: report.businessEmailUsers ?? 0,
                    },
                    {
                      label: "Role Answered",
                      value: report.roleAnsweredUsers ?? 0,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                      <div className="text-3xl font-black text-white">
                        {s.value}
                      </div>
                      <div className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campaign table */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Medium</th>
                          <th className="px-4 py-3">Campaign</th>
                          <th className="px-4 py-3">Content</th>
                          <th className="px-4 py-3 text-right">Signups</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Conv %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.campaigns.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-10 text-center text-slate-500"
                            >
                              No attribution data yet. Once utm-tagged links
                              start driving signups, campaigns appear here.
                            </td>
                          </tr>
                        ) : (
                          report.campaigns.map((c, i) => (
                            <tr
                              key={i}
                              className="border-b border-white/5 last:border-0 text-slate-200"
                            >
                              <td className="px-4 py-3 font-semibold">
                                {c.source}
                              </td>
                              <td className="px-4 py-3 text-slate-400">
                                {c.medium}
                              </td>
                              <td className="px-4 py-3">{c.campaign}</td>
                              <td className="px-4 py-3 text-slate-400">
                                {c.content}
                              </td>
                              <td className="px-4 py-3 text-right font-black">
                                {c.signups}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-emerald-400">
                                {c.paid}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-indigo-400">
                                {Math.round(c.conversionRate * 100)}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role + email-type rollups */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {[
                    {
                      title: "Signups by Role",
                      note: "From the post-signup role prompt.",
                      rows: (report.roles ?? []).map((r) => ({
                        label: r.role,
                        signups: r.signups,
                        paid: r.paid,
                        conversionRate: r.conversionRate,
                      })),
                      empty: "No role answers yet.",
                    },
                    {
                      title: "Business vs Personal Email",
                      note: "Business domains are outbound-ready accounts.",
                      rows: (report.emailTypes ?? []).map((e) => ({
                        label: e.type,
                        signups: e.signups,
                        paid: e.paid,
                        conversionRate: e.conversionRate,
                      })),
                      empty: "No users yet.",
                    },
                  ].map((section) => (
                    <div
                      key={section.title}
                      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                    >
                      <div className="px-4 pt-4">
                        <h3 className="text-sm font-black text-white">
                          {section.title}
                        </h3>
                        <p className="text-slate-500 text-[11px] mt-0.5 mb-2">
                          {section.note}
                        </p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                            <th className="px-4 py-2"> </th>
                            <th className="px-4 py-2 text-right">Signups</th>
                            <th className="px-4 py-2 text-right">Paid</th>
                            <th className="px-4 py-2 text-right">Conv %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-6 text-center text-slate-500"
                              >
                                {section.empty}
                              </td>
                            </tr>
                          ) : (
                            section.rows.map((r) => (
                              <tr
                                key={r.label}
                                className="border-b border-white/5 last:border-0 text-slate-200"
                              >
                                <td className="px-4 py-2.5 font-semibold capitalize">
                                  {r.label}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black">
                                  {r.signups}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-emerald-400">
                                  {r.paid}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-indigo-400">
                                  {Math.round(r.conversionRate * 100)}%
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                {/* Target accounts (business email domains) */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mt-6">
                  <div className="px-4 pt-4">
                    <h3 className="text-sm font-black text-white">
                      Target Accounts
                    </h3>
                    <p className="text-slate-500 text-[11px] mt-0.5 mb-2">
                      Business email domains grouped by signups. Multiple users
                      from one domain = warm outbound account.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                          <th className="px-4 py-2">Domain</th>
                          <th className="px-4 py-2 text-right">Users</th>
                          <th className="px-4 py-2 text-right">Paid</th>
                          <th className="px-4 py-2">Roles</th>
                          <th className="px-4 py-2 text-right">Tracked</th>
                          <th className="px-4 py-2">Last Signup</th>
                          <th className="px-4 py-2">People</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.accounts ?? []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              No business email signups yet.
                            </td>
                          </tr>
                        ) : (
                          (report.accounts ?? []).map((a) => (
                            <tr
                              key={a.domain}
                              className="border-b border-white/5 last:border-0 text-slate-200 align-top"
                            >
                              <td className="px-4 py-2.5 font-black">
                                {a.domain}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black">
                                {a.signups}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-emerald-400">
                                {a.paid}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 capitalize">
                                {a.roles.join(", ") || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-400">
                                {a.trackedCompanies}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                                {a.lastSignupAt
                                  ? new Date(a.lastSignupAt).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400">
                                {a.users
                                  .map((u) => u.displayName || u.email)
                                  .join(", ")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {report.generatedAt && (
                  <p className="text-slate-600 text-[11px] mt-3">
                    Generated {new Date(report.generatedAt).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CONTENT TAB ── */}
        {tab === "content" && (
          <div>
            <div className="mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Icon name="fa-search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
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
                  <span className="text-xs font-bold text-indigo-400 flex items-center">
                    <Icon name="fa-filter" className="mr-2" size={12} />
                    Filtering by User ID: {contentUserFilter.slice(0, 8)}…
                  </span>
                  <button
                    onClick={() => setContentUserFilter(null)}
                    className="text-indigo-400 hover:text-white transition-colors flex items-center"
                  >
                    <Icon name="fa-times-circle" size={14} />
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
                              <Icon name="fa-pen" size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteReview(r.id)}
                              className="w-8 h-8 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/40 transition-colors flex items-center justify-center"
                              title="Delete"
                            >
                              <Icon name="fa-trash" size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredReviews.length === 0 && (
                  <div className="text-center py-16 text-slate-500">
                    <Icon name="fa-search" className="mx-auto mb-3 block" size={30} />
                    {contentUserFilter
                      ? "This user has no posts"
                      : "No reviews match your search"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FLAGGED REVIEWS TAB ── */}
        {tab === "flagged" && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-rose-600/30 rounded-xl flex items-center justify-center">
                  <Icon name="fa-shield-alt" className="text-rose-400 text-sm" size={14} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Flagged Reviews</h2>
                  <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
                    Reviews caught by server-side moderation
                  </p>
                </div>
              </div>
            </div>

            {flaggedLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : flaggedReviews.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
                <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="fa-check-circle" className="text-emerald-400 text-2xl" size={24} />
                </div>
                <h3 className="text-lg font-black text-white mb-2">All Clear</h3>
                <p className="text-slate-500 text-sm">No flagged reviews requiring attention.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedReviews.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white/5 border border-rose-500/20 rounded-3xl p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-bold text-sm">
                            {r.companyName ?? "Unknown Company"}
                          </span>
                          <span className="bg-rose-900/40 text-rose-400 text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest">
                            Flagged
                          </span>
                          {r.status && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              r.status === "Won" ? "bg-emerald-900/40 text-emerald-400" :
                              r.status === "Lost" ? "bg-rose-900/40 text-rose-400" :
                              "bg-amber-900/40 text-amber-400"
                            }`}>{r.status}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
                          <span className="flex items-center">
                            <Icon name="fa-user" className="mr-1" size={10} />
                            {r.userId?.slice(0, 8)}…
                          </span>
                          <span className="flex items-center">
                            <Icon name="fa-calendar" className="mr-1" size={10} />
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                          </span>
                          {r.moderatedAt && (
                            <span className="flex items-center">
                              <Icon name="fa-clock" className="mr-1" size={10} />
                              Moderated: {new Date(r.moderatedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApproveReview(r.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-600/40 transition-colors flex items-center gap-1.5"
                          title="Approve and publish this review"
                        >
                          <Icon name="fa-check" size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-600/40 transition-colors flex items-center gap-1.5"
                          title="Delete this review permanently"
                        >
                          <Icon name="fa-trash" size={12} />
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Flagged reason */}
                    <div className="bg-rose-950/30 border border-rose-500/10 rounded-2xl p-4">
                      <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center">
                        <Icon name="fa-exclamation-triangle" className="mr-1.5" size={12} />
                        Moderation Reason
                      </div>
                      <p className="text-rose-300/80 text-sm font-medium">
                        {r.moderationReason || "No reason provided"}
                      </p>
                      {r.flaggedSegments && r.flaggedSegments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {r.flaggedSegments.map((seg, i) => (
                            <span
                              key={i}
                              className="bg-rose-900/40 text-rose-300 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-500/20"
                            >
                              {seg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review content */}
                    <div className="bg-white/5 rounded-2xl p-4">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Review Content
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {r.content || "No content"}
                      </p>
                    </div>
                  </div>
                ))}
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
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center">
                      <Icon name="fa-info-circle" className="text-indigo-400 mr-2" size={14} />
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
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center">
                    <Icon name="fa-edit" className="text-indigo-400 mr-2" size={14} />
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
                          <Loader2 className="animate-spin mr-2 inline-block" size={14} /> Creating
                          Stripe Prices...
                        </>
                      ) : (
                        <>
                          <Icon name="fa-save" className="mr-2 inline-block" size={14} /> Update Prices
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-500 leading-relaxed flex items-start">
                      <Icon name="fa-info-circle" className="mr-1 mt-0.5" size={10} />
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

        {/* ── NEWSLETTER TAB ── */}
        {tab === "newsletter" && (
          <div>
            {/* Newsletter Sub-navigation */}
            <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 w-fit mb-6">
              <button
                onClick={() => setNewsletterSubTab("compose")}
                className={`px-5 py-2 rounded-xl text-xs font-black capitalize transition-all flex items-center gap-1.5 ${
                  newsletterSubTab === "compose"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon name="fa-edit" size={12} />
                Compose Campaign
              </button>
              <button
                onClick={() => {
                  setNewsletterSubTab("history");
                  loadCampaigns();
                }}
                className={`px-5 py-2 rounded-xl text-xs font-black capitalize transition-all flex items-center gap-1.5 ${
                  newsletterSubTab === "history"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon name="fa-history" size={12} />
                Sent Campaigns
              </button>
            </div>

            {newsletterSubTab === "compose" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in text-white">
            {/* Left side: Composer Form */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5 relative">
              <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-indigo-500/5 blur-[60px] rounded-full pointer-events-none"></div>
              
              <div>
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2">
                  <Icon name="fa-edit" className="text-indigo-400" size={14} />
                  Newsletter Composer
                </h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                  Compose updates, monthly metrics, or feature announcements to broadcast to active subscribed members.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={newsletterSubject}
                    onChange={(e) => setNewsletterSubject(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="e.g. Dealecho Monthly Intel: Insights & New Vetted Reports"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Preheader Text (Email Preview Snippet)
                  </label>
                  <input
                    type="text"
                    value={newsletterPreheader}
                    onChange={(e) => setNewsletterPreheader(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="e.g. Discover this month's top enterprise buying patterns and deal reviews."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Newsletter Title (Header/Headline)
                  </label>
                  <input
                    type="text"
                    value={newsletterTitle}
                    onChange={(e) => setNewsletterTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="e.g. May Intel Report: What's Shifting?"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Newsletter Body Content (Double newlines segment paragraphs)
                  </label>
                  <textarea
                    value={newsletterContent}
                    onChange={(e) => setNewsletterContent(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                    placeholder={`Write your newsletter content here...\n\nUse double newlines to separate paragraphs cleanly.\n\nE.g. We have added 50+ new vetted deal reviews this month!`}
                  />
                </div>
              </div>

              {/* Test send widget */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
                  🧪 Test Delivery System
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newsletterTestEmail}
                    onChange={(e) => setNewsletterTestEmail(e.target.value)}
                    placeholder="E.g. admin@dealecho.io"
                    className="flex-grow px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors text-white"
                  />
                  <button
                    onClick={() => handleSendNewsletter(true)}
                    disabled={newsletterSending}
                    className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-black rounded-xl hover:bg-indigo-600/40 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Send Test
                  </button>
                </div>
              </div>

              {/* Broadcast Send button */}
              <button
                onClick={() => handleSendNewsletter(false)}
                disabled={newsletterSending || !newsletterSubject || !newsletterTitle || !newsletterContent}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
              >
                {newsletterSending ? (
                  <>
                    <Loader2 className="animate-spin mr-1 inline-block" size={14} /> Broadcasting Newsletter...
                  </>
                ) : (
                  <>
                    <Icon name="fa-paper-plane" className="mr-1 inline-block" size={14} />
                    Broadcast to All Subscribed Users
                  </>
                )}
              </button>
            </div>

            {/* Right side: Real-time Live Preview */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 sticky top-24">
              <div>
                <h3 className="text-base font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2">
                  <Icon name="fa-eye" className="text-sky-400" size={14} />
                  Live Client Preview
                </h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                  Real-time preview of how the newsletter will render in your subscribers' email clients.
                </p>
              </div>

              {/* Mockup email inbox preview bar */}
              <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-xs font-semibold text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider mr-2">Subject:</span>
                  <span className="text-white">{newsletterSubject || "(No subject set)"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider mr-2">Snippet:</span>
                  <span>{newsletterPreheader || "(No snippet set)"}</span>
                </div>
              </div>

              {/* Mockup Client Viewport */}
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-white text-slate-900 shadow-xl max-h-[500px] overflow-y-auto scrollbar-thin">
                {/* Email Header */}
                <div className="bg-[#101426] py-6 px-8 text-center">
                  <h1 className="text-white text-lg font-black tracking-widest uppercase m-0">
                    DEAL<span className="text-indigo-400">ECHO</span>
                  </h1>
                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-1 block">
                    Sales Intelligence Hub
                  </span>
                </div>

                {/* Email Body */}
                <div className="p-8 space-y-4">
                  <h2 className="text-[#0f172a] text-xl font-black tracking-tight leading-tight mb-4 border-b pb-2 border-slate-100">
                    {newsletterTitle || "Headline Title"}
                  </h2>

                  {newsletterContent ? (
                    newsletterContent.split(/\n\s*\n/).filter(Boolean).map((p, idx) => (
                      <p key={idx} className="text-slate-600 text-sm leading-relaxed whitespace-pre-line text-left">
                        {p}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-400 text-sm italic text-left">
                      Start writing your content on the left to see paragraphs render dynamically here...
                    </p>
                  )}

                  {/* CTA Button */}
                  <div className="text-center pt-4">
                    <span className="inline-block px-8 py-3 bg-[#4f46e5] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-default">
                      Explore Intel Dashboard
                    </span>
                  </div>

                  {/* Signoff */}
                  <div className="text-slate-600 text-sm pt-4 text-left">
                    Good selling,<br />
                    <strong className="text-slate-900">The Dealecho Team</strong>
                  </div>
                </div>

                {/* Email Footer */}
                <div className="bg-slate-50 border-t border-slate-100 py-6 px-8 text-center text-[10px] text-slate-400 space-y-2">
                  <div className="font-bold text-slate-500">
                    &copy; {new Date().getFullYear()} Dealecho.io. All rights reserved.
                  </div>
                  <div>
                    You received this email because you are a registered member of Dealecho.io.
                  </div>
                  <div className="text-indigo-600 font-bold">
                    Dashboard • Pricing • Unsubscribe / Preferences
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Sent Campaigns History Subtab */
          <div>
            {newslettersLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : newsletters.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center text-white">
                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon name="fa-paper-plane" className="text-indigo-400 text-2xl" size={24} />
                </div>
                <h3 className="text-lg font-black text-white mb-2">No Campaigns Yet</h3>
                <p className="text-slate-500 text-sm">You haven't broadcasted any newsletters to active users yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-white/10 text-white animate-fade-in">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      {["Date Sent", "Subject Line", "Headline", "Recipients", "Opens", "Open Rate", "Actions"].map((h) => (
                        <th key={h} className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {newsletters.map((n, i) => {
                      const openRate = n.sentCount > 0 ? Math.round((n.opens / n.sentCount) * 100) : 0;
                      return (
                        <tr key={n.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                          <td className="px-5 py-4 text-slate-400 text-xs">
                            {n.sentAt ? new Date(n.sentAt).toLocaleString() : "—"}
                          </td>
                          <td className="px-5 py-4 text-white text-sm font-semibold max-w-xs truncate">
                            {n.subject}
                          </td>
                          <td className="px-5 py-4 text-slate-400 text-xs truncate max-w-xs">
                            {n.title}
                          </td>
                          <td className="px-5 py-4 text-white text-xs font-bold">
                            {n.sentCount}
                          </td>
                          <td className="px-5 py-4 text-emerald-400 text-xs font-bold">
                            {n.opens}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                              openRate >= 50 ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" :
                              openRate >= 20 ? "bg-indigo-950/40 text-indigo-400 border border-indigo-500/20" :
                              "bg-slate-900 text-slate-400 border border-slate-700/30"
                            }`}>
                              {openRate}%
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => setSelectedHistoryNewsletter(n)}
                              className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-black rounded-xl hover:bg-indigo-600/40 transition-colors flex items-center gap-1"
                            >
                              <Icon name="fa-eye" size={12} />
                              Inspect Copy
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                  <Loader2 className="animate-spin mx-auto" size={14} />
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

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-indigo-500/10 blur-[80px] rounded-full -mr-10 -mt-10 pointer-events-none"></div>
            
            {isCreateSuccess ? (
              <div className="text-center py-6 relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 animate-pulse">
                  <Icon name="fa-check" size={24} />
                </div>
                <h3 className="text-xl font-black mb-2 text-white">Invitation Dispatched!</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-sm text-center">
                  An account has been successfully provisioned. A branded welcome activation email containing a secure password setup link was sent via Resend.
                </p>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-black mb-1 relative z-10">Create New User Manually</h3>
                <p className="text-slate-500 text-xs font-semibold leading-relaxed mb-6 relative z-10 max-w-sm">
                  Enter user details to manually provision their account. They will automatically receive a secure activation link via email to select their password.
                </p>

                <form onSubmit={handleCreateUser} className="space-y-4 relative z-10">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={createDisplayName}
                      onChange={(e) => setCreateDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. john@company.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Membership Type
                    </label>
                    <select
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value as UserRole)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="free" className="bg-[#0f172a] text-white">
                        Free (Pioneer Plan)
                      </option>
                      <option value="paid" className="bg-[#0f172a] text-white">
                        Paid (Sales Pro Plan)
                      </option>
                      <option value="free_full" className="bg-[#0f172a] text-white">
                        Free Full (Complimentary Full Access)
                      </option>
                      <option value="admin" className="bg-[#0f172a] text-white">
                        Administrator
                      </option>
                      <option value="enterprise" className="bg-[#0f172a] text-white">
                        Enterprise (Team Manager)
                      </option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={isCreatingUser}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {isCreatingUser ? (
                        <>
                          <Loader2 className="animate-spin mr-1 inline-block" size={14} />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <Icon name="fa-paper-plane" size={14} />
                          Create & Send Invite
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeCreateModal}
                      className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-400 font-black text-sm rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Campaign Inspector Modal */}
      {selectedHistoryNewsletter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-fade-in text-white">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                <h3 className="text-xl font-black mb-1">Campaign Details</h3>
                <p className="text-slate-500 text-xs font-semibold">
                  Sent on {new Date(selectedHistoryNewsletter.sentAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryNewsletter(null)}
                className="text-slate-400 hover:text-white transition-colors flex items-center"
              >
                <Icon name="fa-times-circle" size={20} />
              </button>
            </div>

            {/* Campaign Metrics row */}
            <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Recipients
                </div>
                <div className="text-xl font-black text-white">
                  {selectedHistoryNewsletter.sentCount}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Unique Opens
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {selectedHistoryNewsletter.opens}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Open Rate
                </div>
                <div className="text-xl font-black text-indigo-400">
                  {selectedHistoryNewsletter.sentCount > 0
                    ? Math.round((selectedHistoryNewsletter.opens / selectedHistoryNewsletter.sentCount) * 100)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Campaign Metadata */}
            <div className="space-y-3 mb-6 relative z-10 text-sm">
              <div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/5">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider mr-2">Subject:</span>
                  <span className="text-white font-semibold">{selectedHistoryNewsletter.subject}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider mr-2">Snippet:</span>
                  <span className="text-slate-300">{selectedHistoryNewsletter.preheaderText}</span>
                </div>
              </div>
            </div>

            {/* Campaign Copy Preview */}
            <div className="bg-white rounded-2xl p-6 text-slate-900 max-h-[300px] overflow-y-auto scrollbar-thin relative z-10 shadow-inner">
              <h2 className="text-[#0f172a] text-lg font-black tracking-tight mb-4 border-b pb-2 border-slate-100">
                {selectedHistoryNewsletter.title}
              </h2>
              {selectedHistoryNewsletter.content ? (
                selectedHistoryNewsletter.content.split(/\n\s*\n/).filter(Boolean).map((p: string, idx: number) => (
                  <p key={idx} className="text-slate-600 text-sm leading-relaxed whitespace-pre-line text-left mb-3">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-slate-400 text-sm italic">No content copy found.</p>
              )}
            </div>

            <div className="mt-6 flex justify-end relative z-10">
              <button
                onClick={() => setSelectedHistoryNewsletter(null)}
                className="px-6 py-3 bg-white/5 border border-white/10 text-slate-400 font-black text-xs rounded-2xl hover:bg-white/10 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
