import React, { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  getAdditionalUserInfo,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, googleProvider } from "./src/firebase/config";
import { track } from "./src/utils/analytics";
import { captureAttribution, getAttribution, hasAttribution } from "./src/utils/attribution";
import { getLocale } from "./src/utils/locale";

const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const CreateReview = lazy(() => import("./pages/CreateReview"));
const CompanyProfile = lazy(() => import("./pages/CompanyProfile"));
const UserReviews = lazy(() => import("./pages/UserReviews"));
const GlobalTrends = lazy(() => import("./pages/GlobalTrends"));
const MyIntel = lazy(() => import("./pages/MyIntel"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Admin = lazy(() => import("./pages/Admin"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const TeamSettings = lazy(() => import('./pages/TeamSettings'));
const AuthBridge = lazy(() => import('./pages/AuthBridge'));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
  </div>
);
import AuthModal from "./components/AuthModal";
import {
  MarketingProfileModal,
  MarketingProfileBanner,
} from "./src/components/MarketingProfilePrompt";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthRedirectBridge from "./src/components/AuthRedirectBridge";
import { Navigation, Footer } from "./src/components/Shell";

import { useAuth } from "./src/hooks/useAuth";
import { useReviews } from "./src/hooks/useReviews";
import { useTracking } from "./src/hooks/useTracking";
import { useReviewSummaries } from "./src/hooks/useReviewSummaries";

// Helper component to scroll to top on every navigation
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    track("page_view", { page_path: pathname, page_location: window.location.href });
  }, [pathname]);
  return null;
};

// MappedUser is now provided directly by useAuth hook

