import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Bell, LogOut } from "lucide-react";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, isApprover, signOut } = useAuth();
  const navigate = useNavigate();

  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: api.alerts,
    enabled: isApprover,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <Link to="/" className="mr-3 text-sm font-semibold tracking-tight">
            Requisitions
          </Link>
          <nav className="flex items-center gap-1">
            {isApprover && <NavLink to="/">Dashboard</NavLink>}
            <NavLink to="/requisitions">Requisitions</NavLink>
            {isApprover && <NavLink to="/queue">Approval queue</NavLink>}
            {!isApprover && <NavLink to="/requisitions/new">New</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {isApprover && (
              <span className="relative inline-flex items-center text-muted-foreground">
                <Bell className="h-4 w-4" />
                {(alerts.data?.count ?? 0) > 0 && (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
                    {alerts.data?.count}
                  </span>
                )}
              </span>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {me?.email} · {me?.role}
              {isApprover && me?.approval_limit != null && (
                <> · Limit: ${me.approval_limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export function RequireAuth({
  children,
  approverOnly,
  requesterOnly,
}: {
  children: ReactNode;
  approverOnly?: boolean;
  requesterOnly?: boolean;
}) {
  const { session, me, loading, isApprover } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const denied = (approverOnly && !isApprover) || (requesterOnly && isApprover);
  if (me && denied) {
    return (
      <AppShell>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This page isn’t available for your role.
        </div>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
