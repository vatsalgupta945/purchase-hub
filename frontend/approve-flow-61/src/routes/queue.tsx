import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { RequireAuth } from "@/components/AppShell";
import { money } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/queue")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approval queue — Purchase Requisitions" },
      { name: "description", content: "Review and bulk-approve submitted requisitions." },
      { property: "og:title", content: "Approval queue — Purchase Requisitions" },
      { property: "og:description", content: "Review and bulk-approve submitted requisitions." },
    ],
  }),
  component: () => (
    <RequireAuth approverOnly>
      <Queue />
    </RequireAuth>
  ),
});

function Queue() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<{ id: string; status: string; reason?: string }[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const query = useQuery({
    queryKey: ["queue", page],
    queryFn: () =>
      api.listRequisitions({
        status: "Submitted",
        sort_by: "needed_by",
        sort_dir: "asc",
        page,
        page_size: pageSize,
      }),
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const ids = Object.keys(selected).filter((k) => selected[k]);

  async function bulkApprove() {
    setBusy(true);
    try {
      const res = await api.bulkApprove(ids);
      setResults(res.results ?? []);
      setSelected({});
      const approved = (res.results ?? []).filter((r) => r.status === "approved").length;
      toast.success(`${approved} of ${res.results?.length ?? 0} approved.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["queue"] }),
        qc.invalidateQueries({ queryKey: ["requisitions"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Approval queue</h1>
        <Button
          className="ml-auto"
          size="sm"
          disabled={busy || ids.length === 0}
          onClick={bulkApprove}
        >
          Bulk approve ({ids.length})
        </Button>
      </div>

      {query.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage(query.error)}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && ids.length === rows.length}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? Object.fromEntries(rows.map((r) => [r.id, true]))
                        : {},
                    )
                  }
                />
              </th>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Vendor</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Needed by</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!query.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nothing awaiting approval.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const result = results?.find((x) => x.id === r.id);
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onChange={(e) => setSelected({ ...selected, [r.id]: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to="/requisitions/$id"
                      params={{ id: r.id }}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.vendor_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.department}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.needed_by?.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right">{money(r.total)}</td>
                  <td className="px-4 py-2 text-xs">
                    {result ? (
                      result.status === "approved" ? (
                        <span className="font-medium text-chart-1">Approved</span>
                      ) : (
                        <span className="text-destructive">
                          Refused{result.reason ? `: ${result.reason}` : ""}
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {results && results.length > 0 && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">Last bulk approve results</h2>
          <ul className="mt-2 space-y-1">
            {results.map((res) => (
              <li key={res.id} className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">{res.id}</span>
                <span
                  className={res.status === "approved" ? "text-chart-1" : "text-destructive"}
                >
                  {res.status}
                  {res.reason ? ` — ${res.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{total} submitted</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * pageSize >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
