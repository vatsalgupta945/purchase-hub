# Procurement & Purchase Requisitions System — Backend

A robust, production-grade Node.js + TypeScript + Express backend application for managing purchase requisitions, approval limits, order lifecycles, and receipt tracking.

## Key Features & Business Rules
1. **Accounts & Roles**: Server-enforced `requester` and `approver` roles with approval limits (`numeric(12,2)`).
2. **Requisition Lifecycle**: Strict state machine (`Draft` → `Submitted` → `Approved` | `Rejected` → `Ordered` → `Received`).
3. **Server-Computed Totals**: Requisition total amounts are calculated dynamically in SQL as `SUM(ordered_quantity * unit_price)`.
4. **Approval Thresholds & Escalation**: Approvers can only approve requisitions within their approval limit. Exceeding limits returns HTTP 409 `LIMIT_EXCEEDED` while preserving `Submitted` status.
5. **Bulk Approvals**: Approvers can bulk approve multiple requisitions with per-requisition status reporting.
6. **Overdue Alerts & Smart Dismissal**: Overdue orders trigger alerts. Approver dismissals snapshot the `needed_by` date; if the date changes and passes again, the alert automatically reappears.
7. **Immutable Audit Timeline**: Single-writer timeline module guarantees history entries (`created`, `status_change`, `receipt`, `comment`) can never be edited or deleted.
8. **Server-Side Search & Pagination**: Full server-side search over title/vendor, status/department filters, sorting, and pagination.
9. **Open Commitments Export**: Export open commitments (`Ordered` requisitions) to CSV.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL database (or Supabase Postgres instance)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` (refer to `.env.example`):
   ```env
   PORT=5000
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_JWT_SECRET=your-supabase-jwt-secret
   ```

3. Run database migrations:
   ```bash
   npm run migrate
   ```

4. Seed demo data (optional):
   ```bash
   npm run seed
   ```

5. Start dev server:
   ```bash
   npm run dev
   ```

6. Run test suite:
   ```bash
   npm test
   ```

---

## System Documentation
- [`docs/architecture.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/docs/architecture.md): Moving pieces, request flows, and architectural trade-offs.
- [`docs/schema.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/docs/schema.md): Database tables, relationships, constraints, and scaling considerations.
- [`docs/plan.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/docs/plan.md): Engineering session breakdown, estimates vs actuals.
- [`docs/decisions.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/docs/decisions.md): Architectural decisions and reversals.
- [`docs/ai-prompts.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/docs/ai-prompts.md): Log of AI prompts and revisions.
- [`SUBMISSION.md`](file:///c:/Users/vatsal%20gupta/Desktop/takehome-20-procurement-requisitions/takehome-20-procurement-requisitions/SUBMISSION.md): Submission checklist, demo credentials, and assessment notes.
