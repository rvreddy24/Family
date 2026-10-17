-- ========================================================
-- FamilyHubs Complete Supabase Database Schema & Seed Data
-- ========================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if re-running (safe cascade)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS whatsapp_logs CASCADE;
DROP TABLE IF EXISTS verification_logs CASCADE;
DROP TABLE IF EXISTS escrow_transactions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS parents_profile CASCADE;
DROP TABLE IF EXISTS partners_profile CASCADE;
DROP TABLE IF EXISTS clients_profile CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS security_settings CASCADE;

-- 3. Core Users Table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('CLIENT', 'ADMIN', 'PARTNER')),
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  auth_provider_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Client Profiles (NRIs & Children abroad)
CREATE TABLE clients_profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_residence TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subscription_tier TEXT NOT NULL DEFAULT 'GOLD' CHECK(subscription_tier IN ('NONE', 'SILVER', 'GOLD', 'CONCIERGE_UNLIMITED'))
);

-- 5. Parent Profiles (Residences in India)
CREATE TABLE parents_profile (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients_profile(user_id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  primary_phone TEXT NOT NULL,
  locality TEXT NOT NULL,
  full_address TEXT NOT NULL,
  coordinates_lat DOUBLE PRECISION NOT NULL,
  coordinates_lng DOUBLE PRECISION NOT NULL,
  medical_notes TEXT
);

-- 6. Partner Profiles (Local Field Helpers in Telangana)
CREATE TABLE partners_profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL CHECK(service_category IN ('HOME_MAINTENANCE', 'MEDICAL_TRANSPORT', 'ERRANDS', 'EMERGENCY')),
  operating_region TEXT NOT NULL,
  kyc_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  wallet_balance NUMERIC(10, 2) DEFAULT 0.00
);

-- 7. Tasks & Bookings
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  tracking_code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients_profile(user_id),
  parent_id TEXT NOT NULL REFERENCES parents_profile(id),
  assigned_partner_id TEXT REFERENCES partners_profile(user_id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_OPS_REVIEW',
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Escrow Transactions (Financial Ledger)
CREATE TABLE escrow_transactions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_gateway_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'HOLD_IN_ESCROW' CHECK(status IN ('HOLD_IN_ESCROW', 'RELEASED_TO_PARTNER', 'REFUNDED_TO_CLIENT')),
  escrow_locked_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  tx_digest TEXT
);

-- 9. Forensic Verification Check-Ins (GPS + Photo Proof)
CREATE TABLE verification_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  partner_id TEXT NOT NULL REFERENCES partners_profile(user_id),
  stage TEXT NOT NULL,
  selfie_image_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  distance_from_target_meters DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'PENDING',
  geofence_passed BOOLEAN DEFAULT TRUE,
  reviewed_by_admin TEXT REFERENCES users(id)
);

-- 10. WhatsApp Audit Logs
CREATE TABLE whatsapp_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  message_preview TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Platform Security & Audit Trail
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  ip_address TEXT,
  severity TEXT NOT NULL DEFAULT 'LOW',
  details_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Security & Policy Settings
CREATE TABLE security_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- SEED INITIAL CORE DATA
-- ========================================================

-- Security Defaults (PIN: 849201, Geofence: 150m)
INSERT INTO security_settings (key, value) VALUES 
  ('escrow_release_pin', '849201'),
  ('geofence_tolerance_meters', '150'),
  ('emergency_escrow_freeze', '0');

-- ========================================================
-- ENABLE ROW LEVEL SECURITY (RLS) WITH OPEN ACCESS POLICIES
-- ========================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

-- Allow full access for anon key and authenticated users
CREATE POLICY "Allow public read/write on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on clients_profile" ON clients_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on parents_profile" ON parents_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on partners_profile" ON partners_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on escrow_transactions" ON escrow_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on verification_logs" ON verification_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on whatsapp_logs" ON whatsapp_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on security_settings" ON security_settings FOR ALL USING (true) WITH CHECK (true);
