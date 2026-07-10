import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface AuthRedirectBridgeProps {
  /** Called when a route was reached with { openSignIn: true } location state (ProtectedRoute bounce). */
  onOpenSignIn: () => void;
  /** When set (e.g. "/search" after a fresh signup), navigate there once and consume. */
  postAuthPath: string | null;
  onConsumePostAuth: () => void;
}

const AuthRedirectBridge: React.FC<AuthRedirectBridgeProps> = ({
  onOpenSignIn,
  postAuthPath,
  onConsumePostAuth,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  // useNavigate()'s returned function is not referentially stable across the
  // navigation it triggers, so effects that both call navigate() and list it
  // as a dependency can re-fire once the resulting location change re-renders
  // this component. These refs guard each effect against acting twice on the
  // same signal.
  const consumedSignInRef = useRef(false);
  const consumedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldOpenSignIn = (location.state as { openSignIn?: boolean } | null)
      ?.openSignIn;
    if (shouldOpenSignIn && !consumedSignInRef.current) {
      consumedSignInRef.current = true;
      onOpenSignIn();
      navigate(location.pathname, { replace: true, state: null });
    } else if (!shouldOpenSignIn) {
      consumedSignInRef.current = false;
    }
  }, [location, navigate, onOpenSignIn]);

  useEffect(() => {
    if (!postAuthPath) {
      consumedPathRef.current = null;
      return;
    }
    if (consumedPathRef.current === postAuthPath) return;
    consumedPathRef.current = postAuthPath;
    navigate(postAuthPath);
    onConsumePostAuth();
  }, [postAuthPath, navigate, onConsumePostAuth]);

  return null;
};

export default AuthRedirectBridge;
