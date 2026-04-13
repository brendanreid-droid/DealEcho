import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getIdTokenResult,
  User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider, db } from "./src/firebase/config";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { Company, Review } from "./types";
import Home from "./pages/Home";
import Search from "./pages/Search";
import CreateReview from "./pages/CreateReview";
import CompanyProfile from "./pages/CompanyProfile";
import UserReviews from "./pages/UserReviews";
import GlobalTrends from "./pages/GlobalTrends";
import MyIntel from "./pages/MyIntel";
import Pricing from "./pages/Pricing";
import Admin from "./pages/Admin";
import AuthModal from "./components/AuthModal";
import ProtectedRoute from "./components/ProtectedRoute";
import { mockReviews } from "./mockReviews";
import { useAuth } from "./src/hooks/useAuth";
import { useReviews } from "./src/hooks/useReviews";
import { useTracking } from "./src/hooks/useTracking";

// Helper component to scroll to top on every navigation
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// MappedUser is now provided directly by useAuth hook

const App: React.FC = () => {
  const { user, isAdmin, isPaid } = useAuth();
  const {
    reviews,
    isLoading: reviewsLoading,
    addReview: handleAddReview,
  } = useReviews();
  const { trackedCompanies, toggleTrack: toggleTrackCompany } = useTracking(
    user?.id,
    isPaid,
  );

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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

  const triggerSignIn = () => setIsAuthModalOpen(true);

  // Helper handlers that use standalone Firebase Auth functions
  const onGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
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
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
    setIsAuthModalOpen(false);
  };

  const onLogout = async () => {
    await signOut(auth);
  };

  return (
    <HashRouter>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Navigation
          user={user}
          isAdmin={isAdmin}
          isPaid={isPaid}
          onSignInClick={triggerSignIn}
          onLogout={onLogout}
          notificationCount={Object.values(notifications).reduce(
            (a: number, b: number) => a + b,
            0,
          )}
        />

        <main className="flex-grow">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  user={user}
                  isPaid={isPaid}
                  onSignInClick={triggerSignIn}
                  reviews={reviews}
                  isLoading={reviewsLoading}
                  trackedIds={trackedCompanies}
                  onToggleTrack={toggleTrackCompany}
                />
              }
            />
            <Route
              path="/search"
              element={<Search reviews={reviews} isLoading={reviewsLoading} />}
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
              element={<Pricing user={user} isPaid={isPaid} />}
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
              path="/my-intel"
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
          </Routes>
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onGoogleLogin={onGoogleLogin}
          onEmailLogin={onEmailLogin}
        />
        <Footer />
      </div>
    </HashRouter>
  );
};

const Navigation: React.FC<{
  user: any;
  isAdmin: boolean;
  isPaid: boolean;
  onSignInClick: () => void;
  onLogout: () => void;
  notificationCount: number;
}> = ({
  user,
  isAdmin,
  isPaid,
  onSignInClick,
  onLogout,
  notificationCount,
}) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: "Search", path: "/", icon: "fas fa-search" },
    { name: "Write Review", path: "/review/new", icon: "fas fa-pen-nib" },
    { name: "My Intel", path: "/my-intel", icon: "fas fa-user-circle" },
    { name: "Analytics", path: "/trends", icon: "fas fa-chart-line" },
    { name: "Pricing", path: "/pricing", icon: "fas fa-tags" },
  ];

  if (isAdmin) {
    navLinks.push({ name: "Admin", path: "/admin", icon: "fas fa-shield-alt" });
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="container mx-auto px-6 flex items-center justify-between h-28">
        <div className="flex items-center space-x-12">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="DealEcho.io" className="h-24 w-auto object-contain" />
          </Link>

          <nav className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center text-[14px] font-bold transition-colors duration-200 relative ${
                  location.pathname === link.path
                    ? "text-[#4f46e5]"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {link.name}
                {link.path === "/my-intel" && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {notificationCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4 lg:space-x-8">
          {user ? (
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-black text-slate-900 leading-none">
                  {user.name}
                </div>
                {isPaid ? (
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                    {isAdmin ? "System Admin" : "Pro Member"}
                  </span>
                ) : (
                  <Link
                    to="/pricing"
                    className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
              <img
                src={user.avatar}
                className="w-9 h-9 rounded-xl border-2 border-slate-100"
                alt="avatar"
              />
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-500 transition-colors"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          ) : (
            <button
              onClick={onSignInClick}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-slate-200"
            >
              Sign In
            </button>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <i
              className={`fas ${isMenuOpen ? "fa-times" : "fa-bars"} text-lg`}
            ></i>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-slate-200 shadow-2xl p-6 space-y-2 z-50">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center p-4 rounded-2xl transition-all ${
                location.pathname === link.path
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <i className={`${link.icon} w-8 text-center mr-2`}></i>
              <span className="font-bold text-sm">{link.name}</span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
};

const Footer: React.FC = () => (
  <footer className="bg-slate-200 border-t border-slate-300 py-12 mt-auto">
    <div className="container mx-auto px-6 text-center text-slate-500 text-sm font-medium">
      <p>&copy; 2024 DealEcho.io. All rights reserved.</p>
    </div>
  </footer>
);

export default App;
