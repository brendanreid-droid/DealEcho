import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../src/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Redirect to home (shows sign-in modal) if not authenticated */
  requireAuth?: boolean;
  /** Redirect to /pricing if user doesn't have paid or admin role */
  requirePaid?: boolean;
  /** Redirect to home if user doesn't have admin role */
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requirePaid = false,
  requireAdmin = false,
}) => {
  const { user, isAdmin, isPaid, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-semibold tracking-wide">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requirePaid && !isPaid) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
