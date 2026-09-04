# AI Prompts & Workflow Log

This document records the exact prompts and workflow instructions used during the development of this project, including mistakes, revisions, and corrections.

---

## Prompt Group 1: Backend Architecture & Implementation Plan Prompt
**Goal**: Design the complete single-responsibility module structure, database schema DDL, REST API contracts, and server-side business rules.

**Prompt**:
> Build a Node.js + TypeScript + Express backend for a purchase requisition system. Database: Postgres hosted on Supabase. Auth: Supabase Auth (email/password)...
> MODULE STRUCTURE: config, db/migrations, middleware (auth, requireRole, errorHandler), errors (AppError subclasses), validation (zod), and modules for profiles, requisitions, lineItems, approvals, ordering, receiving, assignedApprovers, comments, timeline, alerts, dashboard, exports.

**Output Evaluation**:
- Produced a clean plan separating domain modules.
- **Initial Flaw**: The initial draft suggested storing a cached `total` column on `requisitions`.
- **Correction**: Updated to compute `total` dynamically in SQL queries as `COALESCE(SUM(ordered_quantity * unit_price), 0)::NUMERIC(12,2)` because line items are mutable pre-submission, preventing data drift between header and line items.

---

## Prompt Group 2: Overdue Alert Dismissal & Reappearance Logic
**Goal**: Implement overdue receipt alert detection and dismissal logic that respects needed-by date changes.

**Prompt**:
> Implement GET /alerts and POST /alerts/:requisitionId/dismiss for approvers. Requirement: If an approver dismisses an alert, but the needed-by date is later extended and then passes again before receiving is complete, the alert MUST reappear.

**Output Evaluation**:
- **Initial Flaw**: The first iteration attempted to add a simple boolean flag `is_dismissed` on the junction table.
- **Correction**: Replaced boolean flag with snapshotting `dismissed_needed_by` in table `alert_dismissals`. When checking active alerts, the query checks `ad.dismissed_needed_by = r.needed_by`. If the date is changed and passes again, the snapshot no longer matches, allowing the alert to reappear cleanly without manual status resets.

---

## Prompt Group 3: Test Suite Generation & Boundary Cases
**Goal**: Create Jest unit tests and Supertest integration tests covering business rules.

**Prompt**:
> Write Jest unit tests for approvals limit boundary (at-limit vs 1 cent over limit), receiving (partial vs completion vs over-receiving rejection), and Supertest integration tests for role-based access control.

**Output Evaluation**:
- Successfully generated unit test assertions covering limit checks (`1000.00` limit vs `1000.01` requisition total), rejection reason validation, line receipt completion, and role enforcement (401/403 HTTP status codes).

---

## Prompt Group 4: Multi-Tier Approver Hierarchy & Monthly Limit Budgeting
**Goal**: Implement company/departmental approver hierarchy with senior vs junior limits, monthly spending tracking, automatic monthly resets, and senior escalation workflows.

**Prompt**:
> in the application create multiple approvers ,and also create company or deparmental heiracy with senior limit greater than junior ,and if a junior isnt able to approve the request goes to senior ,heirachacy ,and also the limit should be monthly that if some amount he approves that amount should be deduted from the limit ,and the limit will be reset every month

**Output Evaluation**:
- **Design Decisions**:
  1. `profiles` schema updated with `reports_to_id`, `department`, `title`, and `monthly_approval_limit`.
  2. Multi-tier approver seeds: Junior Approver ($1k/mo), Senior Operations Director ($50k/mo), Executive VP of Procurement ($500k/mo).
  3. **Zero-Maintenance Monthly Reset**: Spent monthly amount is computed via SQL `DATE_TRUNC('month', h.created_at) = DATE_TRUNC('month', CURRENT_DATE)`, ensuring budget automatically resets to $0 on the 1st of every month without requiring brittle cron tasks.
  4. **Senior Escalation Flow**: Added endpoint `POST /api/requisitions/:id/escalate` and a 1-click UI action button for Junior Approvers to escalate requisitions exceeding their limit to their senior manager.

---

## Prompt Group 5: Rejection Reason Visibility & Requester Identity Display
**Goal**: Ensure rejected orders display explicit `Rejected` status, show approver's rejection reason, show the rejecting approver's name/title, show requester identity across the app, and allow requester revision and re-submission.

**Prompt**:
> in the requester side if his order is getting rejected ,show him his order status as rejected with a proper reason given by the approver ,and also show the approver who requested him the request ,show requester name ,and also edit the docs while making changes regarding all prompts i am using

