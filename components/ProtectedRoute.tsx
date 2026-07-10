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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/" replace state={{ openSignIn: true }} />;
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
