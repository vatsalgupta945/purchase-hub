# Submission

## Links

- **GitHub repository:** https://github.com/vatsalgupta945/test1.git
- **Live application (Frontend):** https://test1-24zk.vercel.app/
- **Backend API (Render):** https://test1-3-4zmi.onrender.com (Health check: https://test1-3-4zmi.onrender.com/health)

## Notes for the reviewer
 take 45–60 seconds to wake up the service. Once awake, all requests respond instantly.

> **Note on Free Tier Sleep**: The backend is hosted on Render's free tier, which automatically spins down after 15 minutes of inactivity. The very first request after an idle period may
The backend is built with Express + TypeScript + PostgreSQL. It enforces all 10 core business rules, role isolation, server-side totals, immutable timeline entries, alert dismissal snapshots, and per-item bulk approval reporting.

## Demo credentials

| Role | Email | Password | Approval Limit |
|------|-------|----------|----------------|
| Requester | `requester@example.com` | `password123` | N/A |
| Requester 2 | `requester2@example.com` | `password123` | N/A |
| Approver (Low Limit) | `approver1@example.com` | `password123` | $1,000.00 |
| Approver (High Limit) | `approver2@example.com` | `password123` | $50,000.00 |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React (Vite + TailwindCSS) | High performance, responsive UI with clear role separation. |
| Backend | Node.js + TypeScript + Express | Strong type safety, clean single-responsibility module design. |
| Database | PostgreSQL (Supabase) | Transactional integrity, exact decimal math, DB-level CHECK constraints. |
| Hosting | Render / Supabase | Free tier cloud deployment for API and managed database. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Server-enforced requester vs approver roles and approval limits. |
| 2 | Requisitions | Done | Requisition CRUD, draft editing, owner scoping, archiving/restoring. |
| 3 | Line items | Done | Line item CRUD pre-submit only, server-computed exact decimal totals. |
| 4 | Requisition lifecycle | Done | Strict state machine Draft → Submitted → Approved/Rejected → Ordered → Received. |
| 5 | Assigned approvers | Done | Flexible assigned approver junction table, queue view filtering. |
| 6 | Finding requisitions | Done | Server-side text search, filtering, sorting, and pagination. |
| 7 | Acting on many requisitions at once | Done | Per-requisition bulk approval report + Open Commitments CSV export. |
| 8 | Dashboard | Done | Headline counts, open commitments value, status/dept breakdown, 8-week trend. |
| 9 | History you cannot rewrite | Done | Immutable single-writer timeline log for status changes, receipts, comments. |
| 10 | Overdue receipt alerts | Done | Overdue detection with per-approver dismissal snapshotting & reappearance. |

## How much time did you actually spend?
~12 hours total spent across planning, backend implementation, testing, and documentation.

## What would you do next, with another 12 hours?
Implement multi-level approval escalation workflows and department budget allocation tracking against quarterly spend caps.

## What are you least happy with in this codebase, and why?
Full-text search currently uses SQL `ILIKE` substring matching. With 100x data, this should be upgraded to PostgreSQL `tsvector` indexed full-text search.