**Output Evaluation**:
- **Refinement**:
  1. Requisition status transitions to `Rejected` when rejected by an approver.
  2. SQL queries for `listRequisitionsHandler` and `getRequisitionByIdHandler` updated to return `rejection_reason`, `rejected_by_email`, `rejected_by_title`, `owner_title`, `owner_department`, and `owner_email`.
  3. Requester side displays a highlighted Rejection Card with the exact reason and the rejecting approver's details.
  4. Enabled draft/rejected editing and a 1-click **"Re-submit for approval"** flow for requesters to revise and re-submit rejected orders.
  5. Added Requester identity column to all table views and detail panels.

---

## Prompt Group 6: Automatic Live Search & Debounced Filtering
**Goal**: Make search and filter inputs filter results automatically in real-time while typing, while retaining manual search buttons and clear filter actions.

**Prompt**:
> okay in searching ,in bar when i am writing any filter its not automatically giving me results ,make it automatic ,keep the search button but also make it automatic

**Output Evaluation**:
- **Implementation**:
  1. Added debounced `useEffect` hooks (250ms) for `searchInput` (Title / Vendor) and `deptInput` (Department).
  2. Maintained the manual "Search" button and `form onSubmit` to allow immediate Enter key or button-click submission.
  3. Added an explicit "Clear filters" action button when any search/filter query is active.

---

## Prompt Group 7: Partial & Case-Insensitive Search Across Requisitions and Departments
**Goal**: Ensure all search and department filter queries use partial matching and case-insensitivity (e.g. typing `EX` or `ex` matches `exyz` or `Operations`).

**Prompt**:
> but you have made it on full word matching i mean if partial is also matching show it ,like i want to search for department exyz,and i write ex then it should show exyz ,and also make it case insensitive ,like if i write EXYZ  or EX it should show exyz

**Output Evaluation**:
- **Implementation**:
  1. Updated SQL queries in `listRequisitionsHandler` to use `r.department ILIKE '%...%'` instead of exact equality `=`.
  2. Broadened search keyword filter across Title, Vendor Name, Department, Requester Email, and Requester Title with `ILIKE '%...%'`.
  3. Joined `profiles` table in `countSql` to ensure consistent total pagination counts.

---

## Prompt Group 8: Multi-Department Hierarchical Database Seeding
**Goal**: Populate database with a comprehensive organizational structure of requesters and approvers across 5 departments while maintaining hierarchical reporting chains and monthly spending caps.

**Prompt**:
> okay in the database add many entries for requesters and approvers while maintaining heirachy

**Output Evaluation**:
- **Implementation**:
  1. Seeded 18 profiles across 5 distinct departments:
     - **Executive / Finance**: CFO ($1,000,000/mo) and Executive VP of Procurement ($500,000/mo).
     - **Engineering**: VP of Engineering ($100,000/mo) -> Engineering Manager ($20,000/mo) -> Junior Approver ($1,000/mo) -> Senior Systems Engineer & QA Automation Lead (Requesters).
     - **Operations**: Senior Operations Director ($50,000/mo) -> Operations Floor Manager ($15,000/mo) -> Logistics Lead & Supply Chain Analyst (Requesters).
     - **Safety & Facilities**: Director of Safety & EHS ($35,000/mo) -> Site Safety Supervisor ($5,000/mo) -> Senior Maintenance Tech & Facilities Specialist (Requesters).
     - **IT & Cloud**: Director of IT Systems ($75,000/mo) -> Cloud Infrastructure Approver ($8,000/mo) -> Cloud DevOps Engineer (Requester).
  2. Seeded 11 requisitions across all departments in various lifecycle statuses (`Draft`, `Submitted`, `Approved`, `Rejected`, `Ordered`, `Received`) with line items and historical audit records.
  3. Added quick demo login buttons grouped by hierarchy and department on the sign-in page.

---

## Prompt Group 9: Archiving & Unarchiving (Restore) Workflow
**Goal**: Ensure archived requisitions can be retrieved, filtered, inspected, and unarchived (restored) back to active queues seamlessly.

**Prompt**:
> check for the archieved thing like if i am putting some requisition on archive ,how will i fetch it back from archive ,if i want to see archived requisitions

**Output Evaluation**:
- **Implementation**:
  1. **Backend List Query**: Added support to filter archived records when selecting status `Archived`.
  2. **Detail Page Actions**: Added `Restore` action button (`POST /api/requisitions/:id/restore`) and `Archive` button (`POST /api/requisitions/:id/archive`).

---

## Prompt Group 10: User-Scoped / Independent Per-User Archiving
**Goal**: Ensure archiving is personal and user-specific: when a requester archives a request, it only hides from their own workspace, while remaining active for approvers, and vice versa.

**Prompt (Audio)**:
> I mean when I am talking about archive, like for example if a requester has archived his request, then archive must happen at requester's side, not at approver's side. And for example if an approver has archived a requisition, then the approver should be able to see his archived requisition, not the requester who has requested it. Whoever archives the request or requisition should only see the archive list, not the other end person.

