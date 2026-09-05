import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, errorMessage, type AlertItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge, money } from "@/components/StatusBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Bell, Check, ExternalLink, LogOut, X } from "lucide-react";

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
    refetchInterval: 30_000,
  });

  const alertItems = alerts.data?.data ?? [];
  const alertCount = alerts.data?.count ?? alertItems.length;

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
            {isApprover && <AlertsPopover count={alertCount} items={alertItems} />}
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
      
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {isApprover && alertCount > 0 && (
          <OverdueAlertBar count={alertCount} items={alertItems} />
        )}
        {children}
      </main>
    </div>
  );
}

function AlertsPopover({ count, items }: { count: number; items: AlertItem[] }) {
  const qc = useQueryClient();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  async function onDismiss(e: React.MouseEvent, reqId: string) {
    e.stopPropagation();
    e.preventDefault();
    setDismissingId(reqId);
    try {
      await api.dismissAlert(reqId);
      toast.success("Alert dismissed for this screen session. Requisition remains logged in the overdue list.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["alerts"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["requisitions"] }),
      ]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDismissingId(null);
    }
  }

  const activeCount = items.filter((i) => !i.is_dismissed).length;
  const totalCount = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          title={
            activeCount > 0
              ? `${activeCount} new overdue alert(s) (${totalCount} total overdue)`
              : totalCount > 0
              ? `${totalCount} overdue requisition(s) recorded`
              : "No overdue alerts"
          }
        >
          <Bell className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground animate-pulse">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-xl border-border bg-card" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/40">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold">Overdue Requisitions</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                {activeCount} unread
              </span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
              {totalCount} total
            </span>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Check className="mx-auto h-6 w-6 text-chart-1 mb-1" />
              No overdue requisitions.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`p-3 transition-colors flex flex-col gap-1.5 text-xs ${
                  item.is_dismissed ? "bg-muted/20 opacity-85" : "bg-destructive/5 hover:bg-destructive/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/requisitions/$id"
                    params={{ id: item.id }}
                    className="font-semibold text-foreground hover:underline flex items-center gap-1 line-clamp-1"
                  >
                    {item.title}
                    <ExternalLink className="h-3 w-3 inline text-muted-foreground" />
                  </Link>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>
                    Needed by: <strong className="text-destructive font-medium">{item.needed_by?.slice(0, 10)}</strong>
                  </span>
                  <span className="font-medium text-foreground">{money(Number(item.total))}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                    {item.owner_title || item.owner_email || item.department}
                  </span>
                  {!item.is_dismissed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
                      disabled={dismissingId === item.id}
                      onClick={(e) => onDismiss(e, item.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss pop-up
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      ✓ Pop-up dismissed
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {totalCount > 0 && (
          <div className="border-t p-2.5 bg-muted/30 text-center">
            <Link
              to="/requisitions"
              search={{
                overdue: true,
                search: "",
                status: "",
                department: "",
                assigned_to_me: false,
                sort_by: "created_at",
                sort_dir: "desc",
                page: 1,
                page_size: 20,
              }}
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              View all overdue requisitions in table →
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function OverdueAlertBar({ count, items }: { count: number; items: AlertItem[] }) {
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const activeItems = items.filter((i) => !i.is_dismissed);
  const activeCount = activeItems.length;

  if (dismissedBanner || activeCount === 0) return null;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm flex flex-wrap items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-full bg-destructive/20 text-destructive flex-shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <span className="font-semibold text-destructive">
            {activeCount} Overdue Requisition{activeCount > 1 ? "s" : ""} Requiring Attention
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requisitions in Submitted, Approved, or Ordered status have passed their needed-by date.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="destructive" asChild>
          <Link
            to="/requisitions"
            search={{
              overdue: true,
              search: "",
              status: "",
              department: "",
              assigned_to_me: false,
              sort_by: "created_at",
              sort_dir: "desc",
              page: 1,
              page_size: 20,
            }}
          >
            View Overdue ({activeCount})
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setDismissedBanner(true)}
          title="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
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
