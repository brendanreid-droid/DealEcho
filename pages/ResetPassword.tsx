import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../src/firebase/config";

/**
 * Password reset and account activation, on our own domain.
 *
 * Firebase's hosted handler works, but sending a link to
 * dealecho-io-sales-intel-hub.firebaseapp.com from a dealecho.io address is
 * the shape of a phishing email and gets filtered accordingly. The oobCode is
 * just a one-time code - any page can verify and consume it - so this page
 * does, and the emails link here instead. See functions/src/lib/authLinks.ts.
 *
 * Serves both flows: an invited user setting a password for the first time and
 * an existing user resetting one. Firebase issues the same kind of code for
 * both, so the copy stays neutral rather than guessing which it is.
 */

type State = "checking" | "ready" | "saving" | "done" | "invalid";

const MIN_PASSWORD = 8;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // Parsed once in the initialiser: the effect scrubs the URL, and StrictMode
  // re-runs effects, so a second parse would find nothing. Same reasoning as
  // AuthBridge.
  const [oobCode] = useState(() => new URLSearchParams(window.location.search).get("oobCode"));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // The code is a credential: get it out of the address bar and history
    // before anything async, so it cannot leak via a screenshot or a shared URL.
    window.history.replaceState(null, "", window.location.pathname);

    if (!oobCode) {
      setState("invalid");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((addr) => {
        setEmail(addr);
        setState("ready");
      })
      .catch(() => setState("invalid"));
  }, [oobCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setState("saving");
    try {
      await confirmPasswordReset(auth, oobCode!, password);
      // Sign them straight in. Completing a reset does not create a session, and
      // sending someone who just proved control of their inbox to a login form
      // to retype what they typed twenty seconds ago is a pointless wall.
      try {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/search", { replace: true });
        return;
      } catch {
        // Non-fatal: the password IS set, so show success and let them sign in.
        setState("done");
      }
    } catch (err: any) {
      // A code is single-use and time-limited; spending it twice lands here.
      setState(err?.code === "auth/invalid-action-code" ? "invalid" : "ready");
      setError(
        err?.code === "auth/invalid-action-code"
          ? ""
          : err?.message || "Could not set your password. Try again.",
      );
    }
  };

  if (state === "checking") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">That link has expired</h1>
        <p className="text-slate-500 max-w-md">
          Password links can only be used once, and they expire. Request a new one and we'll email
          it straight over.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition"
        >
          Back to Dealecho
        </button>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">Password set</h1>
        <p className="text-slate-500">You can now sign in with your new password.</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold text-slate-900 text-center">Choose your password</h1>
      <p className="text-slate-500 max-w-md text-center">
        Setting the password for <strong className="text-slate-700">{email}</strong>.
      </p>
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-3 mt-2">
        {/* Hidden username field: without it password managers save the entry
            with no account attached, and cannot offer it on the next sign-in. */}
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <input
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          placeholder={`New password (min ${MIN_PASSWORD} characters)`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={state === "saving"}
          className="px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 disabled:opacity-50 transition"
        >
          {state === "saving" ? "Saving…" : "Set password & continue"}
        </button>
      </form>
    </div>
  );
}
