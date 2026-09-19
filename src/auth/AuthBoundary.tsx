import { LockKeyhole, RefreshCcw } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { requiredRouteRedirect } from "./onboarding";

export function AuthBoundary() {
  const { user, loading, error, refreshUser } = useAuth();
  const location = useLocation();
  if (loading) return <div className="auth-state"><span className="eyebrow">Private research instrument</span><h1>Opening TracerText…</h1><p>Confirming your private workspace.</p></div>;
  if (!user) return <div className="auth-state"><LockKeyhole size={24} /><span className="eyebrow">Authentication required</span><h1>Sign in to TracerText</h1><p>{error ?? "Cloudflare Access must confirm your identity before this workspace can open."}</p><button className="primary-button" type="button" onClick={() => void refreshUser()}><RefreshCcw size={16} />Try again</button></div>;
  const redirect = requiredRouteRedirect(user, location.pathname);
  if (redirect) return <Navigate to={redirect} replace />;
  return <Outlet />;
}
