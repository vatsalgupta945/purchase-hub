const styles: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-chart-2/15 text-chart-2",
  Approved: "bg-chart-1/15 text-chart-1",
  Rejected: "bg-destructive/15 text-destructive",
  Ordered: "bg-chart-4/20 text-chart-4",
  Received: "bg-chart-3/15 text-chart-3",
  Archived: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-secondary text-secondary-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function money(value: number | undefined | null) {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
