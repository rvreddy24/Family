# FamilyHubs verification

The application has three role-specific portals backed by the same care records. Test their connected workflow, not only individual page responses.

## Automated checks

- `npm test`: access isolation, task transitions, health validation, private proofs, disabled payments, Google PKCE/session flows on SQLite and PostgreSQL, PostgreSQL business records, and private storage/connection failures.
- `npm run test:ui`: isolated local browser checks for all three roles, desktop and 390/320px layouts, parent onboarding, repeated saves, stale health responses, proof stages, tracking, mobile focus/navigation and page errors. Build the portals first with `npm run build`.
- `npm run typecheck` and `npm audit --omit=dev` check TypeScript and production dependency advisories.

## Explicit live QA

Live checks create synthetic records and require operator authorization. Never run these as an automatic deployment hook or against another environment by accident.

1. Configure the server's Supabase/PostgreSQL credentials privately in `.env`.
2. `npm run qa:provision` creates exactly three labeled QA identities, one per role. Unique passwords are saved only in ignored `artifacts/live-qa-accounts.json`; no email is sent.
3. `npm run qa:live` tests password login, secure cookies, authenticated WebSockets and broadcasts, parent/health/medication/document records, dispatch, proof upload and geofence transitions, operations completion, family feedback, care alerts, refills, isolation and logout. Reports remain in ignored artifacts. Photos and health records are synthetic; automatic WhatsApp and payments are not exercised.
4. After verification, `npm run qa:cleanup` validates the manifest identities and removes only those test accounts, related records, sessions and private photos. It preserves pre-existing accounts. Archive the sanitized manifest before provisioning a new run.

## Field acceptance still required

Browser regression tests do not establish actual physical attendance, clinical safety, emergency response or round-the-clock availability. Exercise camera permissions and precise location on the real field devices used by staff. A real Google account return and email confirmation require operator-owned identities. Render Free can sleep or exhaust its shared workspace allowance. WhatsApp remains manual and money transfers remain disabled.
