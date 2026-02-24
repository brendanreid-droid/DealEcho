
import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, password: string, isNewUser: boolean, name?: string) => Promise<void>;
}

type AuthMode = 'signin' | 'signup';

// ── FieldInput: defined at module level to prevent focus-stealing remounts ────
// IMPORTANT: This must NOT be defined inside AuthModal, otherwise React treats
// it as a new component type on every render and unmounts/remounts the <input>,
// which steals focus after every keystroke.
interface FieldInputProps {
  id: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoComplete?: string;
  error?: string;
}

const FieldInput: React.FC<FieldInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
}) => (
  <div>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoComplete={autoComplete}
      className={`w-full px-4 py-3.5 rounded-2xl border-2 bg-slate-50 text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none transition-colors ${
        error
          ? 'border-rose-400 focus:border-rose-400'
          : 'border-slate-100 focus:border-indigo-400'
      }`}
    />
    {error && (
      <p className="text-rose-500 text-[11px] font-semibold mt-1 px-1">
        <i className="fas fa-exclamation-circle mr-1"></i>{error}
      </p>
    )}
  </div>
);

// Maps Firebase error codes to human-readable messages
const getAuthErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is linked to a different sign-in method.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

/** Basic client-side validators */
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const isValidPassword = (password: string, isSignup: boolean) =>
  isSignup ? password.length >= 6 : password.length > 0;

const isValidName = (name: string) => name.trim().length >= 2;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleLogin,
  onEmailLogin,
}) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Per-field validation errors (shown on blur / submit)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Firebase-level error (shown after submit)
  const [firebaseError, setFirebaseError] = useState('');
  // If firebase says email-already-in-use, offer quick switch to sign in
  const [showSwitchHint, setShowSwitchHint] = useState(false);

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setFieldErrors({});
    setFirebaseError('');
    setShowSwitchHint(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  // ── Per-field live/blur validation ──────────────────────────────────────
  const validateField = (field: keyof FieldErrors, value: string) => {
    let msg = '';
    if (field === 'name') {
      if (mode === 'signup' && !isValidName(value))
        msg = 'Name must be at least 2 characters.';
    } else if (field === 'email') {
      if (!value.trim()) msg = 'Email is required.';
      else if (!isValidEmail(value)) msg = 'Enter a valid email address.';
    } else if (field === 'password') {
      if (!value) msg = 'Password is required.';
      else if (mode === 'signup' && value.length < 6)
        msg = 'Password must be at least 6 characters.';
    }
    setFieldErrors((prev) => ({ ...prev, [field]: msg }));
    return msg;
  };

  const validateAll = (): boolean => {
    const nameErr = mode === 'signup' ? validateField('name', name) : '';
    const emailErr = validateField('email', email);
    const passErr = validateField('password', password);
    return !nameErr && !emailErr && !passErr;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirebaseError('');
    setShowSwitchHint(false);
    if (!validateAll()) return;

    setIsEmailLoading(true);
    try {
      await onEmailLogin(email, password, mode === 'signup', name.trim() || undefined);
      resetForm();
    } catch (err: any) {
      const code: string = err?.code ?? '';
      setFirebaseError(getAuthErrorMessage(code));
      if (code === 'auth/email-already-in-use') setShowSwitchHint(true);
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setFirebaseError('');
    setIsGoogleLoading(true);
    try {
      await onGoogleLogin();
    } catch (err: any) {
      setFirebaseError(getAuthErrorMessage(err?.code ?? ''));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative z-10 overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-[#0f172a] px-10 pt-10 pb-6 text-white relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/20 blur-[80px] rounded-full -mr-10 -mt-10"></div>
          <h2 className="text-3xl font-black tracking-tight mb-4 relative z-10">
            {mode === 'signin' ? 'Welcome Back' : 'Get Started'}
          </h2>
          {/* Tab toggle */}
          <div className="relative z-10 flex bg-white/10 rounded-2xl p-1 w-fit">
            <button
              onClick={() => switchMode('signin')}
              className={`px-5 py-2 rounded-xl text-[13px] font-black transition-all ${
                mode === 'signin'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`px-5 py-2 rounded-xl text-[13px] font-black transition-all ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-10 space-y-5">
          <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>

            {/* Name — only on Sign Up */}
            {mode === 'signup' && (
              <FieldInput
                id="name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(v) => {
                  setName(v);
                  if (fieldErrors.name) validateField('name', v);
                }}
                onBlur={() => validateField('name', name)}
                autoComplete="name"
                error={fieldErrors.name}
              />
            )}

            <FieldInput
              id="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(v) => {
                setEmail(v);
                if (fieldErrors.email) validateField('email', v);
                // Clear "already exists" hint when they start editing email
                setShowSwitchHint(false);
                setFirebaseError('');
              }}
              onBlur={() => validateField('email', email)}
              autoComplete="email"
              error={fieldErrors.email}
            />

            <FieldInput
              id="password"
              type="password"
              placeholder={mode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (fieldErrors.password) validateField('password', v);
              }}
              onBlur={() => validateField('password', password)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              error={fieldErrors.password}
            />

            {/* Firebase-level error + switch hint */}
            {firebaseError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
                <p className="text-rose-600 text-[12px] font-semibold leading-snug">
                  <i className="fas fa-exclamation-circle mr-1.5"></i>
                  {firebaseError}
                </p>
                {showSwitchHint && (
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="mt-1.5 text-indigo-600 text-[12px] font-black underline underline-offset-2"
                  >
                    Sign in instead →
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isEmailLoading}
              className="w-full flex items-center justify-center py-3.5 bg-[#4f46e5] text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-100"
            >
              {isEmailLoading ? (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em] text-slate-300">
              <span className="bg-white px-4">or continue with</span>
            </div>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogleClick}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-between p-4 bg-white border-2 border-slate-100 text-slate-700 rounded-[20px] font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center">
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-5 h-5 mr-4"
                alt="google"
              />
              <span>Continue with Google</span>
            </div>
            {isGoogleLoading ? (
              <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <i className="fas fa-arrow-right opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0"></i>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-indigo-600">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-indigo-600">Privacy Policy</a>.
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors z-20"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