const App: React.FC = () => {
  const { user, isAdmin, isPaid, isEnterprise } = useAuth();
  const {
    reviews,
    isLoading: reviewsLoading,
    addReview: handleAddReview,
  } = useReviews();
  const {
    summaries: reviewSummaries,
    isLoading: summariesLoading,
    isError: summariesError,
  } = useReviewSummaries();
  const { trackedCompanies, toggleTrack: toggleTrackCompany } = useTracking(
    user?.id,
    isPaid,
  );

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<"signin" | "signup">("signin");
  const [postAuthPath, setPostAuthPath] = useState<string | null>(null);

  // Post-signup role prompt: modal right after signup, banner re-ask from the
  // ~3rd session when the modal was skipped.
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [bannerHidden, setBannerHidden] = useState(false);

  const [notifications, setNotifications] = useState<Record<string, number>>(
    {},
  );

  // Sync notifications to user-specific storage
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`dealecho_notifications_${user.id}`);
      setNotifications(saved ? JSON.parse(saved) : {});
    } else {
      setNotifications({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(
        `dealecho_notifications_${user.id}`,
        JSON.stringify(notifications),
      );
    }
  }, [notifications, user?.id]);


  // Capture marketing attribution (utm_* + referrer) once on app boot, before
  // any signup can happen. Persists to a first-party cookie.
  useEffect(() => {
    captureAttribution();
  }, []);

  // Count signed-in sessions (one per app load) to pace the role re-ask banner.
  useEffect(() => {
    if (!user?.id) return;
    const key = `dealecho_sessions_${user.id}`;
    const n = (parseInt(localStorage.getItem(key) ?? "0", 10) || 0) + 1;
    localStorage.setItem(key, String(n));
    setSessionCount(n);
  }, [user?.id]);

  const mp = user?.marketingProfile;
  const showRoleBanner =
    !!user &&
    !bannerHidden &&
    !showProfileModal &&
    !isAuthModalOpen &&
    sessionCount >= 3 &&
    mp !== undefined &&
    !mp.role &&
    !mp.promptDismissed;

  // After a NEW user signs up, send their captured attribution to the server,
  // which writes it to the user doc. No-op when there's nothing to record.
  const recordAcquisition = async () => {
    const attribution = getAttribution();
    const locale = getLocale();
    // Fire when there's attribution OR a locale signal to persist. Locale is
    // always available, so this now runs for every new signup.
    if (!hasAttribution(attribution) && !locale) return;
    try {
      const fn = httpsCallable(
        getFunctions(undefined, "australia-southeast1"),
        "recordAcquisition",
      );
      await fn({ ...attribution, ...(locale ? { locale } : {}) });
    } catch {
      /* attribution must never block the signup flow */
    }
  };

  const triggerSignIn = () => { setAuthInitialMode("signin"); setIsAuthModalOpen(true); };
  const triggerSignUp = () => { setAuthInitialMode("signup"); setIsAuthModalOpen(true); };

  // Helper handlers that use standalone Firebase Auth functions
  const onGoogleLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const isNew = getAdditionalUserInfo(res)?.isNewUser;
      if (isNew) {
        setPostAuthPath("/search");
        void recordAcquisition();
        setShowProfileModal(true);
      }
      track(isNew ? "sign_up" : "login", { method: "google" });
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user")
        console.error("Login error:", err);
    }
    setIsAuthModalOpen(false);
  };

  const onEmailLogin = async (
    email: string,
    pass: string,
    isNew: boolean,
    name?: string,
  ) => {
    if (isNew) {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(res.user, { displayName: name });
      setPostAuthPath("/search");
      void recordAcquisition();
      setShowProfileModal(true);
      track("sign_up", { method: "password" });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
      track("login", { method: "password" });
    }
    setIsAuthModalOpen(false);
  };

  const onLogout = async () => {
    await signOut(auth);
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthRedirectBridge
        onOpenSignIn={triggerSignIn}
        postAuthPath={postAuthPath}
        onConsumePostAuth={() => setPostAuthPath(null)}
      />
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Navigation
          user={user}
          isAdmin={isAdmin}
          isPaid={isPaid}
          isEnterprise={isEnterprise}
          onSignInClick={triggerSignIn}
          onSignUpClick={triggerSignUp}
          onLogout={onLogout}
          notificationCount={Object.values(notifications).reduce(
            (a: number, b: number) => a + b,
            0,
          )}
        />

        {showRoleBanner && (
          <MarketingProfileBanner
            onAnswered={() => setBannerHidden(true)}
            onDismissed={() => setBannerHidden(true)}
          />
        )}

        <main className="flex-grow">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    user={user}
                    isPaid={isPaid}
                    onSignInClick={triggerSignIn}
                    reviewSummaries={reviewSummaries}
                    isLoading={summariesLoading}
                    isError={summariesError}
                    trackedIds={trackedCompanies}
                    onToggleTrack={toggleTrackCompany}
                  />
                }
              />
              <Route
                path="/search"
                element={
                  <Search
                    user={user}
                    isPaid={isPaid}
                    onSignInClick={triggerSignIn}
                    reviewSummaries={reviewSummaries}
                    isLoading={summariesLoading}
                    trackedIds={trackedCompanies}
                    onToggleTrack={toggleTrackCompany}
                  />
                }
              />
              <Route
                path="/review/new"
                element={
                  <ProtectedRoute requireAuth>
                    <CreateReview
                      user={user}
                      onSignInClick={triggerSignIn}
                      onAddReview={handleAddReview}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user/:userId"
                element={<UserReviews reviews={reviews} />}
              />
              <Route
                path="/trends"
                element={
                  <ProtectedRoute requireAuth>
                    <GlobalTrends
                      user={user}
                      isPaid={isPaid}
                      onSignInClick={triggerSignIn}
                      reviews={reviews}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pricing"
                element={<Pricing user={user} isPaid={isPaid} onSignUpClick={triggerSignUp} />}
              />
              <Route path="/auth-bridge" element={<AuthBridge />} />
              <Route
                path="/unsubscribe"
                element={<Unsubscribe />}
              />
              <Route
                path="/terms"
                element={<Terms />}
              />
              <Route
                path="/privacy"
                element={<Privacy />}
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/control-centre"
                element={
                  <ProtectedRoute requireAuth>
                    <MyIntel
                      user={user}
                      isPaid={isPaid}
                      onSignInClick={triggerSignIn}
                      reviews={reviews}
                      trackedIds={trackedCompanies}
                      onToggleTrack={toggleTrackCompany}
                      notifications={notifications}
                      onClearNotification={(id) =>
                        setNotifications((prev) => {
                          const n = { ...prev };
                          delete n[id];
                          return n;
                        })
                      }
                    />
                  </ProtectedRoute>
                }
              />
              <Route path="/invite/accept" element={<AcceptInvite />} />
              <Route
                path="/settings/team"
                element={
                  <ProtectedRoute requireAuth>
                    <TeamSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/company/:companyId"
                element={
                  <CompanyProfile
                    user={user}
                    isPaid={isPaid}
                    onSignInClick={triggerSignIn}
                    reviews={reviews}
                    onToggleTrack={toggleTrackCompany}
                    allTrackedIds={trackedCompanies}
                  />
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onGoogleLogin={onGoogleLogin}
          onEmailLogin={onEmailLogin}
          initialMode={authInitialMode}
        />
        <MarketingProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
        <Footer />
      </div>
    </BrowserRouter>
  );
};



export default App;
