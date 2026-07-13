import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../src/firebase/config";

export default function AuthBridge() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Token arrives in the URL fragment (never sent to the server). Fall back to
  // query params for any older extension builds still using ?ct=. Parse once in
  // the state initializer: the effect below scrubs the URL, and StrictMode
  // re-runs effects, so a second parse would see an empty URL.
  const [{ ct, redirect }] = useState(() => {
    const params = new URLSearchParams(
      window.location.hash ? window.location.hash.slice(1) : window.location.search
    );
    return { ct: params.get("ct"), redirect: params.get("redirect") || "/" };
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Scrub the token from the address bar and history before the async sign-in.
    window.history.replaceState(null, "", window.location.pathname);

    if (!ct) {
      navigate(redirect, { replace: true });
      return;
    }

    signInWithCustomToken(auth, ct)
      .then(() => navigate(redirect, { replace: true }))
      .catch((err) => {
        console.error("[Dealecho] Auth bridge sign-in failed:", err);
        setError("Sign-in failed. Please sign in manually.");
      });
  }, [ct, redirect, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/" className="text-accent-soft hover:underline text-sm">Go to home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-semibold tracking-wide">Signing you in…</p>
      </div>
    </div>
  );
}
