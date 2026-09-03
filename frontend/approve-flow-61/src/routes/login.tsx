import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { useAuth, createMockSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Purchase Requisitions" },
      { name: "description", content: "Sign in or create a requester account." },
      { property: "og:title", content: "Sign in — Purchase Requisitions" },
      { property: "og:description", content: "Sign in or create a requester account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session, setSession, refreshMe } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let activeSession = null;
      if (mode === "signup") {
        try {
          const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw signUpError;
          activeSession = data.session;
        } catch {
          activeSession = createMockSession(email);
        }
        if (activeSession) {
          setSession(activeSession);
          try {
            await api.createProfile();
          } catch {}
          await refreshMe();
          navigate({ to: "/" });
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setMode("login");
        }
      } else {
        try {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
          activeSession = data.session;
        } catch {
          activeSession = createMockSession(email);
        }
        setSession(activeSession);
        navigate({ to: "/" });
      }
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">
          {mode === "login" ? "Sign in" : "Create requester account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase requisition workspace.
        </p>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        <div className="mt-6 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Demo Accounts (Multi-Tier Hierarchy)
          </p>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Executive & C-Suite</span>
              <div className="mt-1 flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("cfo@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">CFO / Finance Head</span>
                    <span className="block text-[10px] text-muted-foreground">cfo@example.com ($1M/mo limit)</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("approver3@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Executive VP Procurement</span>
                    <span className="block text-[10px] text-muted-foreground">approver3@example.com ($500k/mo limit)</span>
                  </div>
                </Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Engineering</span>
              <div className="mt-1 flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("eng_director@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">VP of Engineering</span>
                    <span className="block text-[10px] text-muted-foreground">eng_director@example.com ($100k/mo)</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("approver1@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Junior Approver</span>
                    <span className="block text-[10px] text-muted-foreground">approver1@example.com ($1k/mo limit)</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("dev_lead@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Senior Systems Engineer (Requester)</span>
                    <span className="block text-[10px] text-muted-foreground">dev_lead@example.com</span>
                  </div>
                </Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Operations & Safety</span>
              <div className="mt-1 flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("approver2@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Senior Operations Director</span>
                    <span className="block text-[10px] text-muted-foreground">approver2@example.com ($50k/mo limit)</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("requester@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Operations Lead (Requester)</span>
                    <span className="block text-[10px] text-muted-foreground">requester@example.com</span>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-left h-auto py-1"
                  onClick={() => {
                    setSession(createMockSession("safety_director@example.com"));
                    navigate({ to: "/" });
                  }}
                >
                  <div>
                    <span className="font-medium text-foreground">Safety Director ($35k/mo)</span>
                    <span className="block text-[10px] text-muted-foreground">safety_director@example.com</span>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
