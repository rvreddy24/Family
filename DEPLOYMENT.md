# FamilyHubs domain deployment

## Verified current setup

- Registrar: GoDaddy (owner confirmed).
- DNS authority: Cloudflare, using etta.ns.cloudflare.com and ruben.ns.cloudflare.com.
- Apex currently resolves to Render's 216.24.57.1; www points to familyhubs.onrender.com, which returns Render's no-server response.
- Render workspace: My Workspace. Audio_Editor is a separate active application and is outside this deployment's scope.
- An old Family_Hubs service is suspended and points to github.com/rvreddy24/Family_Hubs, not the current Family repository. Do not repurpose it or delete its data during this deployment.

## Prepared deployment

render.yaml defines one new Node web service in Singapore, with a 1 GB persistent disk for SQLite and private uploads. It uses the smallest paid compute plan compatible with an attached disk. Paid provisioning requires the owner's approval of the actual Render plan. No infrastructure is created by committing the YAML alone; the initial Blueprint sync must be approved.

Automatic infrastructure sync and automatic application deploys should remain disabled during initial setup. Create the Blueprint with existingResources=create_new, never adopt the old services. No domains are attached in the first plan: verify the new onrender.com service before changing DNS or any existing domain association.

Supply SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in Render's secret environment configuration. Do not commit .env or expose values in chat. No payment or automatic WhatsApp credentials are needed. The health check reads local SQLite without waiting for Supabase's network response.

## Domain cutover after service verification

1. Verify the new service's build is live, all three portal paths render, anonymous APIs reject access, and data uses /var/data.
2. In the new service's Custom Domains, add familyhubs.in. If it is attached to the suspended legacy service, review that exact domain association before moving it. Render also creates the www association.
3. In Cloudflare DNS, replace the apex A record with a flattened CNAME @ pointing to the new service's actual Render hostname. Point www to that same hostname. Use DNS only while Render verifies the records and provisions its certificate. Preserve unrelated records, especially email MX/TXT.
4. Verify the domain and certificate in Render; then confirm HTTPS works before enabling Cloudflare proxying. Use Full (strict) with a valid Render origin certificate. Never use Flexible mode.
5. Keep both domain origins in CORS_ORIGIN. Add the verified Render hostname temporarily only if signing in there is required for staging.
6. In Supabase Auth URL Configuration, set Site URL to https://familyhubs.in and allow https://familyhubs.in/api/auth/google/callback**. Existing account roles and Google email must match. Use the callback shown by Supabase in Google Cloud OAuth settings; do not replace that Google-to-Supabase callback with the app URL.
7. Test a complete real Google return, each role's portal session and a care-request lifecycle on HTTPS. Do not claim launch completion based only on a rendered sign-in page.

## Data and backups

The local SQLite database contains the owner's real account and is not included in Git. New hosting initially has a fresh database. Decide whether to migrate real local records before accepting production writes; use a database-native backup and a secure transfer, not a public download route. Keep an application-consistent backup off the Render disk. Disk-backed deployment is single-instance and redeploys briefly interrupt service.