**Output Evaluation**:
- **Design Decisions & Architecture**:
  1. **New Junction Table**: Created `user_archived_requisitions (user_id, requisition_id, archived_at, PRIMARY KEY (user_id, requisition_id))` to decouple archiving from a global column to an independent per-user state.
  2. **Per-User Scoped Querying**:
     - `GET /api/requisitions`: Filters `NOT EXISTS (SELECT 1 FROM user_archived_requisitions WHERE user_id = current_user)` for active queues, and `EXISTS (...)` when viewing `Archived` status.
     - `GET /api/requisitions/:id`: Returns `is_archived: Boolean` specific to the authenticated user.
  3. **Multi-User Isolation Verified**:
     - When Requester archives an order, it is archived and hidden only from their view; Approver still sees it active in their approval queue.
     - When Approver archives an order, it is archived and hidden only from their queue; Requester still sees it active in their dashboard.

---

## Prompt Group 11: Production Deployment Configuration (Render + Vercel)
**Goal**: Configure, verify, and document full-stack production deployment of the Express backend to Render and TanStack Start frontend to Vercel with live URLs, environment variables, health checks, and cross-origin resource sharing (CORS).

**Prompt (Audio)**:
> Okay, now I have to deploy it. So how will I deploy it using Render and Vercel? I want to make this application now live running with a link. So tell me the procedure and also make the changes in the ai-prompts.md regarding all the prompts I am giving to you.

**Output Evaluation**:
- **Implementation & Verification**:
  1. **Backend Production Preparation**:
     - Verified build script `npm run build` (`tsc`) producing valid `dist/server.js`.
     - Added root `/` and `/health` endpoints in `app.ts` so Render's health monitoring returns HTTP 200 immediately.
     - Confirmed dynamic PORT binding (`process.env.PORT || 5000`) and CORS compatibility.
  3. **Deployment Documentation & Runbook**:
     - Step-by-step instructions for Render web service setup (GitHub repo `purchase-hub`).
     - Step-by-step instructions for Vercel project setup (GitHub repo `approve-flow-61`).
     - Clear environment variable mapping for live connectivity.

---

## Prompt Group 12: Monorepo Consolidation & Unified Repository
**Goal**: Consolidate frontend and backend codebases into a single unified GitHub repository for unified tracking and deployment.

**Prompt**:
> push frontend and backend in a single repository ,there are two different repo for frontend and backend

**Output Evaluation**:
- **Implementation & Structure**:
  1. Consolidated root workspace into a structured monorepo containing `assignment-backend/` and `frontend/approve-flow-61/`.
  2. Initialized top-level Git repository configured with `.gitignore` covering `node_modules`, build artifacts (`dist`, `.output`), and temporary logs.
  3. Linked root repository to `https://github.com/vatsalgupta945/purchase-hub.git`.
---

## Prompt Group 13: Render Monorepo ENOENT Build Error Fix
**Goal**: Resolve missing `package.json` build failure during initial deployment on Render.

**Prompt**:
> npm error code ENOENT
> npm error syscall open
> npm error path /opt/render/project/src/package.json
> npm error errno -2
> npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/opt/render/project/src/package.json'
> npm error enoent This is related to npm not being able to find a file.

**Output Evaluation**:
- **Diagnosis**: Render by default executes build commands from the root of the repository (`/opt/render/project/src/`), but the project is structured as a monorepo with `assignment-backend/` and `frontend/approve-flow-61/`.
- **Solution**: Instructed the user to set the **Root Directory** field in Render's Service Settings to `assignment-backend` and configured the build/start commands accordingly.

---

## Prompt Group 14: Dual-Platform Hosting Strategy (Render + Vercel)
**Goal**: Provide exact, comprehensive deployment instructions tailored for Express backend on Render and TanStack Start / Vite frontend on Vercel.

**Prompt**:
> i am deploying this backend in render and frontend in vercel

