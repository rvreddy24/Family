-- Apply once in the Supabase SQL editor as the database owner.
-- Non-destructive: keeps all records. Browsers use the Express API, not these tables.
BEGIN;
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['users','clients_profile','parents_profile','partners_profile','tasks','escrow_transactions','verification_logs','whatsapp_logs','audit_logs','security_settings','parent_vitals','parent_medications','medical_vault_documents','emergency_events','task_reviews','family_members'] LOOP
    IF to_regclass('public.' || target) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',target);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','Allow public read/write on ' || target,target);
    END IF;
  END LOOP;
END $$;
UPDATE public.security_settings SET value='' WHERE key='escrow_release_pin' AND value='849201';
COMMIT;

-- Confirm using the anon key: each table request must return permission denied.
-- Auth (auth.users) is deliberately untouched. The service role retains access.
