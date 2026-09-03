# Purchase Flow

```
Build a React (Vite + Tailwind) frontend for a purchase-requisition system. Two
roles: "requester" and "approver" — after login, route each role to a
different default view and hide actions the role isn't allowed to take (the
backend also enforces this, but the UI shouldn't offer buttons that will 403).

AUTH: use @supabase/supabase-js against these env vars: VITE_SUPABASE_URL,
VITE_SUPABASE_ANON_KEY. Sign-up/login via Supabase Auth email+password. After a
successful sign-up, call POST {VITE_API_BASE_URL}/profiles once to create the
backend-side profile row (new sign-ups are always role "requester"; approver
accounts are seeded separately and just log in). Attach the Supabase session's
access token as "Authorization: Bearer <token>" on every call to
VITE_API_BASE_URL.

PAGES:
1. Login / Signup — plain email+password forms via Supabase Auth.
2. Dashboard (landing page after login) — calls GET /dashboard and shows:
   headline numbers (awaiting_approval, open_commitments_value, overdue_count,
   received_last_7_days), a breakdown by status, a breakdown by department, and
   a bar/line chart of received_per_week (8 weeks). Show an alerts badge in the
   nav using GET /alerts's "count" (approvers only).
3. Requisitions list — searchable/filterable/sortable/paginated table backed
   entirely by GET /requisitions query params: search, status, department,
   owner_id, overdue, assigned_to_me, sort_by, sort_dir, page, page_size. Do
   not filter client-side — always re-query the server when a filter changes.
   Requesters only ever see their own; approvers can toggle between "full
   queue" (status=Submitted) and "assigned to me" (assigned_to_me=true).
4. Requisition detail page — shows the requisition, its line items (editable
   only while status is Draft and the viewer is the owner), computed total,
   is_overdue flag, the assigned-approvers panel, the append-only timeline
   (GET /requisitions/:id/timeline), and a comment box (POST
   /requisitions/:id/comments — comments cannot be edited/deleted, don't build
   UI for that). Show role- and status-appropriate action buttons:
   - Owner + Draft: edit fields/lines, Submit, Archive.
   - Approver + Submitted: Approve, Reject (reason required, non-empty).
   - Approver + Approved: Mark Ordered.
   - Approver + Ordered: Record Receipt (per line, capped at remaining
     quantity in the UI, but always let the server be the final word), Extend
     Needed-By Date.
   - Any + any status: Archive / Restore.
5. New Requisition form (requester only) — title, vendor_name, department,
   needed_by, then an inline line-item editor (description, ordered_quantity,
   unit_price) before Submit is enabled. Disable Submit until at least one
   line item exists.
6. Approval queue page (approver only) — the Submitted list with row checkboxes
   and a "Bulk Approve" button calling POST /requisitions/bulk-approve; after
   the call, show a per-row result (approved vs refused-with-reason) from the
   response — do not assume a batch either fully succeeds or fully fails.
7. Export button on the requisitions list (approver only) — hits GET
   /requisitions/export/open-commitments and downloads the returned CSV.

API BASE: {VITE_API_BASE_URL}/api. All endpoints require the bearer token
except signup/login (handled by Supabase directly). Full contract:

  GET  /me
  POST /profiles                                    body: {}
  POST /requisitions                                 body: {title, vendor_name, department, needed_by}
  GET  /requisitions?search=&status=&department=&owner_id=&overdue=&assigned_to_me=&sort_by=&sort_dir=&page=&page_size=
                                                      -> {data:[...], total, page, page_size}
  GET  /requisitions/:id                             -> requisition + line_items + total + is_overdue
  PATCH /requisitions/:id                            body: any of {title, vendor_name, department, needed_by} (owner, Draft only)
  PATCH /requisitions/:id/needed-by                  body: {needed_by} (approver, Ordered only)
  POST /requisitions/:id/submit
  POST /requisitions/:id/archive
  POST /requisitions/:id/restore
  POST /requisitions/:id/approve                     -> 200 or 409 {error:{code:"LIMIT_EXCEEDED"}}
  POST /requisitions/:id/reject                      body: {reason}
  POST /requisitions/:id/order
  POST /requisitions/:id/receipts                    body: {receipts:[{line_item_id, quantity_received}]}
  POST /requisitions/bulk-approve                    body: {requisition_ids:[...]} -> {results:[{id,status,reason?}]}
  GET  /requisitions/export/open-commitments         -> CSV file
  POST /requisitions/:id/line-items                  body: {description, ordered_quantity, unit_price}
  PATCH /requisitions/:id/line-items/:lineId
  DELETE /requisitions/:id/line-items/:lineId
  GET  /requisitions/:id/approvers                   -> [{approver_id, email, assigned_at}]
  POST /requisitions/:id/approvers                   body: {approver_id}
  DELETE /requisitions/:id/approvers/:approverId
  GET  /requisitions/:id/timeline                    -> ordered history rows
  POST /requisitions/:id/comments                    body: {body}
  GET  /alerts                                       -> {data:[...], count}
  POST /alerts/:requisitionId/dismiss
  GET  /dashboard                                    -> {awaiting_approval, open_commitments_value,
                                                          overdue_count, received_last_7_days,
                                                          by_status, by_department, received_per_week}

Every error response is {error:{code, message}}; surface `message` to the user
in a toast/inline alert rather than a generic "something went wrong."

Keep it fast and minimal: no extra state-management library (React context is
enough for auth + role), no UI kit beyond Tailwind + whatever Lovable already
ships, and use `recharts` (or an equivalent already available) only for the
dashboard charts.
```

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/567a9f5e-3ed5-4926-9a60-35bcdad3b241).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
