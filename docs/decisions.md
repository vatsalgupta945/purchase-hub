# Key Architectural Decisions & Design Trade-offs

Here are five key design decisions made during the development of this system, including options considered, chosen approaches, and rationales.

---

### Decision 1: Single Dedicated Writer Module for Immutable Audit Log
- **Choices Considered**:
  - *Option A*: Allow each HTTP route controller (`approvals`, `receiving`, `ordering`, `comments`) to insert directly into `requisition_history`.
  - *Option B (Chosen)*: Require all history entry creation to pass exclusively through a single dedicated module (`src/modules/timeline/index.ts`).
- **Rationale**: The specification mandates: *"Nothing in this timeline can be edited or deleted after the fact, including by approvers."* Centralizing write access in a single internal module ensures uniform history schemas, consistent event formatting, and guarantees that no application route ever issues `UPDATE` or `DELETE` commands against `requisition_history`.

---

### Decision 2: Dynamic SQL Total Calculation vs. Stored `total` Column (Reversed Initial Caching Idea)
- **Choices Considered**:
  - *Option A*: Maintain a `total` column on the `requisitions` table, updated via DB triggers or application code whenever line items are added/edited/deleted.
  - *Option B (Chosen)*: Compute requisition total on the fly using `COALESCE(SUM(ordered_quantity * unit_price), 0)::NUMERIC(12,2)` in SQL queries.
- **Rationale & Reversal**: Initially, storing a cached `total` on the header table seemed like a performance optimization. However, during schema design, we realized that line items can be added, edited, or removed while in `Draft` status. Caching risks synchronization bugs or floating-point rounding mismatches between the header and line items. Computing the total dynamically guarantees single-source-of-truth accuracy for all limit checks and dashboard metrics.

---

### Decision 3: Alert Dismissal Snapshotting (`dismissed_needed_by`) vs. Simple Boolean `is_dismissed` Flag
- **Choices Considered**:
  - *Option A*: Add a boolean `is_dismissed` column to `requisition_assigned_approvers`.
  - *Option B (Chosen)*: Create a dedicated `alert_dismissals` table storing `(requisition_id, approver_id, dismissed_needed_by)`.
- **Rationale**: Requirement 10 specifies: *"If the needed-by date later changes and then passes again before receiving is complete, the alert returns."* A simple boolean `is_dismissed` flag loses context when the needed-by date is extended and passes a second time. Snapshotting `dismissed_needed_by` allows the query engine to detect when `current_needed_by != dismissed_needed_by`, automatically un-dismissing the alert without requiring complex background cron jobs.

---

### Decision 4: Assignment as a Queue/Alert Filter vs. Strict Approval Permission Gate
- **Choices Considered**:
  - *Option A*: Only allow approvers assigned to a requisition to approve or reject it.
  - *Option B (Chosen)*: Allow any approver with sufficient approval limit to approve/reject any submitted requisition, while using assignment purely for queue filtering and alert dismissal scoping.
- **Rationale**: Requirement 5 states: *"Every approver can see the full queue of Submitted requisitions awaiting a decision, as well as a filtered list of just the requisitions assigned to them."* Requirement 1 & 4 also state that when an order exceeds one approver's limit, it escalates to higher approvers. Treating assignment as a filter rather than a strict permission gate prevents requisitions from getting stuck if an assigned approver is unavailable or lacks sufficient limit.

---

### Decision 5: Bulk Approval Per-Item Reporting vs. All-or-Nothing Transactional Rollback
- **Choices Considered**:
  - *Option A*: Wrap the entire bulk approval array in a single database transaction and abort the entire batch if any requisition fails approval limit or status checks.
  - *Option B (Chosen)*: Process each requisition individually in its own transaction, returning a per-requisition outcome report (`{ results: [{ id, status: "approved"|"refused", reason? }] }`).
- **Rationale**: Requirement 7 explicitly asks for a per-requisition report naming which succeeded and which exceeded the limit. An all-or-nothing rollback would mean a single large requisition over limit blocks all other valid requisitions in the batch from being approved.
