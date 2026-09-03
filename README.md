# Purchase Requisition System (Full-Stack Monorepo)

An enterprise-grade, multi-tier procurement and purchase requisition management platform built with a high-performance Express + TypeScript backend, PostgreSQL database with transactional integrity and strict role-based controls, and a modern React + Vite + TailwindCSS frontend.

---

## 📁 Repository Structure

```
assignment/
├── assignment-backend/               # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/                  # Server & Supabase config
│   │   ├── db/                      # Schema, migrations & seed scripts
│   │   ├── errors/                  # Custom AppError subclasses
│   │   ├── middleware/              # Auth, requireRole, errorHandler
│   │   ├── modules/                 # Single-responsibility domain modules
│   │   │   ├── alerts/              # Overdue alert dismissal & reappearance
│   │   │   ├── approvals/           # Hierarchy & spending limits logic
│   │   │   ├── assignedApprovers/   # Approver assignment junction
│   │   │   ├── comments/            # Requisition comments
│   │   │   ├── dashboard/           # Metrics, budget breakdown & trends
│   │   │   ├── exports/             # Open commitments CSV export
│   │   │   ├── lineItems/           # Item CRUD & server totals
│   │   │   ├── ordering/            # Order placement & date extensions
│   │   │   ├── profiles/            # User profiles & hierarchy tree
│   │   │   ├── receiving/           # Partial & over-receiving controls
│   │   │   ├── requisitions/        # Requisition lifecycle & user archives
│   │   │   └── timeline/            # Immutable audit event log
│   │   ├── routes/                  # Express API route declarations
│   │   ├── types/                   # TypeScript interfaces & types
│   │   ├── app.ts                   # Express application setup
│   │   └── server.ts                # Server entry point
│   ├── docs/
│   │   ├── ai-prompts.md            # AI prompts, evaluation & revision history
│   │   └── technical-assumptions.md # Architecture & system assumptions
│   ├── tests/                       # Unit & integration test suites
│   ├── SUBMISSION.md                # Reviewer submission notes & credentials
│   └── package.json
│
└── frontend/
    └── approve-flow-61/             # React + Vite + TailwindCSS Frontend
        ├── src/
        │   ├── components/          # Reusable UI & Layout components
        │   ├── hooks/               # Custom React hooks
        │   ├── lib/                 # API client, Supabase & Auth provider
        │   └── routes/              # TanStack router page views
        ├── public/                  # Static assets
        ├── vite.config.ts           # Vite configuration
        └── package.json
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup:
```bash
cd assignment-backend
npm install
npm run migrate
npm run seed
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2. Frontend Setup:
```bash
cd frontend/approve-flow-61
npm install
npm run dev
```
Frontend runs on `http://localhost:8080` (or `http://localhost:5173`).

---

## 🧪 Testing

Run backend test suite:
```bash
cd assignment-backend
npm test
```

---

## ☁️ Deployment Guide

- **Backend (Render)**:
  - Repository: This repository
  - Root Directory: `assignment-backend`
  - Build Command: `npm install && npm run build`
  - Start Command: `npm start`
- **Frontend (Vercel)**:
  - Repository: This repository
  - Root Directory: `frontend/approve-flow-61`
  - Build Command: `npm run build`
  - Output Directory: `.output/public` or `dist`
