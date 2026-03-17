# 🏋️ ATOM FITNESS — Gym Management OS v2.0

Production-ready multi-tenant SaaS platform for gym management.
Built by **Mahnwas Technologies**, Delhi.

> "Sky is the limit, but always remember the ground you are born from." — Ashish

---

## ⚡ Quick Start (Local)

### Option A: Docker (recommended — one command)
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values, then:
docker-compose up
```
App runs at `http://localhost:3000` · API at `http://localhost:5000`

### Option B: Manual

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm run migrate           # create tables + indexes
npm run seed              # insert demo data
npm run dev               # starts on :5000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env      # REACT_APP_API_URL=http://localhost:5000/api
npm start                 # starts on :3000
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@atom-fitness.com` | `Admin@123` |
| Staff | `staff@atom-fitness.com` | `Staff@123` |
| Member | `member1@atom-fitness.com` | `Member@123` |

---

## 🚀 Deploy to Render.com

```bash
# 1. Push to GitHub
git push origin main

# 2. Render.com → New → Blueprint → connect repo
# 3. Render reads render.yaml, creates all services automatically
# 4. After first deploy, run migrations:
#    Backend service → Shell → node scripts/migrate.js
```

See [OPERATIONS.md](./OPERATIONS.md) for full ops runbook.

---

## 🏗️ Architecture

```
atom-fitness/
├── backend/                    Node.js + Express + PostgreSQL
│   ├── config/
│   │   ├── env.js              Startup env validation (fail-fast)
│   │   ├── database.js         PG pool + transactions + audit helper
│   │   └── schema.sql          Production schema with constraints + indexes
│   ├── controllers/            Business logic (all wrapped in catchAsync)
│   ├── middleware/
│   │   ├── auth.js             JWT verify + requireRole + requirePermission
│   │   ├── validate.js         express-validator schemas for every route
│   │   ├── rateLimiter.js      4-tier rate limiting (auth/api/public/scan)
│   │   ├── requestId.js        UUID per request for log tracing
│   │   └── errorHandler.js     Centralized error handler + catchAsync
│   ├── routes/                 Express routers with validation applied
│   ├── scripts/
│   │   ├── migrate.js          Idempotent schema runner
│   │   └── seed.js             Demo data (refuses to run in production)
│   ├── utils/
│   │   ├── logger.js           Winston structured logging
│   │   └── AppError.js         Custom error class (no stack leaks in prod)
│   ├── Dockerfile              Multi-stage, non-root user
│   └── server.js               Graceful shutdown, compression, CORS
│
├── frontend/                   React 18 + React Router v6
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         Layout + collapsible Sidebar
│   │   │   └── shared/
│   │   │       ├── UI.js       Full component library
│   │   │       ├── QRScanner.js Camera-based QR scanner
│   │   │       └── ErrorBoundary.js Catches React crashes gracefully
│   │   ├── context/
│   │   │   ├── AuthContext.js  JWT auth state
│   │   │   └── ToastContext.js Notifications
│   │   ├── pages/
│   │   │   ├── admin/          Dashboard, Members, Staff, Subs, Attendance, Plans, QR, Settings, ScanMember
│   │   │   └── member/         Profile (with personal QR), Attendance heatmap, CheckIn
│   │   └── utils/
│   │       ├── api.js          Axios + retry on 5xx + response normalization
│   │       └── helpers.js      formatDate, formatCurrency, etc.
│   ├── Dockerfile              Multi-stage → nginx static server
│   └── nginx.conf              SPA routing + cache headers + security headers
│
├── .github/workflows/
│   ├── ci.yml                  Test + build on every PR
│   └── deploy.yml              Auto-deploy to Render on main merge
├── docker-compose.yml          Local dev stack (DB + API + frontend)
├── docker-compose.prod.yml     Production simulation
├── render.yaml                 Render.com blueprint (one-click deploy)
└── OPERATIONS.md               Backup strategy, runbook, incident response
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `POST` | `/api/auth/login` | 10/15min | Login |
| `GET` | `/api/auth/me` | 300/min | Current user |
| `POST` | `/api/auth/change-password` | 300/min | Change password |

### Members (Admin + Staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/members` | List members (paginated, searchable) |
| `POST` | `/api/members` | Create member |
| `GET` | `/api/members/dashboard-stats` | Admin stats |
| `GET` | `/api/members/pending` | Pending approvals |
| `POST` | `/api/members/:id/approve` | Approve registration |
| `PUT` | `/api/members/:id` | Update member |
| `DELETE` | `/api/members/:id` | Soft-delete member |

### QR Scanning
| Method | Endpoint | Rate Limit | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/scan/member-qr/:id` | 300/min | Get member's personal QR |
| `POST` | `/api/scan/scan-member` | 60/min | Admin/staff: scan member QR |
| `POST` | `/api/scan/scan-gym` | 60/min | Member: scan gym QR to check in |

### Subscriptions, Attendance, Plans, Staff — see routes/ directory

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Rate limiting | 4 tiers: auth (10/15min), API (300/min), public (30/min), scan (60/min) |
| Input validation | `express-validator` on every route with type + length + enum checks |
| Auth | JWT with 7-day expiry, DB lookup on every request |
| RBAC | admin / staff (per-permission) / member roles |
| Multi-tenancy | Every query scoped by `gym_id` from JWT; gym cross-access impossible |
| Timing-safe login | `bcrypt.compare` always runs even for unknown email |
| Body size limit | 100kb max (prevents DoS via large payloads) |
| SQL injection | Parameterized queries everywhere, no string interpolation |
| CORS | Strict origin allowlist |
| Security headers | `helmet` with HSTS in production |
| No stack leaks | `AppError` + error handler never exposes stack in production |
| Audit log | Every state change recorded with actor, IP, before/after |

---

## 🏛️ Database Design

**7 tables** with:
- `CHECK` constraints on all enum columns (role, status, payment_method, etc.)
- `NOT NULL` on all critical columns
- Composite indexes for common query patterns:
  - `(gym_id, status)` on members + subscriptions
  - `(gym_id, check_in_date)` on attendance_logs
  - `(gym_id, end_date) WHERE status='active'` for expiry alerts
- `UNIQUE (member_id, gym_id, check_in_date)` — prevents double check-ins at DB level
- Automatic `updated_at` trigger on all mutable tables
- `audit_logs` table for full change history

---

## 📦 Production Checklist

Before going live, verify:

- [ ] All env vars set in Render dashboard
- [ ] `JWT_SECRET` is 32+ random characters
- [ ] `NODE_ENV=production` is set
- [ ] Run `npm run migrate` after first deploy
- [ ] Verify `/health` returns `{ status: 'ok' }`
- [ ] Test login flow end-to-end
- [ ] Test QR code generation and scanning
- [ ] Enable Render daily backups on DB service
- [ ] Set up uptime monitoring (UptimeRobot free tier works)
- [ ] Test backup restore to staging

---

*Built with ❤️ by Mahnwas Technologies · Delhi, India*
*"Keep it simple. Keep it reliable. Solve real problems."*
