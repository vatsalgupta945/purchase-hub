import { supabase } from "./supabase";

const rawBase = ((import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? "").trim().replace(/\/+$/, "");
const BASE = rawBase ? (rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`) : "/api";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {}

  if (!token && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("mock_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed.access_token;
      }
    } catch {}
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, unknown> } = {},
): Promise<T> {
  const res = await rawFetch(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function rawFetch(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, unknown> } = {},
): Promise<Response> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(await authHeader()),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.clone().json()) as { error?: { code?: string; message?: string } };
      if (payload?.error?.message) message = payload.error.message;
      if (payload?.error?.code) code = payload.error.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, code, res.status);
  }
  return res;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

/* ---------------- Types ---------------- */

export type Role = "requester" | "approver";

export type Me = {
  id: string;
  email: string;
  role: Role;
  approval_limit: number | null;
  monthly_approval_limit?: number | null;
  used_this_month?: number;
  remaining_monthly_limit?: number | null;
  reports_to_id?: string | null;
  reports_to_email?: string | null;
  department?: string | null;
  title?: string | null;
  [k: string]: unknown;
};

export type HierarchyUser = {
  id: string;
  email: string;
  role: Role;
  title?: string;
  department?: string;
  approval_limit: number | null;
  used_this_month: number;
  remaining_monthly_limit: number | null;
  reports_to_id?: string | null;
  reports_to_email?: string | null;
  reports_to_title?: string | null;
};

export type LineItem = {
  id: string;
  requisition_id: string;
  description: string;
  ordered_quantity: number;
  unit_price: number;
  received_quantity?: number;
};

export type Requisition = {
  id: string;
  title: string;
  vendor_name: string;
  department: string;
  needed_by: string;
  status: string;
  owner_id: string;
  owner_email?: string;
  owner_title?: string;
  owner_department?: string;
  rejection_reason?: string;
  rejected_by_email?: string;
  rejected_by_title?: string;
  total?: number;
  is_overdue?: boolean;
  is_archived?: boolean;
  archived_at?: string | null;
  created_at?: string;
};

export type RequisitionDetail = Requisition & {
  line_items: LineItem[];
  total: number;
  is_overdue: boolean;
};

export type Paginated<T> = { data: T[]; total: number; page: number; page_size: number };

export type TimelineEntry = {
  id: string;
  requisition_id: string;
  event_type?: string;
  action?: string;
  body?: string;
  actor_email?: string;
  actor_id?: string;
  created_at: string;
  [k: string]: unknown;
};

export type Approver = { approver_id: string; email: string; assigned_at: string };

export type DashboardData = {
  awaiting_approval: number;
  open_commitments_value: number;
  overdue_count: number;
  received_last_7_days: number;
  by_status: Record<string, number> | { status: string; count: number }[];
  by_department: Record<string, number> | { department: string; count: number }[];
  received_per_week: { week: string; count: number }[];
};

/* ---------------- Endpoints ---------------- */

export const api = {
  me: () => apiFetch<Me>("/me"),
  hierarchy: () => apiFetch<{ data: HierarchyUser[] }>("/approvers/hierarchy"),
  createProfile: () => apiFetch<unknown>("/profiles", { method: "POST", body: {} }),
  dashboard: () => apiFetch<DashboardData>("/dashboard"),
  alerts: () => apiFetch<{ data: unknown[]; count: number }>("/alerts"),
  dismissAlert: (id: string) => apiFetch(`/alerts/${id}/dismiss`, { method: "POST" }),

  listRequisitions: (query: Record<string, unknown>) =>
    apiFetch<Paginated<Requisition>>("/requisitions", { query }),
  getRequisition: (id: string) => apiFetch<RequisitionDetail>(`/requisitions/${id}`),
  createRequisition: (body: {
    title: string;
    vendor_name: string;
    department: string;
    needed_by: string;
  }) => apiFetch<Requisition>("/requisitions", { method: "POST", body }),
  updateRequisition: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/requisitions/${id}`, { method: "PATCH", body }),
  updateNeededBy: (id: string, needed_by: string) =>
    apiFetch(`/requisitions/${id}/needed-by`, { method: "PATCH", body: { needed_by } }),
  submit: (id: string) => apiFetch(`/requisitions/${id}/submit`, { method: "POST" }),
  archive: (id: string) => apiFetch(`/requisitions/${id}/archive`, { method: "POST" }),
  restore: (id: string) => apiFetch(`/requisitions/${id}/restore`, { method: "POST" }),
  approve: (id: string) => apiFetch(`/requisitions/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) =>
    apiFetch(`/requisitions/${id}/reject`, { method: "POST", body: { reason } }),
  escalate: (id: string) =>
    apiFetch<{ escalated: boolean; escalated_to_email: string }>(`/requisitions/${id}/escalate`, { method: "POST" }),
  order: (id: string) => apiFetch(`/requisitions/${id}/order`, { method: "POST" }),
  receipts: (id: string, receipts: { line_item_id: string; quantity_received: number }[]) =>
    apiFetch(`/requisitions/${id}/receipts`, { method: "POST", body: { receipts } }),
  bulkApprove: (requisition_ids: string[]) =>
    apiFetch<{ results: { id: string; status: string; reason?: string }[] }>(
      "/requisitions/bulk-approve",
      { method: "POST", body: { requisition_ids } },
    ),
  exportOpenCommitments: () => rawFetch("/requisitions/export/open-commitments"),

  addLineItem: (id: string, body: { description: string; ordered_quantity: number; unit_price: number }) =>
    apiFetch<LineItem>(`/requisitions/${id}/line-items`, { method: "POST", body }),
  updateLineItem: (id: string, lineId: string, body: Record<string, unknown>) =>
    apiFetch(`/requisitions/${id}/line-items/${lineId}`, { method: "PATCH", body }),
  deleteLineItem: (id: string, lineId: string) =>
    apiFetch(`/requisitions/${id}/line-items/${lineId}`, { method: "DELETE" }),

  approvers: (id: string) => apiFetch<Approver[]>(`/requisitions/${id}/approvers`),
  addApprover: (id: string, approver_id: string) =>
    apiFetch(`/requisitions/${id}/approvers`, { method: "POST", body: { approver_id } }),
  removeApprover: (id: string, approverId: string) =>
    apiFetch(`/requisitions/${id}/approvers/${approverId}`, { method: "DELETE" }),

  timeline: (id: string) => apiFetch<TimelineEntry[]>(`/requisitions/${id}/timeline`),
  comment: (id: string, body: string) =>
    apiFetch(`/requisitions/${id}/comments`, { method: "POST", body: { body } }),
};
