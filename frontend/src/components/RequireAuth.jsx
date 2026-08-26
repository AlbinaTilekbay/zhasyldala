import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

export function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  return isAuthenticated ? <Outlet /> : <Navigate to="/welcome" replace />;
}

export function RequireStaff() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));
  const isStaff = useAuthStore((s) => Boolean(s.user?.is_staff));
  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
  if (!isStaff) return <Navigate to="/app" replace />;
  return <Outlet />;
}
