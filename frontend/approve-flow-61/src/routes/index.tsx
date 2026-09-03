import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, errorMessage, type DashboardData } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/AppShell";
import { money } from "@/components/StatusBadge";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — Purchase Requisitions" },
      { name: "description", content: "Spend, approvals and receiving at a glance." },
      { property: "og:title", content: "Dashboard — Purchase Requisitions" },
      { property: "og:description", content: "Spend, approvals and receiving at a glance." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Home />
    </RequireAuth>
  ),
});

function toPairs(input: DashboardData["by_status"] | DashboardData["by_department"]) {
  if (!input) return [] as { label: string; count: number }[];
  if (Array.isArray(input)) {
    return input.map((row) => {
      const r = row as Record<string, unknown>;
      const label = String(r['status'] ?? r['department'] ?? r['label'] ?? "—");
      return { label, count: Number(r['count'] ?? 0) };
    });
  }
  return Object.entries(input).map(([label, count]) => ({ label, count: Number(count) }));
}

function Home() {
  const { isApprover, me } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (me && !isApprover) navigate({ to: "/requisitions" });
  }, [me, isApprover, navigate]);

  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });

  if (me && !isApprover) return null;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  if (error)
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {errorMessage(error)}
      </p>
    );
  if (!data) return null;

  const weeks = (data.received_per_week ?? []).map((w) => {
    const r = w as unknown as Record<string, unknown>;
    return {
      week: String(r['week'] ?? r['week_start'] ?? ""),
      count: Number(r['count'] ?? r['received'] ?? 0),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting approval" value={String(data.awaiting_approval ?? 0)} />
        <Stat label="Open commitments" value={money(data.open_commitments_value)} />
        <Stat label="Overdue" value={String(data.overdue_count ?? 0)} />
        <Stat label="Received (7 days)" value={String(data.received_last_7_days ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="By status" rows={toPairs(data.by_status)} />
        <Breakdown title="By department" rows={toPairs(data.by_department)} />
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Received per week (8 weeks)</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.length === 0 && <li className="text-sm text-muted-foreground">No data.</li>}
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
