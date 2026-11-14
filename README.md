# FamilyHubs

A family care workspace with separate family, operations and care partner portals.

## Run

Node 20 or newer is required. Install dependencies with `npm ci`, configure `.env` using `.env.example`, then run `npm run dev`. Family: http://localhost:3001, operations: http://localhost:3002/ops/, partners: http://localhost:3003/partner/.

For a single-port deployment, run `npm run build` then `npm start`. The three portals are served at `/`, `/ops/` and `/partner/` on port 4000. Vite proxies API, uploads and authenticated WebSocket requests during development. All new UI requests use the same origin.

## Implemented flows

- Email-confirmed Supabase signup/password authentication, role separation and expiring server sessions with HTTP-only cookies. Local-storage login flags are not trusted. Public administrator signup is disabled.
- Parent profiles with real address coordinates, care notes and WhatsApp consent.
- Care requests, verified-partner dispatch, acceptance, geofenced arrival/completion photo proof, operations completion review and client feedback.
- Health readings, prescribed medication records and secure document references.
- Care alerts to operations with explicit notice that this does not dispatch emergency services.
- Optional device location sharing and timestamped partner location views.
- WhatsApp queue, approved-template delivery, signed status webhooks, explicit consent, manual click-to-chat links and operations delivery history.

Operational data is stored in SQLite with WAL. Supabase supplies authentication. The app does not claim that local records are synchronized to cloud tables. Private proof files are served only to operations, their uploader and the assigned family. Persist both the database and upload directory.

## Verification

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:ui`, `npm audit`.

The security suite uses a temporary database, session fixtures and a local server; it never changes real accounts or sends real WhatsApp messages. Browser tests use Playwright Chromium (`npx playwright install chromium`), exercise all three portals at desktop/mobile sizes, and save screenshots under `artifacts/ui/`. These tests do not establish live email delivery or a real WhatsApp account's approval status.

The old test scripts target the retired insecure demo authentication contract. They are retained as historical files and are not launch acceptance checks.

## Launch requirements

See [PRODUCTION.md](PRODUCTION.md). Do not deploy until its open blockers are resolved. The Supabase lockdown SQL must be applied to the existing project; changing source files alone cannot revoke cloud permissions.

Payments are deliberately disabled. No escrow hold, bank payout or currency conversion is simulated. A payment provider, verified webhooks, reconciliation and financial testing are required before taking money.

## Demo cleanup

`npm run data:remove-demo` backs up SQLite locally and removes known fixture accounts and records. It preserves real accounts. The local cleanup has been run. Backups may contain personal data and must be protected. It does not delete cloud authentication accounts.
