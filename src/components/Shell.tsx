/**
 * Direction B shell — Navigation + Footer.
 * Imported by App.tsx (see APP-TSX-EDITS.md). Same props as the old inline
 * components, so no call sites change.
 */

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "./Icon";

// ── Navigation (68px header, fixed nav semantics, mobile menu with auth) ──
export const Navigation: React.FC<{
  user: any;
  isAdmin: boolean;
  isPaid: boolean;
  isEnterprise?: boolean;
  onSignInClick: () => void;
  onSignUpClick: () => void;
  onLogout: () => void;
  notificationCount: number;
}> = ({ user, isAdmin, isPaid, isEnterprise, onSignInClick, onSignUpClick, onLogout, notificationCount }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: "Write Review", path: "/review/new", icon: "fa-pen-nib" },
    { name: "Control Centre", path: "/control-centre", icon: "fa-user-circle" },
  ];
  if (isEnterprise) {
    navLinks.push({ name: "Team", path: "/settings/team", icon: "fa-users" });
  }
  if (isAdmin) {
    navLinks.push({ name: "Admin", path: "/admin", icon: "fa-shield-alt" });
  }

  const isActive = (path: string) =>
    path === "/search"
      ? location.pathname.startsWith("/search")
      : location.pathname === path;

  return (
    <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-[1000]">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[68px]">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center">
            <img src="/logo-lockup.svg" alt="dealecho" className="h-[46px] w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            {(user
              ? navLinks
              : [
                  { name: "Search", path: "/", icon: "fa-search" },
                  { name: "Pricing", path: "/pricing", icon: "fa-tags" },
                ]
            ).map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`relative text-sm font-medium transition-colors ${
                  isActive(link.path) ? "text-accent" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {link.name}
                {link.path === "/control-centre" && notificationCount > 0 && (
                  <span className="absolute -top-2 -right-3.5 bg-signal-risk text-white text-2xs font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                    {notificationCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block leading-tight">
                <div className="text-xs font-bold text-slate-900">{user.name}</div>
                {isPaid ? (
                  <span className="text-2xs font-semibold text-accent uppercase tracking-wider">
                    {isAdmin ? "System admin" : "Pro member"}
                  </span>
                ) : (
                  <Link
                    to="/pricing"
                    className="text-2xs font-semibold text-slate-400 uppercase tracking-wider hover:text-accent"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
              <img
                src={user.avatar}
                className="w-9 h-9 rounded-control border-2 border-slate-100"
                alt="avatar"
              />
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-signal-risk transition-colors"
                aria-label="Sign out"
              >
                <Icon name="fa-sign-out-alt" size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={onSignInClick} className="text-sm font-medium text-slate-500 hover:text-slate-900 hidden sm:block">
                Sign in
              </button>
              <button onClick={onSignUpClick} className="de-btn-accent text-sm hidden sm:block">
                Sign up
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-control bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          >
            <Icon name={isMenuOpen ? "fa-times" : "fa-bars"} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile menu — now includes the auth action */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl p-4 space-y-1.5 z-[999]">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center gap-3 p-3.5 rounded-control transition-all ${
                isActive(link.path)
                  ? "bg-accent-50 text-accent"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon name={link.icon} size={18} />
              <span className="font-semibold text-sm">{link.name}</span>
            </Link>
          ))}

          <div className="pt-2">
            {user ? (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-control bg-slate-50 text-slate-600 hover:bg-slate-100 font-semibold text-sm"
              >
                <Icon name="fa-sign-out-alt" size={18} /> Sign out
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsMenuOpen(false); onSignInClick(); }}
                  className="flex-1 de-btn-secondary text-sm py-3.5"
                >
                  Sign in
                </button>
                <button
                  onClick={() => { setIsMenuOpen(false); onSignUpClick(); }}
                  className="flex-1 de-btn-accent text-sm py-3.5"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

// ── Footer (real links, trust column, correct year) ──
export const Footer: React.FC = () => (
  <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
        <div className="col-span-2 md:col-span-1">
          <div className="mb-3">
            <img src="/logo-lockup.svg" alt="dealecho" className="h-7 w-auto" />
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            B2B buyer intelligence from real enterprise sales cycles.
          </p>
        </div>

        <div>
          <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Product
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/search" className="text-slate-600 hover:text-accent">Search accounts</Link></li>
            <li><Link to="/trends" className="text-slate-600 hover:text-accent">Analytics</Link></li>
            <li><Link to="/pricing" className="text-slate-600 hover:text-accent">Pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Contribute
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/review/new" className="text-slate-600 hover:text-accent">Write a review</Link></li>
            <li><Link to="/control-centre" className="text-slate-600 hover:text-accent">Control Centre</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Trust &amp; legal
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/privacy" className="text-slate-600 hover:text-accent">Privacy policy</Link></li>
            <li><Link to="/terms" className="text-slate-600 hover:text-accent">Terms of use</Link></li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-6 border-t border-slate-100 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} dealecho.io. All rights reserved.</span>
        <span className="flex items-center gap-2">
          <Icon name="fa-shield-alt" size={13} className="text-slate-400" />
          Reviews are moderated &amp; anonymised
        </span>
      </div>
    </div>
  </footer>
);