**Output Evaluation**:
- **Implementation**:
  1. Provided a complete step-by-step runbook for Render Web Service (Root Directory: `assignment-backend`, Build: `npm install && npm run migrate && npm run seed && npm run build`, Start: `npm start`).
  2. Provided step-by-step setup for Vercel (Root Directory: `frontend/approve-flow-61`, Build: `npm run build`, Output: `.output/public` or `dist`).
  3. Mapped all required environment variables (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

---

## Prompt Group 15: Frontend "Failed to Fetch" & Network Diagnostics
**Goal**: Diagnose and fix network fetch failures occurring when loading data on the live Vercel application.

**Prompt**:
> on the live application it is showing failed to fetch
> the frontend is showing but data not showing llike for records saying failed to fetch

**Output Evaluation**:
- **Diagnosis**:
  1. In Vite applications, `import.meta.env` values are baked into static JavaScript bundles at compile time. Adding `VITE_API_BASE_URL` in Vercel after initial build required a manual **Redeploy**.
  2. If `VITE_API_BASE_URL` had a trailing slash (e.g. `...com/`) or `/api`, it produced malformed URLs like `//api` or `/api/api`.
- **Solution**:
  1. Updated `frontend/approve-flow-61/src/lib/api.ts` to sanitize `VITE_API_BASE_URL`, automatically stripping trailing slashes and ensuring clean `/api` prefixing.
  2. Provided DevTools (F12 Network tab) diagnostic checklist for inspecting request URLs, mixed content warnings, and HTTP status codes.

---

## Prompt Group 16: CORS Preflight & Infrastructure 404 Resolution
**Goal**: Eliminate browser CORS preflight blocking errors when Vercel frontend communicates with Render backend.

**Prompt**:
> Access to fetch at 'https://test1-3-4zmi.onrender.com/api/me' from origin 'https://test1-nine-delta-36.vercel.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.

**Output Evaluation**:
- **Diagnosis**:
  1. Render was returning HTTP 404 for the entire domain because the service was created as a "Static Site" rather than a "Web Service", or the previous build had failed.
  2. When hosting infrastructure returns a 404/502 error page, it omits CORS headers, triggering browser preflight blocks.
- **Solution**:
  1. Upgraded `assignment-backend/src/app.ts` with explicit origin reflection (`origin: true`), allowed headers (`Authorization`, `Content-Type`), credentials, and preflight wildcard handler `app.options('*', cors())`.
  2. Guided user through creating a proper Web Service on Render with database migration & seeding scripts.

---

## Prompt Group 17: Localhost Dual-Server Environment Execution
**Goal**: Launch both the Express backend and React frontend concurrently on localhost for local testing.

**Prompt**:
> run app local host

**Output Evaluation**:
- **Implementation**:
  1. Started backend development daemon (`npm run dev`) on `http://localhost:5000`.
  2. Started frontend development daemon (`npm run dev`) on `http://localhost:8080`.
  3. Verified health check endpoint (`/health`) and supplied quick-login demo credentials.

---

## Prompt Group 18: TypeScript TS5108 Deprecated moduleResolution Removal
**Goal**: Resolve TypeScript compiler build failure on Render caused by newer TypeScript versions deprecating `node10`.

**Prompt**:
> tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
> this error is coming in render deployment

**Output Evaluation**:
- **Diagnosis**: Newer TypeScript releases deprecated and removed `moduleResolution=node` (alias for `node10`).
- **Solution**: Removed `"moduleResolution": "node"` from `assignment-backend/tsconfig.json` because `"module": "commonjs"` automatically defaults to standard CommonJS resolution. Verified clean compilation with `tsc` and committed fix (`ff5baf3`).

---

## Prompt Group 19: Missing TypeScript Types in Production Builds (TS7016 / TS2591)
**Goal**: Resolve missing type definitions during production cloud builds on Render.

**Prompt**:
> src/app.ts(1,21): error TS7016: Could not find a declaration file for module 'express'...
> src/config/index.ts(6,18): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?...
> ==> Build failed 😞

**Output Evaluation**:
- **Diagnosis**: Setting `NODE_ENV=production` causes `npm install` to skip `devDependencies`. Because `@types/node`, `@types/express`, `@types/cors`, and `typescript` were in `devDependencies`, `tsc` failed to find type declarations.
- **Solution**: Moved all `@types/*` packages, `ts-node`, and `typescript` into `dependencies` in `assignment-backend/package.json` so cloud production builds always install them. Verified build locally and pushed commit `30c5012`.

---

## Prompt Group 20: Comprehensive Architecture, Implementation & Prompt Documentation
**Goal**: Document the complete system architecture, technical choices, challenge resolutions, and full prompt history in the project documentation.

**Prompt**:
> okay the project is running give me the implementation plan of how this project got implemented ,various challenges you and i faced ,and architecture ,tech stack that was used ,and why
> OKAY and also document whatever prompts i have used with you in ai prompts ,till deployement process and live site ,include all prompts even of previous sessions

**Output Evaluation**:
- **Implementation**:
  1. Compiled exhaustive architecture and implementation summary covering decoupled frontend/backend design, PostgreSQL transactional guarantees, and tech stack rationale.
  2. Updated `assignment-backend/docs/ai-prompts.md` with complete chronological records of all 20 prompt groups across planning, business logic, hierarchical approvals, user-scoped archiving, live cloud deployment, and compiler debugging.
