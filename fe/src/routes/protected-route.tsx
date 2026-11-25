import React from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/context/auth-context";

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8fafc]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-200 border-t-[#17664e]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
};
