# Launch status

## Open blockers

1. **Cloud permissions:** apply `server/lockdown_supabase.sql` in the Supabase SQL editor as database owner. Anonymous access to records in the live `users` and `security_settings` tables was confirmed during this review. This is an existing cloud permission issue, independent of the new API. Recheck with the anonymous key after applying it. The SQL preserves records and disables browser access to operational cloud tables. Supabase Auth remains available.
2. **WhatsApp Business:** set the server-only `WHATSAPP_*` environment variables. Configure an approved utility template with one body parameter for the request reference/event. Configure GET/POST `/api/whatsapp/webhook`, verification token and app secret. The queue sends only when all credentials are configured and the parent has opted in. Provider acceptance means SENT; DELIVERED/READ come only from signed callbacks. Failed or ambiguous sends require operations review before retry. Manual ?Open WhatsApp? links work without API credentials; opening a link does not mark a message delivered.
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
