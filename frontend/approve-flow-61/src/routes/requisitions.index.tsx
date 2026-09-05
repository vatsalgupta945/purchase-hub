import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/AppShell";
import { StatusBadge, money } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Plus } from "lucide-react";

type Search = {
  search: string;
  status: string;
  department: string;
  overdue: boolean;
  assigned_to_me: boolean;
  sort_by: string;
  sort_dir: string;
  page: number;
  page_size: number;
};

export const Route = createFileRoute("/requisitions/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Requisitions — Purchase Requisitions" },
      { name: "description", content: "Search, filter and sort purchase requisitions." },
      { property: "og:title", content: "Requisitions — Purchase Requisitions" },
      { property: "og:description", content: "Search, filter and sort purchase requisitions." },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): Search => ({
    search: typeof raw['search'] === "string" ? raw['search'] : "",
    status: typeof raw['status'] === "string" ? raw['status'] : "",
    department: typeof raw['department'] === "string" ? raw['department'] : "",
    overdue: raw['overdue'] === true || raw['overdue'] === "true",
    assigned_to_me: raw['assigned_to_me'] === true || raw['assigned_to_me'] === "true",
    sort_by: typeof raw['sort_by'] === "string" ? raw['sort_by'] : "created_at",
    sort_dir: raw['sort_dir'] === "asc" ? "asc" : "desc",
    page: Number(raw['page']) > 0 ? Number(raw['page']) : 1,
    page_size: Number(raw['page_size']) > 0 ? Number(raw['page_size']) : 20,
  }),
  component: () => (
    <RequireAuth>
      <RequisitionsList />
    </RequireAuth>
  ),
});

const STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Ordered", "Received", "Archived"];
const SORTS = [
  { value: "created_at", label: "Created" },
  { value: "needed_by", label: "Needed by" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "total", label: "Total" },
];

function RequisitionsList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/requisitions/" });
  const { isApprover } = useAuth();
  const [searchInput, setSearchInput] = useState(search.search);
  const [deptInput, setDeptInput] = useState(search.department);
  const [exporting, setExporting] = useState(false);

  useEffect(() => setSearchInput(search.search), [search.search]);
  useEffect(() => setDeptInput(search.department), [search.department]);

  const setSearch = (patch: Partial<Search>) =>
    navigate({
      search: (prev: Search) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
    });

  // Automatic live search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search.search) {
        setSearch({ search: searchInput });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Automatic live department filter with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (deptInput !== search.department) {
        setSearch({ department: deptInput });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [deptInput]);

  const hasActiveFilters = Boolean(
    search.search || search.status || search.department || search.overdue || search.assigned_to_me
  );

  const query = useQuery({
    queryKey: ["requisitions", search],
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.listRequisitions({
        search: search.search,
        status: search.status,
        department: search.department,
        overdue: search.overdue ? "true" : "",
        assigned_to_me: search.assigned_to_me ? "true" : "",
        sort_by: search.sort_by,
        sort_dir: search.sort_dir,
        page: search.page,
        page_size: search.page_size,
      }),
  });

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / search.page_size));

  async function onExport() {
    setExporting(true);
    try {
      const res = await api.exportOpenCommitments();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "open-commitments.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Requisitions</h1>
        <div className="ml-auto flex items-center gap-2">
          {isApprover && (
            <Button variant="outline" size="sm" onClick={onExport} disabled={exporting}>
              <Download className="mr-1.5 h-4 w-4" /> Export open commitments
            </Button>
          )}
          {!isApprover && (
            <Button size="sm" asChild>
              <Link to="/requisitions/new">
                <Plus className="mr-1.5 h-4 w-4" /> New requisition
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isApprover && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={!search.assigned_to_me ? "default" : "outline"}
            onClick={() => setSearch({ assigned_to_me: false, status: "Submitted" })}
          >
            Full queue
          </Button>
          <Button
            size="sm"
            variant={search.assigned_to_me ? "default" : "outline"}
            onClick={() => setSearch({ assigned_to_me: true, status: "" })}
          >
            Assigned to me
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch({ search: searchInput });
          }}
        >
          <Input
            placeholder="Search title or vendor…"
            className="h-9 w-60"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button size="sm" type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={search.status}
          onChange={(e) => setSearch({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <Input
          placeholder="Filter department…"
          className="h-9 w-44"
          value={deptInput}
          onChange={(e) => setDeptInput(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={search.overdue}
            onChange={(e) => setSearch({ overdue: e.target.checked })}
          />
          Overdue only
        </label>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchInput("");
              setDeptInput("");
              setSearch({ search: "", status: "", department: "", overdue: false, assigned_to_me: false });
            }}
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={search.sort_by}
            onChange={(e) => setSearch({ sort_by: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSearch({ sort_dir: search.sort_dir === "asc" ? "desc" : "asc" })}
          >
            {search.sort_dir === "asc" ? "Asc" : "Desc"}
          </Button>
        </div>
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
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Requester</th>
              <th className="px-4 py-2">Vendor</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Needed by</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Total</th>
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
                  No requisitions match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                <td className="px-4 py-2">
                  <Link
                    to="/requisitions/$id"
                    params={{ id: r.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {r.title}
                  </Link>
                  {r.is_overdue && (
                    <span className="ml-2 text-xs font-medium text-destructive">Overdue</span>
                  )}
                  {r.status === "Rejected" && r.rejection_reason && (
                    <p className="text-[11px] text-destructive truncate max-w-xs mt-0.5">
                      Reason: {r.rejection_reason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-foreground">
                  <span className="font-medium">{r.owner_title || r.owner_email || "Requester"}</span>
                  {r.owner_title && r.owner_email && (
                    <span className="block text-[11px] text-muted-foreground">{r.owner_email}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.vendor_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.department}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.needed_by?.slice(0, 10)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={r.status} />
                    {Boolean(r.is_archived) && (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground border">
                        📦 Archived
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {total} result{total === 1 ? "" : "s"} · page {search.page} of {pages}
        </span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={search.page_size}
          onChange={(e) => setSearch({ page_size: Number(e.target.value) })}
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={search.page <= 1}
            onClick={() => setSearch({ page: search.page - 1 })}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={search.page >= pages}
            onClick={() => setSearch({ page: search.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
