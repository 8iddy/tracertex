import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppUser } from "../editor/eventTypes";
import { setActiveLocalUser } from "../storage/indexedDb";

interface AuthContextValue {
  user?: AppUser;
  loading: boolean;
  error?: string;
  refreshUser: () => Promise<AppUser>;
  beginOnboarding: () => Promise<AppUser>;
  completeOnboarding: () => Promise<AppUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isAppUser(value: unknown): value is AppUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppUser>;
  return typeof candidate.id === "string" && typeof candidate.email === "string" && typeof candidate.onboardingStatus === "string" && typeof candidate.onboardingStep === "number";
}

async function requestUser(path: string, init?: RequestInit): Promise<AppUser> {
  const response = await fetch(path, init);
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `Authentication request failed (${response.status}).`;
    throw new Error(message);
  }
  if (!isAppUser(body)) throw new Error("TracerText received an invalid identity response.");
  await setActiveLocalUser(body.id);
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refreshUser = useCallback(async () => {
    const next = await requestUser("/api/me");
    setUser(next);
    setError(undefined);
    return next;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      try {
        const next = await requestUser("/api/me");
        if (active) setUser(next);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Authentication is required.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadIdentity();
    return () => {
      active = false;
    };
  }, []);

  const updateOnboarding = useCallback(async (path: string) => {
    const next = await requestUser(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setUser(next);
    return next;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    refreshUser,
    beginOnboarding: () => updateOnboarding("/api/onboarding/start"),
    completeOnboarding: () => updateOnboarding("/api/onboarding/complete"),
    signOut: () => window.location.assign("/cdn-cgi/access/logout"),
  }), [error, loading, refreshUser, updateOnboarding, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The provider and hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
