# Database Schema

## Table Descriptions & Types

### 1. `profiles`
- `id` (`UUID PRIMARY KEY`): Matches `auth.users.id` from Supabase Auth.
- `email` (`TEXT UNIQUE NOT NULL`): User email address.
- `role` (`TEXT NOT NULL`): `'requester'` or `'approver'`.
- `approval_limit` (`NUMERIC(12,2) NULL`): Max approval limit for approvers; NULL for requesters.
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`): Timestamp.

### 2. `requisitions`
- `id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`): Unique ID.
- `owner_id` (`UUID NOT NULL REFERENCES profiles(id)`): Requisition owner.
- `title` (`TEXT NOT NULL`): Descriptive title.
- `vendor_name` (`TEXT NOT NULL`): Target vendor name.
- `department` (`TEXT NOT NULL`): Requesting department.
- `needed_by` (`DATE NOT NULL`): Target delivery date.
- `status` (`TEXT NOT NULL DEFAULT 'Draft'`): `'Draft'`, `'Submitted'`, `'Approved'`, `'Rejected'`, `'Ordered'`, `'Received'`.
- `archived_at` (`TIMESTAMPTZ NULL`): Nullable timestamp for soft archiving.
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`), `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).

### 3. `line_items`
- `id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`): Unique ID.
- `requisition_id` (`UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE`): FK to requisition.
- `description` (`TEXT NOT NULL`): Item description.
- `ordered_quantity` (`INTEGER NOT NULL CHECK (ordered_quantity > 0)`): Units ordered.
- `unit_price` (`NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)`): Price per unit.
- `received_quantity` (`INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity)`): Units received so far.

### 4. `requisition_assigned_approvers`
- `requisition_id` (`UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE`)
- `approver_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`)
- `assigned_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
- `PRIMARY KEY (requisition_id, approver_id)`: Junction table for assigned approvers.

### 5. `requisition_history` (Immutable Audit Log)
- `id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- `requisition_id` (`UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE`)
- `event_type` (`TEXT NOT NULL`): `'created'`, `'status_change'`, `'receipt'`, `'comment'`
- `actor_id` (`UUID NOT NULL REFERENCES profiles(id)`)
- `old_status` (`TEXT NULL`), `new_status` (`TEXT NULL`), `reason` (`TEXT NULL`), `details` (`JSONB NULL`)
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)

### 6. `alert_dismissals`
- `requisition_id` (`UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE`)
- `approver_id` (`UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`)
- `dismissed_needed_by` (`DATE NOT NULL`): Snapshot of needed_by date at dismissal time.
- `dismissed_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
- `PRIMARY KEY (requisition_id, approver_id)`

---

## Relationships
- **One-to-Many**:
  - `profiles` → `requisitions` (One requester owns many requisitions)
  - `requisitions` → `line_items` (One requisition contains many line items)
  - `requisitions` → `requisition_history` (One requisition has many history timeline entries)
- **Many-to-Many**:
  - `requisitions` ↔ `profiles` (approvers) via `requisition_assigned_approvers`

---

## DB Constraints vs. Application Enforcement
- **Database Constraints**:
  - `CHECK (ordered_quantity > 0)` and `CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity)` strictly guarantee no negative quantities or over-receiving at the storage engine level.
  - `CHECK` on status enum values and role values.
  - `FOREIGN KEY ON DELETE CASCADE` on line items and history to clean up dependent records on delete.
- **Application Code Enforcement**:
  - Approval limit checking (`total <= approval_limit`) is performed in Node.js application transactions.
  - State machine transition restrictions (e.g. Draft -> Submitted, Submitted -> Approved/Rejected).
  - Role-based authorization rules.

---

## Deliberate Denormalizations
- `requisitions.total` is **not stored**. It is calculated as `SUM(ordered_quantity * unit_price)` on the fly.
- `alert_dismissals` snapshots `dismissed_needed_by` date so that if `needed_by` changes on an overdue order, the dismissal snapshot invalidates automatically and the alert reappears.

---

## What Breaks First at 100x Data?
- **Requisition List & Search Query**: `GET /api/requisitions` with full-text search over title/vendor name and multiple filter joins degenerates without composite indexes. We created composite index `idx_requisitions_status_dept_owner (status, department, owner_id)` and date index `idx_requisitions_needed_by`. At 100x scale, PostgreSQL trigram (`pg_trgm`) or `tsvector` full-text search index will be needed.
- **Dashboard Weekly Aggregations**: Charting received requisitions over 8 weeks scans `requisition_history`. Composite index `idx_history_event_created (event_type, created_at)` keeps this performant.
