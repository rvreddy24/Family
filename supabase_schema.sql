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

-- 13. Health Vitals
CREATE TABLE parent_vitals (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents_profile(id) ON DELETE CASCADE,
  recorded_by TEXT NOT NULL,
  blood_pressure_sys INTEGER,
  blood_pressure_dia INTEGER,
  blood_sugar NUMERIC(5, 1),
  blood_sugar_type TEXT CHECK(blood_sugar_type IN ('FASTING', 'POST_PRANDIAL', 'RANDOM', 'NONE')),
  pulse INTEGER,
  spo2 INTEGER,
  weight_kg NUMERIC(5, 1),
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Parent Medications
CREATE TABLE parent_medications (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents_profile(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  time_of_day TEXT,
  stock_remaining INTEGER DEFAULT 30,
  low_stock_threshold INTEGER DEFAULT 7,
  instructions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Medical Vault Documents
CREATE TABLE medical_vault_documents (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'SCAN', 'OTHER')),
  file_url TEXT NOT NULL,
  doctor_name TEXT,
  hospital_name TEXT,
  document_date DATE,
  notes TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Emergency SOS Events
CREATE TABLE emergency_events (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents_profile(id) ON DELETE CASCADE,
  triggered_by_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISPATCHED', 'RESOLVED')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  ambulance_dispatched BOOLEAN DEFAULT TRUE,
  assigned_partner_id TEXT REFERENCES partners_profile(user_id),
  resolved_by TEXT,
  resolution_notes TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 17. Task Reviews & CSAT
CREATE TABLE task_reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(id),
  partner_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  tags_json JSONB,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Family Members Collaboration
CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients_profile(user_id) ON DELETE CASCADE,
  invited_name TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'SIBLING',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('INVITED', 'ACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE parent_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Allow public read/write on parent_vitals" ON parent_vitals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on parent_medications" ON parent_medications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on medical_vault_documents" ON medical_vault_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on emergency_events" ON emergency_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on task_reviews" ON task_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on family_members" ON family_members FOR ALL USING (true) WITH CHECK (true);

