"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthRole = "MOH_ADMIN" | "GUEST_CONFIRMED";

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AuthRole;
  isAdmin: boolean;
  isVerified: boolean;
  isDemo: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const DEMO_AUTH_STATE: Omit<AuthState, "signOut"> = {
  session: null,
  user: null,
  role: "MOH_ADMIN",
  isAdmin: true,
  isVerified: true,
  isDemo: true,
  loading: false,
};

export function AuthProvider({ children }: { children: ReactNode; }) {
  const isSupabaseMode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase";
  const isDemo = !isSupabaseMode || !isSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AuthRole>("GUEST_CONFIRMED");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo) return;

    const supabase = createClient();

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (currentSession?.user) {
        void hydrateProfile(currentSession.user.id);
      }
    }

    async function hydrateProfile(userId: string) {
      const profileResult = await supabase
        .from("profiles")
        .select("is_verified")
        .eq("id", userId)
        .maybeSingle();

      if (!profileResult.error) {
        setIsVerified(Boolean(profileResult.data?.is_verified));
      }

      const membershipResult = await supabase
        .from("memberships")
        .select("role")
        .eq("profile_id", userId)
        .limit(1)
        .maybeSingle();

      if (!membershipResult.error && membershipResult.data?.role === "MOH_ADMIN") {
        setRole("MOH_ADMIN");
      } else {
        setRole("GUEST_CONFIRMED");
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void hydrateProfile(nextSession.user.id);
      } else {
        setRole("GUEST_CONFIRMED");
        setIsVerified(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemo]);

  const value = useMemo<AuthState>(() => {
    if (isDemo) {
      return {
        ...DEMO_AUTH_STATE,
        signOut: async () => { },
      };
    }

    return {
      session,
      user,
      role,
      isAdmin: role === "MOH_ADMIN",
      isVerified,
      isDemo: false,
      loading,
      signOut: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/login";
      },
    };
  }, [isDemo, isVerified, loading, role, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
