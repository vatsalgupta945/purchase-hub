import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api, type Me } from "./api";

const DEMO_USERS: Record<string, string> = {
  "approver3@example.com": "55555555-5555-5555-5555-555555555555",
  "cfo@example.com": "66666666-6666-6666-6666-666666666666",
  "approver2@example.com": "44444444-4444-4444-4444-444444444444",
  "ops_manager@example.com": "77777777-7777-7777-7777-777777777777",
  "requester@example.com": "11111111-1111-1111-1111-111111111111",
  "ops_analyst@example.com": "12121212-1212-1212-1212-121212121212",
  "eng_director@example.com": "88888888-8888-8888-8888-888888888888",
  "eng_manager@example.com": "99999999-9999-9999-9999-999999999999",
  "approver1@example.com": "33333333-3333-3333-3333-333333333333",
  "dev_lead@example.com": "13131313-1313-1313-1313-131313131313",
  "qa_lead@example.com": "14141414-1414-1414-1414-141414141414",
  "safety_director@example.com": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "safety_supervisor@example.com": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "requester2@example.com": "22222222-2222-2222-2222-222222222222",
  "facilities_coord@example.com": "15151515-1515-1515-1515-151515151515",
  "it_director@example.com": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "cloud_lead@example.com": "dddddddd-dddd-dddd-dddd-dddddddddddd",
  "devops_eng@example.com": "16161616-1616-1616-1616-161616161616",
};

export function createMockJwt(email: string): string {
  const userId = DEMO_USERS[email.toLowerCase()] || crypto.randomUUID();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({ sub: userId, email, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400 }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.mock_signature`;
}

export function createMockSession(email: string): Session {
  const token = createMockJwt(email);
  const userId = DEMO_USERS[email.toLowerCase()] || crypto.randomUUID();
  const session: Session = {
    access_token: token,
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: { email },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email,
    },
  };
  if (typeof window !== "undefined") {
    localStorage.setItem("mock_session", JSON.stringify(session));
  }
  return session;
}

type AuthState = {
  session: Session | null;
  me: Me | null;
  loading: boolean;
  isApprover: boolean;
  setSession: (session: Session | null) => void;
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mock_session");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSession(parsed);
          setLoading(false);
          return;
        } catch {}
      }
    }

    const timeoutId = setTimeout(() => {
      if (active) setLoading(false);
    }, 1500);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        clearTimeout(timeoutId);
        if (!active) return;
        if (data.session) setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (next) setSession(next);
      if (event === "SIGNED_OUT") {
        setMe(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .me()
      .then((profile) => {
        if (active) setMe(profile);
      })
      .catch(() => {
        if (active) setMe(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.access_token]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      me,
      loading,
      isApprover: me?.role === "approver",
      setSession,
      refreshMe: async () => {
        try {
          setMe(await api.me());
        } catch {
          setMe(null);
        }
      },
      signOut: async () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("mock_session");
        }
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
        setMe(null);
      },
    }),
    [session, me, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
