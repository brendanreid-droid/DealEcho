import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../src/firebase/config";

export default function AuthBridge() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ct = params.get("ct");
    const redirect = params.get("redirect") || "/";

    if (!ct) {
      navigate(redirect, { replace: true });
      return;
    }

    signInWithCustomToken(auth, ct)
      .then(() => navigate(redirect, { replace: true }))
      .catch((err) => {
        console.error("[DealEcho] Auth bridge sign-in failed:", err);
        setError("Sign-in failed. Please sign in manually.");
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/" className="text-indigo-400 hover:underline text-sm">Go to home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-semibold tracking-wide">Signing you in…</p>
      </div>
    </div>
  );
}
