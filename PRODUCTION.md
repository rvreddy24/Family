# Launch status

## Current operating choice

WhatsApp is manual-only for now, as requested by the owner. Staff review and send messages through Open WhatsApp. Automatic delivery requires explicitly setting `WHATSAPP_AUTOMATIC_ENABLED=true` in addition to provider credentials. Payments remain disabled.

## Open blockers

1. **Cloud permissions - verified complete:** the owner applied `server/lockdown_supabase.sql` in the Supabase SQL editor as database owner. Anonymous access was previously found and has now been closed: after the owner applied the SQL, all ten existing cloud tables rejected anonymous reads while backend access still worked. This is an existing cloud permission issue, independent of the new API. The anonymous-key verification passed. The SQL preserves records and disables browser access to operational cloud tables. Supabase Auth remains available.
2. **Automatic WhatsApp - deferred by owner:** when desired, set the server-only `WHATSAPP_*` environment variables. Configure an approved utility template with one body parameter for the request reference/event. Configure GET/POST `/api/whatsapp/webhook`, verification token and app secret. The queue sends only when all credentials are configured and the parent has opted in. Provider acceptance means SENT; DELIVERED/READ come only from signed callbacks. Failed or ambiguous sends require operations review before retry. Manual ?Open WhatsApp? links work without API credentials; opening a link does not mark a message delivered.
3. **Authentication acceptance:** Supabase connection/core-table availability was checked. A real signup confirmation, password sign-in and admin sign-in must be exercised with operator-owned accounts and real email before launch. Configure Supabase confirmation URLs, production SMTP, rate limits and email-confirmation policy. The connected cloud project was checked for known demo account IDs/emails; no matches were present. Any other operator-created test accounts must be reviewed in Supabase. Rotate previously exposed demo administrator credentials and any secrets stored in the open security settings table.
4. **Hosting:** configure HTTPS, exact `CORS_ORIGIN` allowlist, trusted-proxy settings only behind your known reverse proxy, persistent SQLite/upload storage, protected backups and external uptime/error monitoring. Test camera and precise geolocation on real field devices over HTTPS. The server session lasts eight hours and is revoked on logout. Deployment is designed for one Node instance with local persistent storage; horizontal replicas need a shared database, object storage and distributed throttling.
5. **Money:** payments and payouts remain disabled by the owner's choice. Do not advertise escrow protection, guaranteed emergency response or financial settlement. Integrate and test a real payment provider before enabling those claims.

## Delivered security changes

Server-verified sessions replace identity in query strings and local storage. APIs enforce role/ownership checks, parent/medical access restrictions and task transitions. Unauthenticated WebSocket upgrades are rejected; non-admin clients receive refresh signals rather than other families' records. PIN reads, remote reset, hardcoded admin passwords, debug OTPs and fake camera/GPS data are removed. Uploads require image signatures, size limits, randomized filenames and record-level authorization. Request throttling, security headers, CSRF origin checks and generic errors are enabled. Dependency audit was clean after patch updates.

## Operations

Use `scripts/create_admin.js` only with an operator-supplied unique `ADMIN_PASSWORD` of at least 16 characters. No password is printed. Admin registration through the public app is forbidden. Do not run historical account-reset scripts against production. `RESET_DB_ON_START` is no longer acted upon by the server.

Register partners normally, review their identity/documents through your operational process, and record the approval in the partner directory. Only on-duty verified partners can be assigned. A photo and device coordinates are evidence for human review; browser geolocation is not cryptographic proof of physical presence.

Medical documents are references to HTTPS URLs, not an encrypted document vault. Use a private document provider. Limit access and retention according to your actual care operation. Parent records with task history cannot be deleted through the normal remove action.

## Verification evidence

- TypeScript and all three production builds.
- 40 isolated security/functional assertions, including a full visit lifecycle and cross-family proof access restrictions.
- Mocked WhatsApp send/consent tests and signed/forged webhook tests; no real messages sent.
- Browser checks at 1440px desktop and 390px mobile for all three portals, parent creation and care booking, with screenshots under `artifacts/ui/`.
- Supabase service connection verified; existing anonymous read exposure detected and reported.

This is implementation and regression evidence, not a claim that every possible vulnerability has been eliminated. External configuration and live acceptance items above remain necessary.

WhatsApp implementation follows Meta's Cloud API message-template contract: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

## Google sign-in

Continue with Google is available on the family, operations and partner sign-in screens. It signs into an existing FamilyHubs account with the same verified email and registered role. Create a family/partner account first if needed; Google login cannot create or elevate an administrator.

The server uses Supabase PKCE, a ten-minute one-use database flow, an HTTP-only SameSite=Lax state cookie, verified Google identity and separate HTTP-only session cookies per portal. The browser never receives OAuth access/refresh tokens. Logging out of one portal preserves the others. Callback errors return to the originating portal with an actionable message.

Google is already enabled in the connected Supabase project. Confirm Authentication > URL Configuration allows these callback URLs (the wildcard is needed for the one-use state query parameters):

- `http://localhost:4000/api/auth/google/callback**`
- `http://localhost:3001/api/auth/google/callback**`
- `http://localhost:3002/api/auth/google/callback**`
- `http://localhost:3003/api/auth/google/callback**`

For production add each real portal origin with `/api/auth/google/callback**`, and include those exact origins in CORS_ORIGIN. Google Cloud's authorized redirect URI is the Supabase provider callback shown in Authentication > Sign In / Providers > Google, not the local app callback. Do not disable Google email verification or nonce checks.

`npm run test:google` verifies all three roles, PKCE exchange, account restrictions, single-use/expired/state-mismatch callbacks, redirect allowlisting, disabled-provider handling and simultaneous portal sessions against a local mock provider. A real Google account selection/consent and redirect must still be exercised by the account owner before launch.
