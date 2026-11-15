# FamilyHubs QA results — 15 November 2026

Deployed application commit: `1bd7ee3` on the Free Render service, verified live at https://familyhubs.in.

## Verification completed

| Check | Result |
| --- | --- |
| Real three-role workflow on the deployed site | 78 / 78 passed; zero transport errors |
| Logged-in portal screens, desktop and mobile | 24 / 24 passed |
| Local security and functional regressions | 53 passed |
| Google PKCE and portal session regressions | 48 passed on each database backend, using a mock provider |
| PostgreSQL workflows and additive schema migration | Passed |
| Private storage and service status failure handling | Passed |
| Expanded local browser regression suite | Passed for all three roles at desktop, 390px and 320px |
| TypeScript and three production builds | Passed |
| Production dependency advisory audit | Zero vulnerabilities reported |

Live tests used three explicitly labeled temporary accounts. They exercised password authentication, secure role cookies, WebSocket event delivery, parent records, health/medication/document persistence, dispatch, acceptance, private proof access, geofence validation, rejection with visible correction reason, resubmission, completion, reviews, alert resolution and audit identity, family contacts, refills, privacy boundaries and logout.

## Defects corrected

- PostgreSQL task lists serialized unresolved promises into empty objects.
- Arrival/completion proof selection could choose an invalid stage.
- Operations lacked a usable proof-correction action; rejection reasons were hidden from the partner and completion could overwrite rejected history.
- Empty/invalid health readings, negative medication stock and invalid document categories did not fail clearly; zero inventory was replaced with an invented quantity.
- Refill requests contained fictional prescription, quantity and account fallbacks.
- Alerts falsely claimed an ambulance had been dispatched; resolution attribution and replay handling needed correction.
- Parent deletion with visit history returned a server error; WhatsApp consent responses could show stale values.
- Health screens could retain another parent's readings or miss repeated saves.
- Mobile navigation, focus handling, long content, tracking dialogs and session error recovery needed fixes.
- Historic visits exposed ongoing partner GPS, API fallbacks returned HTML success, auth-session refreshes consumed login attempt limits, and request logs included callback query strings.
- Connection status checked old cloud tables and incorrectly described the active database.

## Cleanup verified

All three temporary app accounts and authentication identities were removed. Their synthetic parent/task/health records, alerts, reviews, contacts, sessions and private photos were removed. Verification found zero remaining QA accounts, parents, tasks, auth identities or photos. Both pre-existing application accounts were preserved. Test passwords were removed from the private manifest.

## Practical limits

The live tests used synthetic data and proof images. Actual camera permissions and precise GPS must still be exercised on staff's physical devices. A real Google account return and email-confirmation delivery require operator-owned identities; mocked OAuth tests and provider handoff checks do not replace those checks. WhatsApp remains manual and payments remain disabled by the owner's choice. Render Free sleeps and has shared usage limits, so these results do not establish guaranteed availability or emergency response.

Reproduction and test commands: [QA.md](QA.md). Raw reports and screenshots remain in ignored local artifacts, rather than the public repository.
