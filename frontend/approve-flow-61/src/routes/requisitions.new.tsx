import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { RequireAuth } from "@/components/AppShell";
import { money } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/requisitions/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New requisition — Purchase Requisitions" },
      { name: "description", content: "Create a purchase requisition with line items." },
      { property: "og:title", content: "New requisition — Purchase Requisitions" },
      { property: "og:description", content: "Create a purchase requisition with line items." },
    ],
  }),
  component: () => (
    <RequireAuth requesterOnly>
      <NewRequisition />
    </RequireAuth>
  ),
});

type Draft = { description: string; ordered_quantity: number; unit_price: number };

function NewRequisition() {
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    title: "",
    vendor_name: "",
    department: "",
    needed_by: "",
  });
  const [lines, setLines] = useState<Draft[]>([]);
  const [line, setLine] = useState<Draft>({ description: "", ordered_quantity: 1, unit_price: 0 });
  const [busy, setBusy] = useState(false);

  const canSubmit =
    fields.title.trim() !== "" &&
    fields.vendor_name.trim() !== "" &&
    fields.department.trim() !== "" &&
    fields.needed_by !== "" &&
    lines.length > 0 &&
    !busy;

  function addLine() {
    if (!line.description.trim() || line.ordered_quantity <= 0) {
      toast.error("Line items need a description and a quantity above zero.");
      return;
    }
    setLines((prev) => [...prev, line]);
    setLine({ description: "", ordered_quantity: 1, unit_price: 0 });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await api.createRequisition(fields);
      for (const l of lines) await api.addLineItem(created.id, l);
      toast.success("Requisition created as a draft.");
      navigate({ to: "/requisitions/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const total = lines.reduce((sum, l) => sum + l.ordered_quantity * l.unit_price, 0);

  return (
    <form className="max-w-3xl space-y-6" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold tracking-tight">New requisition</h1>

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor">Vendor</Label>
          <Input
            id="vendor"
            value={fields.vendor_name}
            onChange={(e) => setFields({ ...fields, vendor_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            value={fields.department}
            onChange={(e) => setFields({ ...fields, department: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="needed_by">Needed by</Label>
          <Input
            id="needed_by"
            type="date"
            value={fields.needed_by}
            onChange={(e) => setFields({ ...fields, needed_by: e.target.value })}
            required
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Line items</h2>
        <ul className="mt-3 space-y-2">
          {lines.length === 0 && (
            <li className="text-sm text-muted-foreground">Add at least one line item.</li>
          )}
          {lines.map((l, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
              <span className="flex-1">{l.description}</span>
              <span className="text-muted-foreground">
                {l.ordered_quantity} × {money(l.unit_price)}
              </span>
              <span className="w-24 text-right font-medium">
                {money(l.ordered_quantity * l.unit_price)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="li-desc">Description</Label>
            <Input
              id="li-desc"
              value={line.description}
              onChange={(e) => setLine({ ...line, description: e.target.value })}
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="li-qty">Qty</Label>
            <Input
              id="li-qty"
              type="number"
              min={1}
              value={line.ordered_quantity}
              onChange={(e) => setLine({ ...line, ordered_quantity: Number(e.target.value) })}
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="li-price">Unit price</Label>
            <Input
              id="li-price"
              type="number"
              min={0}
              step="0.01"
              value={line.unit_price}
              onChange={(e) => setLine({ ...line, unit_price: Number(e.target.value) })}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addLine}>
            Add line
          </Button>
        </div>

        <p className="mt-4 text-right text-sm font-medium">Total {money(total)}</p>
      </section>

      <Button type="submit" disabled={!canSubmit}>
        {busy ? "Creating…" : "Create requisition"}
      </Button>
    </form>
  );
}
