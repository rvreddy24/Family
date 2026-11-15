# FamilyHubs domain deployment

## Verified current setup

Verified 15 November 2026: the Free Render service `familyhubs-ponq` is live at commit `a8dcd64`. HTTPS health and all three portal paths return 200 on familyhubs.in; www redirects to the root domain with valid HTTPS. Unauthenticated data requests return 401. The Cloudflare Free zone is active, with root/www CNAMEs to familyhubs-ponq.onrender.com in DNS-only mode. GoDaddy already delegates to the assigned etta/ruben nameservers. Supabase Site URL and redirect allowlist include the production domain; all three Google flows reach accounts.google.com. Full interactive account sign-in remains an operator acceptance check.

- Registrar: GoDaddy (owner confirmed).
- DNS authority: Cloudflare, using etta.ns.cloudflare.com and ruben.ns.cloudflare.com.
- Previous broken setup: apex pointed to 216.24.57.1 and www to the unassigned familyhubs.onrender.com hostname. Both now use the new service's hostname.
- Render workspace: My Workspace. Audio_Editor is a separate active application and is outside this deployment's scope.
- An old Family_Hubs service is suspended and points to github.com/rvreddy24/Family_Hubs, not the current Family repository. Do not repurpose it or delete its data during this deployment.

## Prepared deployment

render.yaml defines one new Free Node web service in Singapore. Operational records and sessions use Supabase PostgreSQL (`DATA_BACKEND=postgres`); proof photos use a private Supabase Storage bucket. There is no Render disk or paid database. Free compute sleeps when idle and shares the workspace's free-hour allowance; it is unsuitable for guaranteed emergency response. No infrastructure is created by committing the YAML alone; the initial Blueprint sync must be approved.

Automatic infrastructure sync and automatic application deploys should remain disabled during initial setup. Create the Blueprint with existingResources=create_new, never adopt the old services. No domains are attached in the first plan: verify the new onrender.com service before changing DNS or any existing domain association.

Supply DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in Render's secret environment configuration. Do not commit .env or expose values in chat. No payment or automatic WhatsApp credentials are needed. PostgreSQL TLS verifies the server using the official Supabase CA in server/certs/supabase-ca.crt; an alternative CA can be supplied in DATABASE_CA_CERT.

## Domain cutover after service verification

1. Verify the new service's build is live, all three portal paths render, anonymous APIs reject access, and records/photos persist in Supabase across restarts.
2. In the new service's Custom Domains, add familyhubs.in. If it is attached to the suspended legacy service, review that exact domain association before moving it. Render also creates the www association.
3. In Cloudflare DNS, replace the apex A record with a flattened CNAME @ pointing to the new service's actual Render hostname. Point www to that same hostname. Use DNS only while Render verifies the records and provisions its certificate. Preserve unrelated records, especially email MX/TXT.
4. Verify the domain and certificate in Render; then confirm HTTPS works before enabling Cloudflare proxying. Use Full (strict) with a valid Render origin certificate. Never use Flexible mode.
5. Keep both domain origins in CORS_ORIGIN. Add the verified Render hostname temporarily only if signing in there is required for staging.
6. In Supabase Auth URL Configuration, set Site URL to https://familyhubs.in and allow https://familyhubs.in/api/auth/google/callback**. Existing account roles and Google email must match. Use the callback shown by Supabase in Google Cloud OAuth settings; do not replace that Google-to-Supabase callback with the app URL.
7. Test a complete real Google return, each role's portal session and a care-request lifecycle on HTTPS. Do not claim launch completion based only on a rendered sign-in page.

## Data and backups

Local development defaults to SQLite. Before cloud migration, create a SQLite-native backup and pause local writes. Run scripts/migrate_local_to_postgres.js only with the verified DATABASE_URL and private storage configured. It copies records into separate fh_ tables, preserves local records, skips existing remote keys and checks photo contents before publishing metadata. Review counts and permissions before accepting cloud writes. Keep protected off-site database and private-object backups; free hosting is not a backup policy. Use one application instance because throttling remains in memory.
