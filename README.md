# FamilyHubs

> Enterprise-Grade Real-Time Managed Concierge Platform for Aging Parents in India.

FamilyHubs bridges the gap for Non-Resident Indians (NRIs) and children living away from home, ensuring their aging parents receive reliable, verified, and compassionate assistance for healthcare, home maintenance, emergency response, and daily errands.

---

## 🏗 System Architecture

The project is structured as a monorepo containing three frontend applications, a shared types package, and a centralized Express + WebSocket backend engine:

```
Family/
├── apps/
│   ├── user/        # Client Web Application (NRI / Adult Children) (Port 3001)
│   ├── admin/       # Operations & Support Management Console (Port 3002)
│   └── partner/     # Ground Partner & Service Provider App (Port 3003)
├── packages/
│   └── shared/      # Shared TypeScript types, contracts & utilities
├── server/          # Express REST API, SQLite (better-sqlite3) & WebSocket Gateway (Port 4000)
├── .env.example     # Production & development configuration blueprint
├── tsconfig.json    # TypeScript root configuration with path mappings
└── package.json     # Workspace management and orchestrator scripts
```

---

## ⚡ Quick Start

### 1. Installation

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended):

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3. Running in Development

To start the backend and all 3 web applications concurrently:

```bash
npm run dev
```

### 4. Application Endpoints

| Application / Service | Port / Path | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Backend Engine** | `4000` | [http://localhost:4000](http://localhost:4000) | REST API (`/api/*`) & WebSocket (`/ws/events`) |
| **User Portal** | `3001` | [http://localhost:3001](http://localhost:3001) | Booking tasks, live tracking, escrow management |
| **Operations Console** | `3002` | [http://localhost:3002](http://localhost:3002) | Admin dispatch, KYC oversight, audit & escrow release |
| **Partner Portal** | `3003` | [http://localhost:3003](http://localhost:3003) | Ground partner check-in, OTP verification, photo proof |

---

## 🚀 Production Readiness & Enterprise Features

1. **Persistent SQLite Database with WAL Mode**:
   - High-concurrency write-ahead logging (WAL).
   - Server reboots preserve existing tasks, escrows, and balances (`RESET_DB_ON_START=false`).
   - Clean shutdown handlers (`SIGTERM`, `SIGINT`) that safely flush and close WAL journals without corruption.

2. **Network & Cloud Agnostic Resolution**:
   - Zero hardcoded `localhost` endpoints in frontend bundles.
   - Dynamic API and WebSocket protocol detection (`ws:` / `wss:`), allowing flawless deployment behind Nginx, Caddy, Cloudflare, Docker, or LAN IP access from mobile devices.

3. **Vite Development Reverse Proxies**:
   - Each frontend application proxies `/api`, `/uploads`, and `/ws` directly to the backend engine on port 4000, eliminating CORS friction in development.

4. **Security & Audit Hardening**:
   - Standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`).
   - Audit trail stream logging all security and operational actions.
   - 6-digit authorized escrow PIN release and platform-wide emergency freeze.

5. **Type Safety & Build Verification**:
   - Run typecheck across the entire monorepo:
     ```bash
     npm run typecheck
     ```
   - Build all applications for production:
     ```bash
     npm run build
     ```
   - Run production single-port deployment:
     ```bash
     npm run start:prod
     ```

---

## 🛡️ Role Architecture & Email OTP Authentication

### 1. Strictly 3 Roles & Domain Isolation
The platform enforces exactly 3 distinct user roles segregated by origin domain and portal:
- **`CLIENT`** (Family User): Sign-up and login on `familyhubs.in` (port 3001). Lean registration collecting user full name, email, phone, and country of residence (parent residences are managed post-signup directly in the Parents tab).
- **`PARTNER`** (Ground Field Partner): Sign-up and login on `partner.familyhubs.in` (port 3003, `/partner`). Multilingual interface in English, Telugu, Hindi, Tamil, and Kannada.
- **`ADMIN`** (Platform Operations Admin): Exclusively restricted to the single official admin account: `admin@familyhubs.in`. Public self-registration is permanently disabled. Access only via `ops.familyhubs.in` (port 3002).

### 2. Multi-Factor OTP Verification (Signup, Password Login & Google OAuth)
Authentication incorporates a strict 6-digit email OTP security challenge:
- **Password Sign In**: Enter email & password $\rightarrow$ Validates password $\rightarrow$ Automatically challenges with 6-digit OTP sent to registered email $\rightarrow$ User submits OTP to start session.
- **Google OAuth Sign In / Sign Up**: Authenticating with Google dispatches a 6-digit OTP challenge to that Google email before access is granted.
- **Lean Sign Up**: Fill name, email, phone, country $\rightarrow$ Dispatch 6-digit verification code to email $\rightarrow$ Verify code to activate account.
- **Parents Tab Residence Management**: Parents' residences, phone numbers, WhatsApp details, and medical care notes are added, edited, and deleted directly from the **Parents** tab in the dashboard.
- **Silent Experience**: All audio chime tones and audio effects have been permanently silenced across the application.
- **Automated Test Suites**:
  ```bash
  # Test 3-role and domain separation
  npm run test:roles

  # Test Email OTP signup and login lifecycle
  npm run test:otp

  # Test Parent CRUD and Two-Step Password + OTP Login flow
  npm run test:crud
  ```

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Leaflet
- **Backend**: Node.js, Express, WebSocket (`ws`), better-sqlite3 (WAL mode), Supabase Auth / Database
- **Tooling**: Concurrently, TypeScript 5.8

