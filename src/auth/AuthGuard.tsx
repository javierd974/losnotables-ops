// src/auth/AuthGuard.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthed } from "./auth";

export function AuthGuard() {
  const location = useLocation();

  if (!isAuthed()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function LoginRedirectIfAuthed({ children }: { children: React.ReactNode }) {
  if (isAuthed()) return <Navigate to="/select-local" replace />;
  return <>{children}</>;
}
