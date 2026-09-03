# System Architecture

## Overview
The Procurement & Purchase Requisition System is a multi-role web application designed to eliminate paper-based purchasing workflows. It automates approval thresholds, isolates requester vs. approver capabilities, tracks order lifecycles from Draft to Receipt, and maintains an immutable audit trail.

## Moving Pieces & Communication Path
1. **Frontend (Browser App)**: Built with React (Vite + TailwindCSS). Interacts with Supabase Auth for identity and sends Bearer JWT tokens on HTTP REST calls to the backend.
2. **Backend Server**: Node.js + TypeScript + Express.js API running on Render.
   - Enforces role-based permissions (`requester` vs `approver`).
   - Computes requisition totals server-side (`SUM(ordered_quantity * unit_price)`).
   - Manages status lifecycle transitions (Draft → Submitted → Approved/Rejected → Ordered → Received).
   - Writes immutable timeline events via a single dedicated history writer module.
3. **Database Layer**: Supabase Postgres managed instance.
   - Stores user profiles, requisitions, line items, assigned approvers, history entries, and alert dismissal snapshots.
   - Database level `CHECK` constraints prevent negative quantities or receiving beyond ordered amounts.
4. **Authentication**: Supabase Auth (Email/Password). Issued JWTs are verified by backend API middleware.

## Request Path (Representative Action: Submitting & Approving a Requisition)
1. **Submit Requisition**:
   - Requester clicks "Submit" in UI.
   - Frontend calls `POST /api/requisitions/:id/submit` with Bearer token.
   - Backend `authMiddleware` validates JWT and fetches profile. `requireRole('requester')` ensures requester status.
   - Server checks `status === 'Draft'`, verifies line items count >= 1, updates status to `Submitted`, and writes a `status_change` timeline entry in a single DB transaction.
2. **Approve Requisition**:
   - Approver calls `POST /api/requisitions/:id/approve`.
   - `authMiddleware` validates token. `requireRole('approver')` checks role.
   - Server computes line total, compares against `req.user.approval_limit`.
   - If total <= limit, updates status to `Approved` and appends `status_change` entry to `requisition_history`. If total > limit, returns HTTP 409 `LIMIT_EXCEEDED` while leaving the requisition in `Submitted` status.

## Decisions on What NOT to Build
- **No Self-Registration as Approver**: Self-registration via sign-up endpoint automatically defaults to `requester`. Approver roles and limits are seeded/provisioned directly in DB to prevent users from granting themselves unlimited approval authority.
- **No Client-Side Totals**: Requisition total amounts are never submitted or stored; they are always dynamically computed by SQL aggregation at query time.
- **No Requisition Total Caching**: Totals are calculated dynamically because line items are mutable pre-submission, preventing data drift between lines and requisition headers.
- **No Explicit Reassignment State**: When an approval fails due to limit exceeding, the requisition is not force-assigned; it remains in `Submitted` status so any higher approver can act on it from the main queue.
