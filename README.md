# InvoiceFlow — Professional Invoice Automation Platform

InvoiceFlow is a multi-tenant SaaS invoicing, payment ledger, email notification, automated reminder, and financial analytics platform built with **React + Tailwind CSS**, **Node.js + Express**, and **MySQL / MariaDB (InnoDB)**.

---

## Key Capabilities
- **Multi-Tenant Accounts & Business Profiles**: JWT authentication, `bcrypt` password hashing, business branding defaults (tax rate, currency symbol, invoice prefix), and PNG/JPEG magic-byte validated logo uploads.
- **Customer Directory & Detail Profiles**: Full CRUD, search/filter, outstanding receivable tracking, and customer-scoped invoice history.
- **Exact-Arithmetic Invoicing & Sequential Numbering**: Integer minor-unit (cents/paisa) calculations in `backend/src/utils/money.js` plus atomic `SELECT ... FOR UPDATE` sequential `INV-0001` numbering.
- **PDF Invoice Downloads & Print View**: Server-generated branded PDFs via `pdfkit` (`GET /api/invoices/:id/pdf`) plus print-ready invoice pages.
- **Transactional Payment Ledger**: Partial and full payments with `FOR UPDATE` row locking to reject overpayments and automatically update invoice statuses (`Partially Paid` -> `Paid`).
- **Templated Email Service & Logs**: HTML-escaped email templates via `nodemailer` with automatic **Development Simulation Mode** when SMTP credentials are omitted, recording every outcome (`SENT`, `SIMULATED`, `FAILED`) in `email_logs`.
- **Event & Cron Automation Engine**:
  - Real-time hooks on `INVOICE_SENT` and `PAYMENT_RECEIVED`
  - Scheduled due-soon reminders and overdue transitions (`node-cron` + duplicate guard via `reminder_records`)
  - **Automation Center & Safe Retry**: Toggle workflows, configure days-before-due offsets, manually trigger checks, and safely retry failed runs without duplicating emails.
- **Reports & Analytics**: Executive Dashboard KPIs, continuous 3/6/12-month billing vs. collection charts, status distribution, customer revenue leaderboard, overdue aging, and formula-safe CSV export.

---

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router v7, Axios
- **Backend**: Node.js, Express, `mysql2/promise`, `jsonwebtoken`, `bcrypt`, `pdfkit`, `nodemailer`, `node-cron`
- **Database**: MySQL / MariaDB (XAMPP), InnoDB schema with strict foreign keys and multi-tenant `user_id` scoping

---

## Project Structure
```text
InvoiceFlow Automation system/
├── database/
│   └── schema.sql               # 10 normalized InnoDB tables
├── backend/
│   ├── server.js                # Entry point (DB check + Express + Cron scheduler)
│   ├── src/
│   │   ├── app.js               # Express app, security headers, CORS, routes
│   │   ├── automation/          # Rules engine, conditions, actions, cron scheduler
│   │   ├── config/              # Env validation & MariaDB connection pool
│   │   ├── controllers/         # HTTP request handlers
│   │   ├── middleware/          # Auth, security headers & rate limiter, error handler
│   │   ├── models/              # Parameterized SQL repositories
│   │   ├── routes/              # REST route definitions
│   │   ├── services/            # Business logic, PDF, email, analytics
│   │   └── utils/               # Exact cent math & AppError
│   └── tests/                   # Unit tests (*.test.js) & full E2E verifier
└── frontend/
    └── src/
        ├── api/                 # Axios clients per domain
        ├── components/          # Reusable UI & SVG analytics charts
        ├── context/             # AuthProvider state
        ├── layouts/             # SaaS sidebar shell
        └── pages/               # Dashboard, Customers, Invoices, Payments, Automation, Reports, Settings
```

---

## Local Setup Guide

### 1. Database Setup (XAMPP / MariaDB)
1. Start **MySQL** in XAMPP Control Panel (port `3306`).
2. Import `database/schema.sql` using phpMyAdmin or the MySQL CLI:
   ```sql
   SOURCE d:/InvoiceFlow Automation system/database/schema.sql;
   ```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # Configure JWT_SECRET, DB_*, and optional SMTP_* credentials
npm run dev            # Starts API server + background scheduler on http://localhost:5000
```

> **Note:** Leave `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` blank in `.env` for local development. InvoiceFlow automatically runs in **Email Simulation Mode** and logs every email in `email_logs`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev            # Starts Vite dev server on http://localhost:5173
```

---

## REST API Reference
| Module | Endpoint Prefix | Highlights |
| --- | --- | --- |
| Health | `/api/health` | Database connectivity & server status |
| Auth & Business | `/api/auth` | `POST /register`, `POST /login` (rate-limited), `GET /me`, `PUT /profile`, `POST /logo` |
| Customers | `/api/customers` | CRUD, search/balance filter, customer detail & invoices |
| Invoices | `/api/invoices` | CRUD, status transitions, `GET /:id/pdf` |
| Payments | `/api/payments` | Ledger list, transactional payment recording |
| Emails | `/api/emails` | Manual invoice send, reminder, receipt, `GET /logs` |
| Automation | `/api/automation` | `GET /overview`, `PATCH /workflows/:id`, `GET /executions`, `POST /executions/:id/retry`, `POST /run-checks` |
| Reports | `/api/reports` | `GET /dashboard`, `GET /overview?months=3\|6\|12`, `GET /export.csv` |

---

## Security & Financial Safeguards
- **Multi-Tenant Data Isolation**: Every protected SQL query enforces `user_id = req.user.id`; cross-tenant IDs return `404` or `403`.
- **Server-Side Monetary Precision**: Frontend totals are informational only; invoices, payments, and analytics use exact integer minor-unit math (`toCents` / `centsToDecimal`) and `DECIMAL(12,2)` SQL columns.
- **HTTP Hardening**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `x-powered-by` disabled, `1mb` JSON payload cap, rate-limited `/api/auth/login` and `/api/auth/register`, HTML-escaped email templates, and formula-injection safe CSV exports.

---

## Verification Commands
```bash
# 1. Backend unit test suite (no DB required)
cd backend && npm test

# 2. Full 12-phase backend + MariaDB E2E verification
cd backend && npm run test:e2e

# 3. Frontend production build check
cd frontend && npm run build
```

