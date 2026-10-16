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
└── package.json     # Workspace management and orchestrator scripts
```

---

## ⚡ Quick Start

### 1. Installation

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended):

```bash
npm install
```

### 2. Running in Development

To start the backend and all 3 web applications concurrently:

```bash
npm run dev
```

### 3. Application Endpoints

| Application / Service | URL | Description |
| :--- | :--- | :--- |
| **Backend Engine** | `http://localhost:4000` | REST API (`/api/*`) & WebSocket (`/ws/events`) |
| **User Portal** | `http://localhost:3001` | Booking tasks, live tracking, escrow management |
| **Operations Console** | `http://localhost:3002` | Admin dispatch, KYC oversight, audit & escrow release |
| **Partner Portal** | `http://localhost:3003` | Ground partner check-in, OTP verification, photo proof |

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Leaflet
- **Backend**: Node.js, Express, WebSocket (`ws`), better-sqlite3 (WAL mode)
- **Tooling**: Concurrently, TypeScript
