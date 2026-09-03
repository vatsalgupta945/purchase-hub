import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage, type LineItem, type RequisitionDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/AppShell";
import { StatusBadge, money } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/requisitions/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Requisition detail — Purchase Requisitions" },
      { name: "description", content: "Line items, approvals, receipts and history." },
      { property: "og:title", content: "Requisition detail — Purchase Requisitions" },
      { property: "og:description", content: "Line items, approvals, receipts and history." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Detail />
    </RequireAuth>
  ),
});

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Detail() {
  const { id } = Route.useParams();
  const { me, isApprover } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const reqQuery = useQuery({ queryKey: ["requisition", id], queryFn: () => api.getRequisition(id) });
  const timelineQuery = useQuery({ queryKey: ["timeline", id], queryFn: () => api.timeline(id) });
  const approversQuery = useQuery({ queryKey: ["approvers", id], queryFn: () => api.approvers(id) });

  const r = reqQuery.data;
  const isOwner = !!me && !!r && r.owner_id === me.id;
  const isDraftOrRejected = r?.status === "Draft" || r?.status === "Rejected";
  const canEdit = isOwner && isDraftOrRejected;

  async function run(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requisition", id] }),
        qc.invalidateQueries({ queryKey: ["timeline", id] }),
        qc.invalidateQueries({ queryKey: ["approvers", id] }),
        qc.invalidateQueries({ queryKey: ["requisitions"] }),
        qc.invalidateQueries({ queryKey: ["alerts"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (reqQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading requisition…</p>;
  if (reqQuery.error)
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {errorMessage(reqQuery.error)}
      </p>
    );
  if (!r) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{r.title}</h1>
        <StatusBadge status={r.status} />
        {Boolean(r.is_archived) && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground border">
            📦 Archived for you
          </span>
        )}
        {r.is_overdue && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            Overdue
          </span>
        )}
        <span className="ml-auto text-sm text-muted-foreground">Total {money(r.total)}</span>
      </div>

      {Boolean(r.is_archived) && (
        <div className="rounded-xl border border-border bg-muted/60 p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              📦 Archived in Your Workspace
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              This requisition is archived for your account only and hidden from your active list. Click <strong>"Restore"</strong> below to unarchive it anytime.
            </p>
          </div>
        </div>
      )}

      {r.status === "Rejected" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-destructive text-sm flex items-center gap-1.5">
              ⚠️ Requisition Rejected
            </span>
            {r.rejected_by_email && (
              <span className="text-xs text-muted-foreground">
                Rejected by: <strong className="text-foreground">{r.rejected_by_title ? `${r.rejected_by_title} (${r.rejected_by_email})` : r.rejected_by_email}</strong>
              </span>
            )}
          </div>
          {r.rejection_reason && (
            <div className="text-sm bg-background/90 rounded-md p-3 border border-border">
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider block mb-1">
                Approver's Rejection Reason:
              </span>
              <p className="text-foreground">{r.rejection_reason}</p>
            </div>
          )}
          {isOwner && (
            <p className="text-xs text-muted-foreground pt-1">
              💡 As the requester, you can update line items or details below and click <strong>"Re-submit for Approval"</strong>.
            </p>
          )}
        </div>
      )}

      <Actions r={r} isOwner={isOwner} isApprover={isApprover} busy={busy} run={run} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Fields r={r} canEdit={canEdit} busy={busy} run={run} />
          <LineItems r={r} canEdit={canEdit} busy={busy} run={run} />
          {isApprover && r.status === "Ordered" && <Receipts r={r} busy={busy} run={run} />}
        </div>

        <div className="space-y-6">
          <Panel title="Assigned approvers">
            <ul className="space-y-2 text-sm">
              {(approversQuery.data ?? []).length === 0 && (
                <li className="text-muted-foreground">No approvers assigned.</li>
              )}
              {(approversQuery.data ?? []).map((a) => (
                <li key={a.approver_id} className="flex items-center justify-between gap-2">
                  <span>{a.email}</span>
                  {isApprover && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(() => api.removeApprover(id, a.approver_id), "Approver removed.")
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {isApprover && <AddApprover id={id} busy={busy} run={run} />}
          </Panel>

          <ApproverHierarchyPanel />

          <Panel title="Timeline">
            <ol className="space-y-3 text-sm">
              {(timelineQuery.data ?? []).length === 0 && (
                <li className="text-muted-foreground">Nothing recorded yet.</li>
              )}
              {(timelineQuery.data ?? []).map((t) => (
                <li key={t.id} className="border-l-2 border-border pl-3">
                  <p className="font-medium">{t.event_type ?? t.action ?? "event"}</p>
                  {t.body && <p className="text-muted-foreground">{t.body}</p>}
                  {t.reason && <p className="text-muted-foreground">{t.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.actor_email ? `${t.actor_email} · ` : ""}
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Add comment">
            <CommentBox id={id} busy={busy} run={run} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ApproverHierarchyPanel() {
  const hierarchyQuery = useQuery({ queryKey: ["hierarchy"], queryFn: () => api.hierarchy() });
  const data = hierarchyQuery.data?.data ?? [];

  if (hierarchyQuery.isLoading) return <Panel title="Approver Hierarchy"><p className="text-xs text-muted-foreground">Loading hierarchy…</p></Panel>;

  return (
    <Panel title="Approver Hierarchy & Monthly Limits">
      <div className="space-y-2.5 text-xs">
        {data.map((user) => (
          <div key={user.id} className="rounded-lg border p-2.5 bg-background/50 space-y-1">
            <div className="flex items-center justify-between font-medium">
              <span>{user.title || user.email}</span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary uppercase font-semibold">
                {user.role}
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">{user.email} {user.department ? `· ${user.department}` : ""}</p>
            {user.role === "approver" && user.approval_limit !== null && (
              <div className="pt-1 border-t mt-1 flex flex-wrap justify-between gap-1 text-[11px] text-muted-foreground">
                <span>Monthly: <strong>{money(user.approval_limit)}</strong></span>
                <span>Remaining: <strong className="text-foreground">{money(user.remaining_monthly_limit ?? 0)}</strong></span>
              </div>
            )}
            {user.reports_to_email && (
              <p className="text-[10px] text-muted-foreground pt-0.5">
                ↳ Reports to: <span className="font-medium text-foreground">{user.reports_to_title ? `${user.reports_to_title} (${user.reports_to_email})` : user.reports_to_email}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

function Actions({
  r,
  isOwner,
  isApprover,
  busy,
  run,
}: {
  r: RequisitionDetail;
  isOwner: boolean;
  isApprover: boolean;
  busy: boolean;
  run: Run;
}) {
  const { me } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [extending, setExtending] = useState(false);
  const [neededBy, setNeededBy] = useState(r.needed_by?.slice(0, 10) ?? "");
  const archived = Boolean(r.is_archived);

  const monthlyLimit = me?.monthly_approval_limit ?? me?.approval_limit ?? null;
  const usedThisMonth = me?.used_this_month ?? 0;
  const remainingMonthlyLimit = me?.remaining_monthly_limit ?? (monthlyLimit !== null ? Math.max(0, monthlyLimit - usedThisMonth) : null);
  const exceedsLimit = isApprover && remainingMonthlyLimit !== null && r.total > remainingMonthlyLimit;
  const canEscalate = isApprover && r.status === "Submitted" && exceedsLimit && Boolean(me?.reports_to_id || me?.reports_to_email);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      {isApprover && monthlyLimit !== null && (
        <div className="rounded-lg bg-muted/60 p-3 text-xs flex flex-wrap items-center justify-between gap-2 border">
          <div>
            <span className="font-medium text-foreground">Your Monthly Approval Limit: </span>
            <span>{money(monthlyLimit)}/month</span>
          </div>
          <div className="flex gap-3 text-muted-foreground">
            <span>Spent this month: <strong className="text-foreground">{money(usedThisMonth)}</strong></span>
            <span>Remaining: <strong className={remainingMonthlyLimit < r.total ? "text-destructive font-bold" : "text-emerald-600"}>{money(remainingMonthlyLimit)}</strong></span>
          </div>
          <span className="w-full text-[11px] text-muted-foreground italic">
            * Limit resets automatically at the start of each month.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isOwner && (r.status === "Draft" || r.status === "Rejected") && (
          <Button disabled={busy} onClick={() => run(() => api.submit(r.id), r.status === "Rejected" ? "Requisition re-submitted for approval." : "Requisition submitted.")}>
            {r.status === "Rejected" ? "Re-submit for approval" : "Submit"}
          </Button>
        )}
        {isApprover && r.status === "Submitted" && (
          <>
            <Button disabled={busy || exceedsLimit} onClick={() => run(() => api.approve(r.id), "Approved.")}>
              Approve
            </Button>
            {canEscalate && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    async () => {
                      const res = await api.escalate(r.id);
                      return res;
                    },
                    `Requisition escalated to senior approver (${me?.reports_to_email || "Senior Manager"}).`
                  )
                }
              >
                Escalate to Senior Approver ({me?.reports_to_email || "Senior Manager"})
              </Button>
            )}
            <Button variant="destructive" disabled={busy} onClick={() => setRejecting((v) => !v)}>
              Reject
            </Button>
            {exceedsLimit && (
              <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                Total ({money(r.total)}) exceeds your remaining limit ({money(remainingMonthlyLimit)})
              </span>
            )}
          </>
        )}
        {isApprover && r.status === "Approved" && (
          <Button disabled={busy} onClick={() => run(() => api.order(r.id), "Marked as ordered.")}>
            Mark ordered
          </Button>
        )}
        {isApprover && r.status === "Ordered" && (
          <Button variant="outline" disabled={busy} onClick={() => setExtending((v) => !v)}>
            Extend needed-by date
          </Button>
        )}
        {!archived && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(() => api.archive(r.id), "Archived.")}
          >
            Archive
          </Button>
        )}
        {archived && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(() => api.restore(r.id), "Restored.")}
          >
            Restore
          </Button>
        )}
      </div>

      {rejecting && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="reason">Rejection reason (required)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            disabled={busy || reason.trim() === ""}
            onClick={async () => {
              await run(() => api.reject(r.id, reason.trim()), "Requisition rejected.");
              setReason("");
              setRejecting(false);
            }}
          >
            Confirm reject
          </Button>
        </div>
      )}

      {extending && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="ext">New needed-by date</Label>
            <Input
              id="ext"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>
          <Button
            disabled={busy || !neededBy}
            onClick={async () => {
              await run(() => api.updateNeededBy(r.id, neededBy), "Needed-by date updated.");
              setExtending(false);
            }}
          >
            Save date
          </Button>
        </div>
      )}
    </div>
  );
}

function Fields({
  r,
  canEdit,
  busy,
  run,
}: {
  r: RequisitionDetail;
  canEdit: boolean;
  busy: boolean;
  run: Run;
}) {
  const [form, setForm] = useState({
    title: r.title,
    vendor_name: r.vendor_name,
    department: r.department,
    needed_by: r.needed_by?.slice(0, 10) ?? "",
  });

  useEffect(() => {
    setForm({
      title: r.title,
      vendor_name: r.vendor_name,
      department: r.department,
      needed_by: r.needed_by?.slice(0, 10) ?? "",
    });
  }, [r.id, r.title, r.vendor_name, r.department, r.needed_by]);

  const requesterDisplay = r.owner_title ? `${r.owner_title} (${r.owner_email})` : (r.owner_email || "Requester");

  if (!canEdit) {
    return (
      <Panel title="Details">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail2 label="Requester" value={requesterDisplay} />
          <Detail2 label="Vendor" value={r.vendor_name} />
          <Detail2 label="Department" value={r.department} />
          <Detail2 label="Needed by" value={r.needed_by?.slice(0, 10) ?? "—"} />
          <Detail2 label="Status" value={r.status} />
        </dl>
      </Panel>
    );
  }

  return (
    <Panel title="Details">
      <div className="mb-3 text-xs text-muted-foreground">
        <span>Requester: <strong>{requesterDisplay}</strong></span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["title", "Title", "text"],
            ["vendor_name", "Vendor", "text"],
            ["department", "Department", "text"],
            ["needed_by", "Needed by", "date"],
          ] as const
        ).map(([key, label, type]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              type={type}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-4"
        size="sm"
        disabled={busy}
        onClick={() => run(() => api.updateRequisition(r.id, form), "Details saved.")}
      >
        Save details
      </Button>
    </Panel>
  );
}

function Detail2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function LineItems({
  r,
  canEdit,
  busy,
  run,
}: {
  r: RequisitionDetail;
  canEdit: boolean;
  busy: boolean;
  run: Run;
}) {
  const [draft, setDraft] = useState({ description: "", ordered_quantity: 1, unit_price: 0 });

  return (
    <Panel title="Line items">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-1">Description</th>
            <th className="py-1 w-24">Qty</th>
            <th className="py-1 w-32">Unit price</th>
            <th className="py-1 w-28 text-right">Line total</th>
            {canEdit && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {(r.line_items ?? []).map((li) => (
            <LineRow key={li.id} r={r} li={li} canEdit={canEdit} busy={busy} run={run} />
          ))}
          {(r.line_items ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-muted-foreground">
                No line items.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="new-desc">Description</Label>
            <Input
              id="new-desc"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="new-qty">Qty</Label>
            <Input
              id="new-qty"
              type="number"
              min={1}
              value={draft.ordered_quantity}
              onChange={(e) => setDraft({ ...draft, ordered_quantity: Number(e.target.value) })}
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="new-price">Unit price</Label>
            <Input
              id="new-price"
              type="number"
              min={0}
              step="0.01"
              value={draft.unit_price}
              onChange={(e) => setDraft({ ...draft, unit_price: Number(e.target.value) })}
            />
          </div>
          <Button
            variant="secondary"
            disabled={busy || draft.description.trim() === ""}
            onClick={async () => {
              await run(() => api.addLineItem(r.id, draft), "Line item added.");
              setDraft({ description: "", ordered_quantity: 1, unit_price: 0 });
            }}
          >
            Add line
          </Button>
        </div>
      )}
      <p className="mt-4 text-right text-sm font-medium">Total {money(r.total)}</p>
    </Panel>
  );
}

function LineRow({
  r,
  li,
  canEdit,
  busy,
  run,
}: {
  r: RequisitionDetail;
  li: LineItem;
  canEdit: boolean;
  busy: boolean;
  run: Run;
}) {
  const [row, setRow] = useState({
    description: li.description,
    ordered_quantity: li.ordered_quantity,
    unit_price: li.unit_price,
  });

  useEffect(() => {
    setRow({
      description: li.description,
      ordered_quantity: li.ordered_quantity,
      unit_price: li.unit_price,
    });
  }, [li.description, li.ordered_quantity, li.unit_price]);

  if (!canEdit) {
    return (
      <tr className="border-t">
        <td className="py-2">
          {li.description}
          {li.received_quantity !== undefined && (
            <span className="ml-2 text-xs text-muted-foreground">
              received {li.received_quantity}/{li.ordered_quantity}
            </span>
          )}
        </td>
        <td className="py-2">{li.ordered_quantity}</td>
        <td className="py-2">{money(li.unit_price)}</td>
        <td className="py-2 text-right">{money(li.ordered_quantity * li.unit_price)}</td>
      </tr>
    );
  }

  const save = () => run(() => api.updateLineItem(r.id, li.id, row), "Line item updated.");

  return (
    <tr className="border-t">
      <td className="py-1.5 pr-2">
        <Input
          className="h-8"
          value={row.description}
          onChange={(e) => setRow({ ...row, description: e.target.value })}
          onBlur={save}
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          className="h-8"
          type="number"
          min={1}
          value={row.ordered_quantity}
          onChange={(e) => setRow({ ...row, ordered_quantity: Number(e.target.value) })}
          onBlur={save}
        />
      </td>
      <td className="py-1.5 pr-2">
        <Input
          className="h-8"
          type="number"
          min={0}
          step="0.01"
          value={row.unit_price}
          onChange={(e) => setRow({ ...row, unit_price: Number(e.target.value) })}
          onBlur={save}
        />
      </td>
      <td className="py-1.5 text-right">{money(row.ordered_quantity * row.unit_price)}</td>
      <td className="py-1.5 text-right">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => run(() => api.deleteLineItem(r.id, li.id), "Line item removed.")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function Receipts({ r, busy, run }: { r: RequisitionDetail; busy: boolean; run: Run }) {
  const [values, setValues] = useState<Record<string, number>>({});

  const entries = (r.line_items ?? []).map((li) => ({
    li,
    remaining: Math.max(0, li.ordered_quantity - (li.received_quantity ?? 0)),
  }));

  const payload = entries
    .map(({ li }) => ({ line_item_id: li.id, quantity_received: Number(values[li.id] ?? 0) }))
    .filter((x) => x.quantity_received > 0);

  return (
    <Panel title="Record receipt">
      <ul className="space-y-2 text-sm">
        {entries.map(({ li, remaining }) => (
          <li key={li.id} className="flex items-center gap-3">
            <span className="flex-1">{li.description}</span>
            <span className="text-xs text-muted-foreground">remaining {remaining}</span>
            <Input
              className="h-8 w-24"
              type="number"
              min={0}
              max={remaining}
              value={values[li.id] ?? ""}
              onChange={(e) => {
                const n = Math.min(Number(e.target.value), remaining);
                setValues({ ...values, [li.id]: Number.isNaN(n) ? 0 : n });
              }}
            />
          </li>
        ))}
      </ul>
      <Button
        className="mt-4"
        size="sm"
        disabled={busy || payload.length === 0}
        onClick={async () => {
          await run(() => api.receipts(r.id, payload), "Receipt recorded.");
          setValues({});
        }}
      >
        Record receipt
      </Button>
    </Panel>
  );
}

function AddApprover({ id, busy, run }: { id: string; busy: boolean; run: Run }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-4 flex items-end gap-2">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="approver">Approver ID</Label>
        <Input
          id="approver"
          className="h-8"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy || value.trim() === ""}
        onClick={async () => {
          await run(() => api.addApprover(id, value.trim()), "Approver assigned.");
          setValue("");
        }}
      >
        Assign
      </Button>
    </div>
  );
}

function CommentBox({ id, busy, run }: { id: string; busy: boolean; run: Run }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        size="sm"
        disabled={busy || body.trim() === ""}
        onClick={async () => {
          await run(() => api.comment(id, body.trim()), "Comment added.");
          setBody("");
        }}
      >
        Post comment
      </Button>
    </div>
  );
}
