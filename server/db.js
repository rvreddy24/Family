const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'familyhubs.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency and sub-second writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('CLIENT', 'ADMIN', 'PARTNER')),
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      full_name TEXT NOT NULL,
      auth_provider_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients_profile (
      user_id TEXT PRIMARY KEY,
      country_residence TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      subscription_tier TEXT NOT NULL DEFAULT 'GOLD' CHECK(subscription_tier IN ('NONE', 'SILVER', 'GOLD', 'CONCIERGE_UNLIMITED')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parents_profile (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      primary_phone TEXT NOT NULL,
      locality TEXT NOT NULL,
      full_address TEXT NOT NULL,
      coordinates_lat REAL NOT NULL,
      coordinates_lng REAL NOT NULL,
      medical_notes TEXT,
      FOREIGN KEY (client_id) REFERENCES clients_profile(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS partners_profile (
      user_id TEXT PRIMARY KEY,
      service_category TEXT NOT NULL CHECK(service_category IN ('HOME_MAINTENANCE', 'MEDICAL_TRANSPORT', 'ERRANDS', 'EMERGENCY')),
      operating_region TEXT NOT NULL,
      kyc_verified INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      wallet_balance REAL DEFAULT 0.00,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      tracking_code TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      assigned_partner_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PENDING_OPS_REVIEW', 'DISPATCHED', 'ACCEPTED', 'IN_PROGRESS', 'VERIFICATION_SUBMITTED', 'COMPLETED', 'DISPUTED', 'CANCELLED')),
      scheduled_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients_profile(user_id),
      FOREIGN KEY (parent_id) REFERENCES parents_profile(id),
      FOREIGN KEY (assigned_partner_id) REFERENCES partners_profile(user_id)
    );

    CREATE TABLE IF NOT EXISTS escrow_transactions (
      id TEXT PRIMARY KEY,
      task_id TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_gateway_ref TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('HOLD_IN_ESCROW', 'RELEASED_TO_PARTNER', 'REFUNDED_TO_CLIENT')),
      escrow_locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME,
      tx_digest TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS verification_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('ARRIVAL_CHECKIN', 'TASK_COMPLETION')),
      selfie_image_url TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      distance_from_target_meters REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_by_admin TEXT,
      review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED_OUT_OF_BOUNDS')),
      geofence_passed INTEGER DEFAULT 1,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_id) REFERENCES partners_profile(user_id),
      FOREIGN KEY (reviewed_by_admin) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      template_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
      message_preview TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      ip_address TEXT,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS security_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parent_vitals (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      blood_pressure_sys INTEGER,
      blood_pressure_dia INTEGER,
      blood_sugar REAL,
      blood_sugar_type TEXT CHECK(blood_sugar_type IN ('FASTING', 'POST_PRANDIAL', 'RANDOM', 'NONE')),
      pulse INTEGER,
      spo2 INTEGER,
      weight_kg REAL,
      notes TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES parents_profile(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parent_medications (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      time_of_day TEXT,
      stock_remaining INTEGER DEFAULT 30,
      low_stock_threshold INTEGER DEFAULT 7,
      instructions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES parents_profile(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medical_vault_documents (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'SCAN', 'OTHER')),
      file_url TEXT NOT NULL,
      doctor_name TEXT,
      hospital_name TEXT,
      document_date TEXT,
      notes TEXT,
      uploaded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES parents_profile(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS emergency_events (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      triggered_by_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISPATCHED', 'RESOLVED')),
      latitude REAL,
      longitude REAL,
      notes TEXT,
      ambulance_dispatched INTEGER DEFAULT 0,
      assigned_partner_id TEXT,
      resolved_by TEXT,
      resolution_notes TEXT,
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (parent_id) REFERENCES parents_profile(id) ON DELETE CASCADE,
      FOREIGN KEY (triggered_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      tags_json TEXT,
      feedback_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES users(id),
      FOREIGN KEY (partner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      invited_name TEXT NOT NULL,
      invited_email TEXT NOT NULL,
      relationship TEXT NOT NULL DEFAULT 'SIBLING',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('INVITED', 'ACTIVE')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients_profile(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('CLIENT', 'ADMIN', 'PARTNER')),
      action TEXT NOT NULL CHECK(action IN ('LOGIN', 'SIGNUP')),
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default security settings
  db.prepare(`
    INSERT OR IGNORE INTO security_settings (key, value) VALUES ('escrow_release_pin', '849201')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO security_settings (key, value) VALUES ('geofence_tolerance_meters', '150')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO security_settings (key, value) VALUES ('emergency_escrow_freeze', '0')
  `).run();

  // Ensure whatsapp_phone exists in parents_profile
  try {
    db.prepare('ALTER TABLE parents_profile ADD COLUMN whatsapp_phone TEXT').run();
  } catch {}
  try {
    db.prepare('UPDATE parents_profile SET whatsapp_phone = primary_phone WHERE whatsapp_phone IS NULL OR whatsapp_phone = ""').run();
  } catch {}

  // Ensure telemetry & rating columns exist in partners_profile
  try {
    db.prepare('ALTER TABLE partners_profile ADD COLUMN last_latitude REAL').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE partners_profile ADD COLUMN last_longitude REAL').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE partners_profile ADD COLUMN last_location_updated_at DATETIME').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE partners_profile ADD COLUMN rating REAL DEFAULT 4.95').run();
  } catch {}
  try {
    db.prepare('ALTER TABLE partners_profile ADD COLUMN total_reviews INTEGER DEFAULT 18').run();
  } catch {}

  seedCleanCoreData();
}

// Clean core setup: ONLY system users, KYC-verified partners with 0 balance, and clean parent profiles
// ZERO preloaded tasks, ZERO preloaded escrows, ZERO preloaded verification logs!
const USER_ID_ALIASES = {};

function resolveUserId(id) {
  if (!id) return id;
  if (id === 'admin' || id === 'test_ops_admin' || id === 'usr_admin') {
    try {
      const admin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
      if (admin) return admin.id;
    } catch {
      // ignore
    }
  }
  return USER_ID_ALIASES[id] || id;
}

function seedCleanCoreData() {
  // Initialize default system security settings if not present
  const existingSettings = db.prepare('SELECT COUNT(*) as cnt FROM security_settings').get().cnt;
  if (existingSettings === 0) {
    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO security_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `);
    insertSetting.run('escrow_release_pin', '849201');
    insertSetting.run('geofence_tolerance_meters', '150');
    insertSetting.run('emergency_escrow_freeze', '0');
  }

  // Ensure single official Operations Admin exists
  const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();
  if (!existingAdmin) {
    db.prepare(`
      INSERT OR REPLACE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'ADMIN', ?, ?, ?, ?, datetime('now'))
    `).run(
      '8c7b8a7c-e474-49be-a9ba-ba780a5d056c',
      'admin@familyhubs.in',
      '+91 90000 88888',
      'Operations Administrator',
      '8c7b8a7c-e474-49be-a9ba-ba780a5d056c'
    );
  }

  // Ensure default verified Client exists for zero-friction demo access
  const existingClient = db.prepare("SELECT * FROM users WHERE email = 'rajesh.reddy@gmail.com'").get();
  const clientId = 'c11e4701-0000-4000-8000-000000000001';
  if (!existingClient) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'CLIENT', 'rajesh.reddy@gmail.com', '+1 408 555 0192', 'Rajesh Reddy (NRI Son)', ?, datetime('now'))
    `).run(clientId, clientId);

    db.prepare(`
      INSERT OR IGNORE INTO clients_profile (user_id, country_residence, currency, subscription_tier)
      VALUES (?, 'United States', 'USD', 'GOLD')
    `).run(clientId);

    const parentId = 'prt_lakshmi_ramana_hyd';
    db.prepare(`
      INSERT OR IGNORE INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
      VALUES (?, ?, 'Lakshmi & Ramana Reddy', '+91 94401 23456', '+91 94401 23456', 'Banjara Hills, Hyderabad', 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034', 17.4156, 78.4357, 'Hypertension & Type 2 Diabetes. Preferred Hospital: Apollo Jubilee Hills.')
    `).run(parentId, clientId);

    // Baseline Vitals
    try {
      db.prepare(`
        INSERT OR IGNORE INTO parent_vitals (id, parent_id, systolic, diastolic, blood_glucose_mg_dl, glucose_reading_type, pulse_bpm, spo2_pct, weight_kg, notes, recorded_at)
        VALUES ('vtl_init_1', ?, 124, 82, 112, 'FASTING', 72, 98, 68.5, 'Normal morning vitals checkup.', datetime('now'))
      `).run(parentId);
    } catch {}

    // Sample Medication
    try {
      db.prepare(`
        INSERT OR IGNORE INTO parent_medications (id, parent_id, medicine_name, dosage, frequency, timing, current_stock_count, refill_threshold_count, special_instructions)
        VALUES ('med_init_1', ?, 'Metformin 500mg', '500mg', 'DAILY', 'Morning (After Breakfast)', 24, 7, 'Take with water after breakfast')
      `).run(parentId);
    } catch {}

    // Sibling member
    try {
      db.prepare(`
        INSERT OR IGNORE INTO family_members (id, client_id, full_name, email, phone, relationship, access_level, notifications_enabled, created_at)
        VALUES ('fam_init_1', ?, 'Pooja Reddy', 'pooja.reddy@london.co.uk', '+44 7700 900123', 'SIBLING', 'CAN_REQUEST', 1, datetime('now'))
      `).run(clientId);
    } catch {}
  }

  // Ensure default verified Field Partner exists for zero-friction demo access
  const existingPartner = db.prepare("SELECT * FROM users WHERE email = 'partner@familyhubs.in'").get();
  const partnerId = 'p11e4701-0000-4000-8000-000000000002';
  if (!existingPartner) {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'PARTNER', 'partner@familyhubs.in', '+91 98765 43210', 'Ramesh Babu - Certified Companion', ?, datetime('now'))
    `).run(partnerId, partnerId);

    db.prepare(`
      INSERT OR IGNORE INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance, rating, total_reviews)
      VALUES (?, 'MEDICAL_TRANSPORT', 'Hyderabad & Telangana Central Hub', 1, 1, 3758.00, 5.0, 18)
    `).run(partnerId);
  }
}

// ----------------- SECURITY & AUDIT HELPERS -----------------

function addAuditLog({ eventType, actorId, actorRole, ipAddress = '127.0.0.1', severity = 'LOW', details = {} }) {
  const id = 'aud_' + Math.random().toString(36).substring(2, 9);
  db.prepare(`
    INSERT INTO audit_logs (id, event_type, actor_id, actor_role, ip_address, severity, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, eventType, actorId || 'anonymous', actorRole || 'UNKNOWN', ipAddress, severity, JSON.stringify(details));
}

function getAuditLogs(limit = 50) {
  return db.prepare(`
    SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

function getSecuritySettings() {
  const rows = db.prepare('SELECT * FROM security_settings').all();
  const settings = {};
  rows.forEach((r) => {
    settings[r.key] = r.value;
  });
  return settings;
}

function updateSecuritySetting(key, value, actorId = 'admin') {
  actorId = resolveUserId(actorId);
  db.prepare(`
    INSERT OR REPLACE INTO security_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
  `).run(key, String(value));

  addAuditLog({
    eventType: 'SECURITY_SETTING_UPDATED',
    actorId,
    actorRole: 'ADMIN',
    severity: 'MEDIUM',
    details: { key, value },
  });

  return getSecuritySettings();
}

function calculateHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----------------- QUERIES & MUTATIONS -----------------

function getTasks(filter = {}) {
  let query = `
    SELECT 
      t.*,
      c.country_residence as client_country,
      u_client.full_name as client_name,
      u_client.email as client_email,
      p.parent_name,
      p.primary_phone as parent_phone,
      p.locality as parent_locality,
      p.full_address as parent_address,
      p.coordinates_lat as parent_lat,
      p.coordinates_lng as parent_lng,
      p.medical_notes as parent_medical_notes,
      u_part.full_name as partner_name,
      u_part.phone as partner_phone,
      part_prof.service_category as partner_category,
      part_prof.operating_region as partner_region,
      part_prof.kyc_verified as partner_kyc,
      e.id as escrow_id,
      e.amount as escrow_amount,
      e.currency as escrow_currency,
      e.status as escrow_status,
      e.payment_gateway_ref as escrow_ref,
      e.escrow_locked_at,
      e.released_at as escrow_released_at,
      e.tx_digest as escrow_tx_digest
    FROM tasks t
    LEFT JOIN clients_profile c ON t.client_id = c.user_id
    LEFT JOIN users u_client ON c.user_id = u_client.id
    LEFT JOIN parents_profile p ON t.parent_id = p.id
    LEFT JOIN partners_profile part_prof ON t.assigned_partner_id = part_prof.user_id
    LEFT JOIN users u_part ON part_prof.user_id = u_part.id
    LEFT JOIN escrow_transactions e ON t.id = e.task_id
    WHERE 1=1
  `;
  const params = [];

  if (filter.clientId) {
    query += ` AND t.client_id = ?`;
    params.push(resolveUserId(filter.clientId));
  }
  if (filter.partnerId) {
    query += ` AND t.assigned_partner_id = ?`;
    params.push(resolveUserId(filter.partnerId));
  }
  if (filter.status) {
    query += ` AND t.status = ?`;
    params.push(filter.status);
  }
  if (filter.locality) {
    query += ` AND p.locality LIKE ?`;
    params.push(`%${filter.locality}%`);
  }

  query += ` ORDER BY t.created_at DESC`;

  const rows = db.prepare(query).all(...params);
  return rows.map(formatTaskRow);
}

function getTaskById(id) {
  const query = `
    SELECT 
      t.*,
      c.country_residence as client_country,
      u_client.full_name as client_name,
      u_client.email as client_email,
      p.parent_name,
      p.primary_phone as parent_phone,
      p.locality as parent_locality,
      p.full_address as parent_address,
      p.coordinates_lat as parent_lat,
      p.coordinates_lng as parent_lng,
      p.medical_notes as parent_medical_notes,
      u_part.full_name as partner_name,
      u_part.phone as partner_phone,
      part_prof.service_category as partner_category,
      part_prof.operating_region as partner_region,
      part_prof.kyc_verified as partner_kyc,
      e.id as escrow_id,
      e.amount as escrow_amount,
      e.currency as escrow_currency,
      e.status as escrow_status,
      e.payment_gateway_ref as escrow_ref,
      e.escrow_locked_at,
      e.released_at as escrow_released_at,
      e.tx_digest as escrow_tx_digest
    FROM tasks t
    LEFT JOIN clients_profile c ON t.client_id = c.user_id
    LEFT JOIN users u_client ON c.user_id = u_client.id
    LEFT JOIN parents_profile p ON t.parent_id = p.id
    LEFT JOIN partners_profile part_prof ON t.assigned_partner_id = part_prof.user_id
    LEFT JOIN users u_part ON part_prof.user_id = u_part.id
    LEFT JOIN escrow_transactions e ON t.id = e.task_id
    WHERE t.id = ? OR t.tracking_code = ?
  `;

  const row = db.prepare(query).get(id, id);
  if (!row) return null;
  return formatTaskRow(row);
}

function formatTaskRow(r) {
  const verifications = db.prepare(`
    SELECT v.*, u.full_name as reviewer_name 
    FROM verification_logs v 
    LEFT JOIN users u ON v.reviewed_by_admin = u.id 
    WHERE v.task_id = ? 
    ORDER BY v.timestamp DESC
  `).all(r.id);

  const whatsappLogs = db.prepare(`
    SELECT * FROM whatsapp_logs WHERE task_id = ? ORDER BY sent_at DESC
  `).all(r.id);

  let review = null;
  try {
    const revRow = db.prepare('SELECT * FROM task_reviews WHERE task_id = ?').get(r.id);
    if (revRow) {
      review = {
        id: revRow.id,
        task_id: revRow.task_id,
        client_id: revRow.client_id,
        partner_id: revRow.partner_id,
        rating: revRow.rating,
        tags: JSON.parse(revRow.tags_json || '[]'),
        feedback_text: revRow.feedback_text,
        created_at: revRow.created_at,
      };
    }
  } catch {}

  return {
    id: r.id,
    tracking_code: r.tracking_code,
    client_id: r.client_id,
    parent_id: r.parent_id,
    assigned_partner_id: r.assigned_partner_id,
    category: r.category,
    title: r.title,
    instructions: r.instructions,
    status: r.status,
    scheduled_at: r.scheduled_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    client: {
      id: r.client_id,
      full_name: r.client_name,
      email: r.client_email,
      country_residence: r.client_country,
    },
    parent: {
      id: r.parent_id,
      client_id: r.client_id,
      parent_name: r.parent_name,
      primary_phone: r.parent_phone,
      locality: r.parent_locality,
      full_address: r.parent_address,
      coordinates_lat: r.parent_lat,
      coordinates_lng: r.parent_lng,
      medical_notes: r.parent_medical_notes,
    },
    assigned_partner: r.assigned_partner_id ? {
      id: r.assigned_partner_id,
      full_name: r.partner_name,
      phone: r.partner_phone,
      service_category: r.partner_category,
      operating_region: r.partner_region,
      kyc_verified: Boolean(r.partner_kyc),
    } : null,
    escrow: r.escrow_id ? {
      id: r.escrow_id,
      task_id: r.id,
      amount: r.escrow_amount,
      currency: r.escrow_currency,
      payment_gateway_ref: r.escrow_ref,
      status: r.escrow_status,
      escrow_locked_at: r.escrow_locked_at,
      released_at: r.escrow_released_at,
      tx_digest: r.escrow_tx_digest,
    } : null,
    verification_logs: verifications,
    verificationLogs: verifications,
    whatsapp_logs: whatsappLogs,
    whatsappLogs: whatsappLogs,
    review,
  };
}

function createTask({ clientId, parentId, category, title, instructions, scheduledAt, escrowAmount = 50.0 }) {
  const taskId = 'tsk_' + Math.random().toString(36).substring(2, 9);
  const randNum = Math.floor(10000 + Math.random() * 90000);
  const trackingCode = `FH-${randNum}`;
  const now = new Date().toISOString();

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO tasks (id, tracking_code, client_id, parent_id, category, title, instructions, status, scheduled_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_OPS_REVIEW', ?, ?, ?)
    `).run(taskId, trackingCode, clientId, parentId, category, title, instructions, scheduledAt || now, now, now);

    const escrowId = 'esc_' + Math.random().toString(36).substring(2, 9);
    db.prepare(`
      INSERT INTO escrow_transactions (id, task_id, amount, currency, payment_gateway_ref, status, escrow_locked_at)
      VALUES (?, ?, ?, 'USD', ?, 'HOLD_IN_ESCROW', ?)
    `).run(escrowId, taskId, escrowAmount, `pi_live_fh_${trackingCode}_sec`, now);

    // Initial WhatsApp message to parent
    const parent = db.prepare('SELECT primary_phone, parent_name FROM parents_profile WHERE id = ?').get(parentId);
    if (parent) {
      db.prepare(`
        INSERT INTO whatsapp_logs (id, task_id, recipient_phone, template_name, status, message_preview, sent_at)
        VALUES (?, ?, ?, 'task_submitted_alert', 'SENT', ?, ?)
      `).run(
        'wa_' + Math.random().toString(36).substring(2, 9),
        taskId,
        parent.primary_phone,
        `Hello ${parent.parent_name}, a new service has been booked for you: "${title}". Our FamilyHubs Operations team is coordinating with local partners.`,
        now
      );
    }

    addAuditLog({
      eventType: 'TASK_CREATED_AND_ESCROW_LOCKED',
      actorId: clientId,
      actorRole: 'CLIENT',
      severity: 'LOW',
      details: { taskId, trackingCode, amount: escrowAmount, title },
    });
  });

  insert();
  return getTaskById(taskId);
}

function assignPartner(taskId, partnerId, adminId = 'admin') {
  partnerId = resolveUserId(partnerId);
  adminId = resolveUserId(adminId);
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks 
    SET assigned_partner_id = ?, status = 'DISPATCHED', updated_at = ?
    WHERE id = ?
  `).run(partnerId, now, taskId);

  const task = getTaskById(taskId);
  if (task && task.parent) {
    db.prepare(`
      INSERT INTO whatsapp_logs (id, task_id, recipient_phone, template_name, status, message_preview, sent_at)
      VALUES (?, ?, ?, 'partner_assigned', 'DELIVERED', ?, ?)
    `).run(
      'wa_' + Math.random().toString(36).substring(2, 9),
      taskId,
      task.parent.primary_phone,
      `Hello, concierge partner ${task.assigned_partner ? task.assigned_partner.full_name : 'Representative'} has been assigned for your service. Phone: ${task.assigned_partner ? task.assigned_partner.phone : ''}.`,
      now
    );
  }

  addAuditLog({
    eventType: 'PARTNER_DISPATCHED',
    actorId: adminId,
    actorRole: 'ADMIN',
    severity: 'LOW',
    details: { taskId, partnerId, trackingCode: task ? task.tracking_code : '' },
  });

  return getTaskById(taskId);
}

function partnerAcceptTask(taskId, partnerId) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks 
    SET status = 'ACCEPTED', updated_at = ?
    WHERE id = ?
  `).run(now, taskId);

  addAuditLog({
    eventType: 'TASK_ACCEPTED_BY_PARTNER',
    actorId: partnerId,
    actorRole: 'PARTNER',
    severity: 'LOW',
    details: { taskId },
  });

  return getTaskById(taskId);
}

function partnerStartTask(taskId, partnerId) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks 
    SET status = 'IN_PROGRESS', updated_at = ?
    WHERE id = ?
  `).run(now, taskId);

  addAuditLog({
    eventType: 'TASK_STARTED',
    actorId: partnerId,
    actorRole: 'PARTNER',
    severity: 'LOW',
    details: { taskId },
  });

  return getTaskById(taskId);
}

// Forensic Verification with Server-Side Haversine Geofence Calculation
function submitVerification({ taskId, partnerId, stage, selfieImageUrl, latitude, longitude }) {
  const verId = 'ver_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  // 1. Fetch parent's registered coordinates
  const task = getTaskById(taskId);
  if (!task) throw new Error('Task not found');

  const parentLat = task.parent?.coordinates_lat || 16.8724;
  const parentLng = task.parent?.coordinates_lng || 79.5631;

  // 2. Server-Side Forensic Haversine Calculation
  const serverDistance = calculateHaversine(latitude, longitude, parentLat, parentLng);

  // 3. Check against geofence tolerance
  const settings = getSecuritySettings();
  const tolerance = parseFloat(settings.geofence_tolerance_meters) || 150.0;
  const geofencePassed = serverDistance <= tolerance ? 1 : 0;
  const reviewStatus = geofencePassed ? 'PENDING' : 'FLAGGED_OUT_OF_BOUNDS';

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO verification_logs (id, task_id, partner_id, stage, selfie_image_url, latitude, longitude, distance_from_target_meters, timestamp, review_status, geofence_passed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(verId, taskId, partnerId, stage, selfieImageUrl, latitude, longitude, serverDistance, now, reviewStatus, geofencePassed);

    const newStatus = stage === 'ARRIVAL_CHECKIN' ? 'IN_PROGRESS' : 'VERIFICATION_SUBMITTED';
    db.prepare(`
      UPDATE tasks 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, now, taskId);

    // WhatsApp update
    if (task.parent) {
      const template = stage === 'ARRIVAL_CHECKIN' ? 'partner_arrived_alert' : 'task_work_completed_parent';
      const preview = stage === 'ARRIVAL_CHECKIN'
        ? `Partner ${task.assigned_partner?.full_name} has arrived at your residence (Server GPS verified: ${Math.round(serverDistance)}m).`
        : `Service has been successfully completed. Proof photos logged.`;

      db.prepare(`
        INSERT INTO whatsapp_logs (id, task_id, recipient_phone, template_name, status, message_preview, sent_at)
        VALUES (?, ?, ?, ?, 'READ', ?, ?)
      `).run('wa_' + Math.random().toString(36).substring(2, 9), taskId, task.parent.primary_phone, template, preview, now);
    }

    addAuditLog({
      eventType: geofencePassed ? 'GEOFENCE_CHECK_PASSED' : 'GEOFENCE_VIOLATION_FLAGGED',
      actorId: partnerId,
      actorRole: 'PARTNER',
      severity: geofencePassed ? 'LOW' : 'HIGH',
      details: {
        taskId,
        stage,
        serverDistanceMeters: Math.round(serverDistance),
        toleranceMeters: tolerance,
        geofencePassed: Boolean(geofencePassed),
      },
    });
  });

  tx();
  return getTaskById(taskId);
}

// Escrow Release with Step-Up PIN Authentication & Emergency Freeze Check
function approveEscrow(taskId, adminId = 'admin', enteredPin = '') {
  adminId = resolveUserId(adminId);
  const settings = getSecuritySettings();

  // 1. Check Emergency Freeze
  if (settings.emergency_escrow_freeze === '1') {
    addAuditLog({
      eventType: 'ESCROW_RELEASE_BLOCKED_FREEZE_ACTIVE',
      actorId: adminId,
      actorRole: 'ADMIN',
      severity: 'CRITICAL',
      details: { taskId },
    });
    throw new Error('EMERGENCY_FREEZE_ACTIVE: All escrow releases are currently frozen by Chief Concierge security policy.');
  }

  // 2. Validate Escrow PIN
  const authorizedPin = settings.escrow_release_pin || '849201';
  if (String(enteredPin).trim() !== String(authorizedPin).trim()) {
    addAuditLog({
      eventType: 'SECURITY_PIN_FAILURE',
      actorId: adminId,
      actorRole: 'ADMIN',
      severity: 'HIGH',
      details: { taskId, enteredPinMasked: '******' },
    });
    throw new Error('INVALID_SECURITY_PIN: The 6-digit Escrow Release Authorization PIN is incorrect.');
  }

  const now = new Date().toISOString();
  const txDigest = crypto.createHash('sha256').update(`${taskId}:${now}:${adminId}:${authorizedPin}`).digest('hex');

  const tx = db.transaction(() => {
    // 1. Mark verification approved
    db.prepare(`
      UPDATE verification_logs 
      SET review_status = 'APPROVED', reviewed_by_admin = ?
      WHERE task_id = ?
    `).run(adminId, taskId);

    // 2. Mark escrow released with audit digest
    db.prepare(`
      UPDATE escrow_transactions 
      SET status = 'RELEASED_TO_PARTNER', released_at = ?, tx_digest = ?
      WHERE task_id = ?
    `).run(now, txDigest, taskId);

    // 3. Mark task completed
    db.prepare(`
      UPDATE tasks 
      SET status = 'COMPLETED', updated_at = ?
      WHERE id = ?
    `).run(now, taskId);

    // 4. Credit partner wallet balance in INR (~ ₹83.5/$)
    const escrow = db.prepare('SELECT amount, currency FROM escrow_transactions WHERE task_id = ?').get(taskId);
    const task = db.prepare('SELECT assigned_partner_id FROM tasks WHERE id = ?').get(taskId);
    if (task && task.assigned_partner_id && escrow) {
      const payoutInr = Math.round(escrow.amount * 83.5);
      db.prepare(`
        UPDATE partners_profile 
        SET wallet_balance = wallet_balance + ? 
        WHERE user_id = ?
      `).run(payoutInr, task.assigned_partner_id);
    }

    // 5. WhatsApp notification to parent
    const fullTask = getTaskById(taskId);
    if (fullTask && fullTask.parent) {
      db.prepare(`
        INSERT INTO whatsapp_logs (id, task_id, recipient_phone, template_name, status, message_preview, sent_at)
        VALUES (?, ?, ?, 'task_completed_final', 'READ', ?, ?)
      `).run(
        'wa_' + Math.random().toString(36).substring(2, 9),
        taskId,
        fullTask.parent.primary_phone,
        `Your service has been verified and completed successfully. Thank you for choosing FamilyHubs!`,
        now
      );
    }

    addAuditLog({
      eventType: 'ESCROW_RELEASE_AUTHORIZED_AND_DISBURSED',
      actorId: adminId,
      actorRole: 'ADMIN',
      severity: 'LOW',
      details: {
        taskId,
        amount: escrow?.amount,
        txDigest,
        partnerId: task?.assigned_partner_id,
      },
    });
  });

  tx();
  return getTaskById(taskId);
}

function rejectVerification(taskId, logId, adminId, reason) {
  db.prepare(`
    UPDATE verification_logs 
    SET review_status = 'REJECTED', reviewed_by_admin = ?
    WHERE id = ?
  `).run(adminId, logId);

  db.prepare(`
    UPDATE tasks 
    SET status = 'IN_PROGRESS' 
    WHERE id = ?
  `).run(taskId);

  addAuditLog({
    eventType: 'VERIFICATION_REJECTED_RETAKE_REQUESTED',
    actorId: adminId,
    actorRole: 'ADMIN',
    severity: 'MEDIUM',
    details: { taskId, logId, reason },
  });

  return getTaskById(taskId);
}

function getParents(clientId) {
  return db.prepare('SELECT * FROM parents_profile WHERE client_id = ?').all(resolveUserId(clientId));
}

function createParent(data) {
  const id = 'prt_' + Math.random().toString(36).substring(2, 9);
  const resolvedClientId = resolveUserId(data.clientId);
  db.prepare(`
    INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    resolvedClientId,
    data.parentName,
    data.primaryPhone,
    data.whatsappPhone || data.primaryPhone,
    data.locality,
    data.fullAddress,
    data.coordinatesLat || 20.5937,
    data.coordinatesLng || 78.9629,
    data.medicalNotes || null
  );

  addAuditLog({
    eventType: 'PARENT_RESIDENCE_REGISTERED',
    actorId: resolvedClientId,
    actorRole: 'CLIENT',
    severity: 'LOW',
    details: { parentId: id, name: data.parentName, locality: data.locality, whatsappPhone: data.whatsappPhone },
  });

  return db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(id);
}

function updateParent(id, data) {
  const existing = db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE parents_profile
    SET parent_name = ?,
        primary_phone = ?,
        whatsapp_phone = ?,
        locality = ?,
        full_address = ?,
        coordinates_lat = ?,
        coordinates_lng = ?,
        medical_notes = ?
    WHERE id = ?
  `).run(
    data.parentName !== undefined ? data.parentName : existing.parent_name,
    data.primaryPhone !== undefined ? data.primaryPhone : existing.primary_phone,
    data.whatsappPhone !== undefined ? data.whatsappPhone : (data.primaryPhone || existing.whatsapp_phone),
    data.locality !== undefined ? data.locality : existing.locality,
    data.fullAddress !== undefined ? data.fullAddress : existing.full_address,
    data.coordinatesLat !== undefined ? data.coordinatesLat : existing.coordinates_lat,
    data.coordinatesLng !== undefined ? data.coordinatesLng : existing.coordinates_lng,
    data.medicalNotes !== undefined ? data.medicalNotes : existing.medical_notes,
    id
  );

  addAuditLog({
    eventType: 'PARENT_RESIDENCE_UPDATED',
    actorId: existing.client_id,
    actorRole: 'CLIENT',
    severity: 'LOW',
    details: { parentId: id, name: data.parentName || existing.parent_name },
  });

  return db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(id);
}

function deleteParent(id) {
  const existing = db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(id);
  if (!existing) return false;

  db.prepare('DELETE FROM parents_profile WHERE id = ?').run(id);

  addAuditLog({
    eventType: 'PARENT_RESIDENCE_DELETED',
    actorId: existing.client_id,
    actorRole: 'CLIENT',
    severity: 'MEDIUM',
    details: { parentId: id, name: existing.parent_name },
  });

  return true;
}

function getPartners(category, region) {
  let query = `
    SELECT 
      p.*, 
      u.full_name, 
      u.email, 
      u.phone 
    FROM partners_profile p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (category) {
    query += ` AND p.service_category = ?`;
    params.push(category);
  }
  if (region) {
    query += ` AND p.operating_region LIKE ?`;
    params.push(`%${region}%`);
  }
  return db.prepare(query).all(...params);
}

function getPartnerProfile(userId) {
  return db.prepare(`
    SELECT p.*, u.full_name, u.email, u.phone 
    FROM partners_profile p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
  `).get(resolveUserId(userId));
}

function updatePartnerDuty(userId, isActive) {
  const resolved = resolveUserId(userId);
  db.prepare(`
    UPDATE partners_profile 
    SET is_active = ? 
    WHERE user_id = ?
  `).run(isActive ? 1 : 0, resolved);

  addAuditLog({
    eventType: 'PARTNER_DUTY_TOGGLED',
    actorId: resolved,
    actorRole: 'PARTNER',
    severity: 'LOW',
    details: { isActive: Boolean(isActive) },
  });

  return getPartnerProfile(resolved);
}

function getClientProfile(userId) {
  const resolved = resolveUserId(userId);
  let profile = db.prepare(`
    SELECT c.*, u.full_name, u.email, u.phone 
    FROM clients_profile c
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = ?
  `).get(resolved);

  if (!profile) {
    const user = getUserById(resolved);
    if (user) {
      db.prepare(`
        INSERT OR IGNORE INTO clients_profile (user_id, country_residence, currency, subscription_tier)
        VALUES (?, 'United States', 'USD', 'GOLD')
      `).run(user.id);

      profile = db.prepare(`
        SELECT c.*, u.full_name, u.email, u.phone 
        FROM clients_profile c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ?
      `).get(resolved);
    }
  }

  if (profile) {
    return {
      ...profile,
      user: {
        id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
      },
    };
  }
  return null;
}

function getUserByEmail(email) {
  if (!email) return null;
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
}

function getUserById(id) {
  if (!id) return null;
  const resolved = resolveUserId(id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(resolved);
}

function syncUserFromCloud(user) {
  if (!user || !user.email) return null;
  const cleanEmail = user.email.trim().toLowerCase();
  const existing = getUserByEmail(cleanEmail);
  if (existing) {
    db.prepare(`
      UPDATE users SET role = ?, phone = ?, full_name = ?, auth_provider_id = ?
      WHERE id = ?
    `).run(
      user.role || existing.role,
      user.phone || existing.phone,
      user.full_name || user.fullName || existing.full_name,
      user.auth_provider_id || user.id || existing.auth_provider_id,
      existing.id
    );

    const effRole = user.role || existing.role;
    const effId = existing.id;
    if (effRole === 'PARTNER') {
      const existingPartner = db.prepare('SELECT * FROM partners_profile WHERE user_id = ?').get(effId);
      if (!existingPartner) {
        db.prepare(`
          INSERT INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance)
          VALUES (?, 'MEDICAL_TRANSPORT', 'Miryalaguda Town & Rural Hub', 1, 1, 0.0)
        `).run(effId);
      }
    } else if (effRole === 'CLIENT') {
      const existingClient = db.prepare('SELECT * FROM clients_profile WHERE user_id = ?').get(effId);
      if (!existingClient) {
        db.prepare(`
          INSERT INTO clients_profile (user_id, country_residence, currency, subscription_tier)
          VALUES (?, 'United States', 'USD', 'GOLD')
        `).run(effId);
      }
      const existingParent = db.prepare('SELECT * FROM parents_profile WHERE client_id = ?').get(effId);
      if (!existingParent) {
        const parentId = 'prt_' + Math.random().toString(36).substring(2, 9);
        db.prepare(`
          INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng)
          VALUES (?, ?, 'Aging Parents in India', '+91 94401 23456', '+91 94401 23456', 'Pan-India', 'India', 16.8724, 79.5631)
        `).run(parentId, effId);
      }
    }

    return getUserByEmail(cleanEmail);
  }

  const id = user.id || ('usr_' + Math.random().toString(36).substring(2, 9));
  const role = user.role || 'CLIENT';
  const fullName = user.full_name || user.fullName || (role === 'ADMIN' ? 'Operations Admin' : 'FamilyHubs User');
  const phone = user.phone || '';
  const now = user.created_at || new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, role, cleanEmail, phone, fullName, user.auth_provider_id || id, now);

  if (role === 'PARTNER') {
    const existingPartner = db.prepare('SELECT * FROM partners_profile WHERE user_id = ?').get(id);
    if (!existingPartner) {
      db.prepare(`
        INSERT INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance)
        VALUES (?, 'MEDICAL_TRANSPORT', 'Miryalaguda Town & Rural Hub', 1, 1, 0.0)
      `).run(id);
    }
  } else if (role === 'CLIENT') {
    const existingClient = db.prepare('SELECT * FROM clients_profile WHERE user_id = ?').get(id);
    if (!existingClient) {
      db.prepare(`
        INSERT INTO clients_profile (user_id, country_residence, currency, subscription_tier)
        VALUES (?, 'United States', 'USD', 'GOLD')
      `).run(id);
    }
    const existingParent = db.prepare('SELECT * FROM parents_profile WHERE client_id = ?').get(id);
    if (!existingParent) {
      const parentId = 'prt_' + Math.random().toString(36).substring(2, 9);
      db.prepare(`
        INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng)
        VALUES (?, ?, 'Aging Parents in India', '+91 94401 23456', '+91 94401 23456', 'Pan-India', 'India', 16.8724, 79.5631)
      `).run(parentId, id);
    }
  }

  return getUserByEmail(cleanEmail);
}

function registerClientAccount({
  email,
  fullName,
  phone = '+1 408 555 0100',
  countryResidence = 'United States',
  currency = 'USD',
  subscriptionTier = 'GOLD',
  parentName,
  parentPhone,
  parentWhatsappPhone,
  locality = 'Pan-India',
  fullAddress = 'India',
  coordinatesLat = 16.8724,
  coordinatesLng = 79.5631,
  medicalNotes = null,
  authProviderId = null,
}) {
  if (locality.toLowerCase().includes('miryalaguda') || fullAddress.toLowerCase().includes('miryalaguda')) {
    coordinatesLat = 16.8724;
    coordinatesLng = 79.5631;
  }
  const existing = getUserByEmail(email);
  if (existing) {
    return getClientProfile(existing.id);
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'CLIENT', ?, ?, ?, ?, ?)
    `).run(userId, email, phone, fullName, authProviderId, now);

    db.prepare(`
      INSERT INTO clients_profile (user_id, country_residence, currency, subscription_tier)
      VALUES (?, ?, ?, ?)
    `).run(userId, countryResidence, currency, subscriptionTier);

    if (parentName) {
      const parentId = 'prt_' + Math.random().toString(36).substring(2, 9);
      db.prepare(`
        INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parentId,
        userId,
        parentName,
        parentPhone || phone,
        parentWhatsappPhone || parentPhone || phone,
        locality,
        fullAddress,
        coordinatesLat,
        coordinatesLng,
        medicalNotes
      );
    }

    addAuditLog({
      eventType: 'CLIENT_ACCOUNT_REGISTERED',
      actorId: userId,
      actorRole: 'CLIENT',
      severity: 'LOW',
      details: { email, fullName, countryResidence, parentName, parentPhone, parentWhatsappPhone },
    });
  });

  tx();
  return getClientProfile(userId);
}

function updateClientProfile(userId, {
  fullName,
  email,
  phone,
  countryResidence,
  currency,
  parentName,
  parentPrimaryPhone,
  parentWhatsappPhone,
  parentLocality,
  parentAddress,
  parentNotes,
}) {
  const resolved = resolveUserId(userId);
  const user = getUserById(resolved);
  if (!user) throw new Error('User not found.');

  const tx = db.transaction(() => {
    // 1. Update user
    if (fullName || email || phone) {
      db.prepare(`
        UPDATE users 
        SET full_name = COALESCE(?, full_name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone)
        WHERE id = ?
      `).run(
        fullName ? fullName.trim() : null,
        email ? email.trim().toLowerCase() : null,
        phone ? phone.trim() : null,
        resolved
      );
    }

    // 2. Update client profile
    if (countryResidence || currency) {
      db.prepare(`
        UPDATE clients_profile 
        SET country_residence = COALESCE(?, country_residence),
            currency = COALESCE(?, currency)
        WHERE user_id = ?
      `).run(
        countryResidence ? countryResidence.trim() : null,
        currency || null,
        resolved
      );
    }

    // 3. Update or Insert parent profile
    if (parentName || parentPrimaryPhone || parentWhatsappPhone || parentLocality || parentAddress || parentNotes !== undefined) {
      const existingParent = db.prepare('SELECT * FROM parents_profile WHERE client_id = ? LIMIT 1').get(resolved);
      if (existingParent) {
        db.prepare(`
          UPDATE parents_profile 
          SET parent_name = COALESCE(?, parent_name),
              primary_phone = COALESCE(?, primary_phone),
              whatsapp_phone = COALESCE(?, whatsapp_phone),
              locality = COALESCE(?, locality),
              full_address = COALESCE(?, full_address),
              medical_notes = COALESCE(?, medical_notes)
          WHERE id = ?
        `).run(
          parentName ? parentName.trim() : null,
          parentPrimaryPhone ? parentPrimaryPhone.trim() : null,
          parentWhatsappPhone ? parentWhatsappPhone.trim() : null,
          parentLocality ? parentLocality.trim() : null,
          parentAddress ? parentAddress.trim() : null,
          parentNotes !== undefined ? parentNotes : null,
          existingParent.id
        );
      } else {
        const parentId = 'prt_' + Math.random().toString(36).substring(2, 9);
        db.prepare(`
          INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, whatsapp_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, 20.5937, 78.9629, ?)
        `).run(
          parentId,
          resolved,
          parentName ? parentName.trim() : 'Parents in India',
          parentPrimaryPhone ? parentPrimaryPhone.trim() : (phone || '+91 94400 00000'),
          parentWhatsappPhone ? parentWhatsappPhone.trim() : (parentPrimaryPhone || phone || '+91 94400 00000'),
          parentLocality ? parentLocality.trim() : 'Pan-India',
          parentAddress ? parentAddress.trim() : 'Home Residence, India',
          parentNotes || null
        );
      }
    }

    addAuditLog({
      eventType: 'CLIENT_PROFILE_UPDATED',
      actorId: resolved,
      actorRole: 'CLIENT',
      severity: 'LOW',
      details: { fullName, countryResidence, parentName, parentPrimaryPhone, parentWhatsappPhone },
    });
  });

  tx();
  return {
    profile: getClientProfile(resolved),
    parents: getParents(resolved),
  };
}

function registerPartnerAccount({
  email,
  fullName,
  phone = '+91 94401 00000',
  serviceCategory = 'MEDICAL_TRANSPORT',
  operatingRegion = 'Miryalaguda Town & Rural Hub',
  authProviderId = null,
}) {
  const existing = getUserByEmail(email);
  if (existing) {
    return getPartnerProfile(existing.id);
  }

  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'PARTNER', ?, ?, ?, ?, ?)
    `).run(userId, email, phone, fullName, authProviderId, now);

    db.prepare(`
      INSERT INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance)
      VALUES (?, ?, ?, 1, 1, 0.00)
    `).run(userId, serviceCategory, operatingRegion);

    addAuditLog({
      eventType: 'PARTNER_ACCOUNT_REGISTERED',
      actorId: userId,
      actorRole: 'PARTNER',
      severity: 'LOW',
      details: { email, fullName, serviceCategory, operatingRegion },
    });
  });

  tx();
  return getPartnerProfile(userId);
}

function getEscrowSummary() {
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'HOLD_IN_ESCROW' THEN amount ELSE 0 END), 0) as locked_usd,
      COALESCE(SUM(CASE WHEN status = 'RELEASED_TO_PARTNER' THEN amount ELSE 0 END), 0) as released_usd,
      COUNT(*) as total_escrow_count
    FROM escrow_transactions
  `).get();

  const recent = db.prepare(`
    SELECT e.*, t.tracking_code, t.title, u.full_name as client_name
    FROM escrow_transactions e
    JOIN tasks t ON e.task_id = t.id
    JOIN users u ON t.client_id = u.id
    ORDER BY e.escrow_locked_at DESC
    LIMIT 20
  `).all();

  return { totals, recent };
}

function getWhatsAppAuditLog() {
  return db.prepare(`
    SELECT w.*, t.tracking_code, t.title 
    FROM whatsapp_logs w
    JOIN tasks t ON w.task_id = t.id
    ORDER BY w.sent_at DESC
    LIMIT 50
  `).all();
}

function resendWhatsApp(logId) {
  const log = db.prepare('SELECT * FROM whatsapp_logs WHERE id = ?').get(logId);
  if (!log) return null;
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE whatsapp_logs 
    SET status = 'SENT', sent_at = ? 
    WHERE id = ?
  `).run(now, logId);
  return db.prepare('SELECT * FROM whatsapp_logs WHERE id = ?').get(logId);
}

// Wipe database cleanly and reinitialize
function resetCleanDatabase() {
  db.exec(`
    DELETE FROM whatsapp_logs;
    DELETE FROM verification_logs;
    DELETE FROM escrow_transactions;
    DELETE FROM task_reviews;
    DELETE FROM emergency_events;
    DELETE FROM tasks;
    DELETE FROM audit_logs;
    UPDATE partners_profile SET wallet_balance = 0.00;
  `);

  addAuditLog({
    eventType: 'DATABASE_PURGED_CLEAN',
    actorId: 'system',
    actorRole: 'SYSTEM',
    severity: 'LOW',
    details: { message: 'All preloaded data wiped clean.' },
  });
}

function closeDatabase() {
  if (db && db.open) {
    db.close();
  }
}

// ----------------- HEALTH & CARE VITALS -----------------
function getVitals(parentId) {
  return db.prepare('SELECT * FROM parent_vitals WHERE parent_id = ? ORDER BY recorded_at DESC LIMIT 50').all(parentId);
}

function addVital(data) {
  const id = 'vit_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const sys = data.bloodPressureSys !== undefined ? data.bloodPressureSys : data.systolic;
  const dia = data.bloodPressureDia !== undefined ? data.bloodPressureDia : data.diastolic;
  const sugar = data.bloodSugar !== undefined ? data.bloodSugar : data.blood_glucose;
  const sugarType = data.bloodSugarType || data.blood_sugar_type || 'FASTING';
  const weight = data.weightKg !== undefined ? data.weightKg : data.weight_kg;

  db.prepare(`
    INSERT INTO parent_vitals (id, parent_id, recorded_by, blood_pressure_sys, blood_pressure_dia, blood_sugar, blood_sugar_type, pulse, spo2, weight_kg, notes, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.parentId,
    data.recordedBy || data.recorded_by || 'CLIENT',
    sys !== undefined && sys !== null ? Number(sys) : null,
    dia !== undefined && dia !== null ? Number(dia) : null,
    sugar !== undefined && sugar !== null ? Number(sugar) : null,
    sugarType,
    data.pulse !== undefined && data.pulse !== null ? Number(data.pulse) : null,
    data.spo2 !== undefined && data.spo2 !== null ? Number(data.spo2) : null,
    weight !== undefined && weight !== null ? Number(weight) : null,
    data.notes || null,
    now
  );
  return db.prepare('SELECT * FROM parent_vitals WHERE id = ?').get(id);
}

// ----------------- MEDICATIONS SCHEDULE -----------------
function getMedications(parentId) {
  return db.prepare('SELECT * FROM parent_medications WHERE parent_id = ? AND is_active = 1 ORDER BY created_at ASC').all(parentId);
}

function addMedication(data) {
  const id = 'med_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const name = data.medicineName || data.medicine_name || 'Prescription';
  const time = data.timeOfDay || data.time_of_day || 'Morning (After Breakfast)';
  const stock = data.stockRemaining !== undefined ? data.stockRemaining : (data.current_stock !== undefined ? data.current_stock : data.stock_remaining);
  const thresh = data.lowStockThreshold !== undefined ? data.lowStockThreshold : (data.refill_threshold !== undefined ? data.refill_threshold : data.low_stock_threshold);

  db.prepare(`
    INSERT INTO parent_medications (id, parent_id, medicine_name, dosage, frequency, time_of_day, stock_remaining, low_stock_threshold, instructions, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id,
    data.parentId,
    name,
    data.dosage || '500mg',
    data.frequency || 'DAILY',
    time,
    Number(stock) || 30,
    Number(thresh) || 7,
    data.instructions || null,
    now
  );
  return db.prepare('SELECT * FROM parent_medications WHERE id = ?').get(id);
}

function deleteMedication(medId) {
  db.prepare('UPDATE parent_medications SET is_active = 0 WHERE id = ?').run(medId);
  return { success: true };
}

function updateMedicationStock(medId, stockRemaining) {
  db.prepare('UPDATE parent_medications SET stock_remaining = ? WHERE id = ?').run(Number(stockRemaining), medId);
  return db.prepare('SELECT * FROM parent_medications WHERE id = ?').get(medId);
}

// ----------------- MEDICAL VAULT DOCUMENTS -----------------
function getVaultDocuments(parentId) {
  return db.prepare('SELECT * FROM medical_vault_documents WHERE parent_id = ? ORDER BY document_date DESC, created_at DESC').all(parentId);
}

function addVaultDocument(data) {
  const id = 'doc_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const title = data.title || data.documentName || data.document_name || 'Medical Document';
  const category = data.category || data.documentCategory || data.document_category || 'PRESCRIPTION';
  const fileUrl = data.fileUrl || data.file_url || '/uploads/sample_doc.pdf';
  const doctor = data.doctorName || data.doctor_name || null;
  const hospital = data.hospitalName || data.hospital_name || data.facility_name || null;
  const docDate = data.documentDate || data.document_date || now.split('T')[0];
  const uploaded = data.uploadedBy || data.uploaded_by || 'CLIENT';

  db.prepare(`
    INSERT INTO medical_vault_documents (id, parent_id, title, category, file_url, doctor_name, hospital_name, document_date, notes, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.parentId,
    title,
    category,
    fileUrl,
    doctor,
    hospital,
    docDate,
    data.notes || null,
    uploaded,
    now
  );
  return db.prepare('SELECT * FROM medical_vault_documents WHERE id = ?').get(id);
}

// ----------------- EMERGENCY SOS EVENTS -----------------
function getEmergencyEventById(id) {
  return db.prepare(`
    SELECT e.*, p.parent_name, p.primary_phone as parent_phone, p.full_address as parent_address, p.client_id, u.full_name as assigned_partner_name
    FROM emergency_events e
    JOIN parents_profile p ON e.parent_id = p.id
    LEFT JOIN users u ON e.assigned_partner_id = u.id
    WHERE e.id = ?
  `).get(id);
}

function getActiveEmergencies() {
  return db.prepare(`
    SELECT e.*, p.parent_name, p.primary_phone as parent_phone, p.full_address as parent_address, p.client_id, u.full_name as assigned_partner_name
    FROM emergency_events e
    JOIN parents_profile p ON e.parent_id = p.id
    LEFT JOIN users u ON e.assigned_partner_id = u.id
    WHERE e.status IN ('ACTIVE', 'DISPATCHED')
    ORDER BY e.triggered_at DESC
  `).all();
}

function createEmergencyEvent({ parentId, triggeredByUserId, latitude, longitude, notes }) {
  const id = 'sos_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const parent = db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(parentId);

  let validActorId = triggeredByUserId;
  const userExists = validActorId ? db.prepare('SELECT id FROM users WHERE id = ?').get(validActorId) : null;
  if (!userExists) {
    validActorId = parent?.client_id || (db.prepare('SELECT id FROM users LIMIT 1').get()?.id) || 'usr_client_nri';
  }
  
  db.prepare(`
    INSERT INTO emergency_events (id, parent_id, triggered_by_user_id, status, latitude, longitude, notes, ambulance_dispatched, triggered_at)
    VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, 1, ?)
  `).run(
    id,
    parentId,
    validActorId,
    latitude || parent?.coordinates_lat || 16.8724,
    longitude || parent?.coordinates_lng || 79.5631,
    notes || 'Emergency SOS initiated by client/parent',
    now
  );

  addAuditLog({
    eventType: 'EMERGENCY_SOS_INITIATED',
    actorId: triggeredByUserId || 'client',
    actorRole: 'CLIENT',
    severity: 'CRITICAL',
    details: { sosId: id, parentId, parentName: parent?.parent_name },
  });

  return getEmergencyEventById(id);
}

function resolveEmergencyEvent(id, { resolvedBy = 'admin', resolutionNotes = 'Emergency handled and verified.' } = {}) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE emergency_events
    SET status = 'RESOLVED', resolved_by = ?, resolution_notes = ?, resolved_at = ?
    WHERE id = ?
  `).run(resolvedBy, resolutionNotes, now, id);

  addAuditLog({
    eventType: 'EMERGENCY_SOS_RESOLVED',
    actorId: resolvedBy,
    actorRole: 'ADMIN',
    severity: 'HIGH',
    details: { sosId: id, resolutionNotes },
  });

  return getEmergencyEventById(id);
}

// ----------------- TASK REVIEWS & RATINGS -----------------
function createTaskReview({ taskId, clientId, partnerId, rating, tags = [], feedbackText, reviewText }) {
  const id = 'rev_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const text = feedbackText || reviewText || null;

  if (!partnerId) {
    const t = db.prepare('SELECT assigned_partner_id FROM tasks WHERE id = ?').get(taskId);
    partnerId = t?.assigned_partner_id;
  }

  db.prepare(`
    INSERT OR REPLACE INTO task_reviews (id, task_id, client_id, partner_id, rating, tags_json, feedback_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, taskId, clientId, partnerId || 'partner', Number(rating), JSON.stringify(tags), text, now);

  if (partnerId) {
    try {
      const stats = db.prepare(`
        SELECT AVG(rating) as avg_rating, COUNT(*) as cnt 
        FROM task_reviews 
        WHERE partner_id = ?
      `).get(partnerId);
      if (stats && stats.cnt > 0) {
        db.prepare(`
          UPDATE partners_profile 
          SET rating = ?, total_reviews = ?
          WHERE user_id = ?
        `).run(Math.round(stats.avg_rating * 10) / 10, stats.cnt, partnerId);
      }
    } catch {}
  }

  const row = db.prepare('SELECT * FROM task_reviews WHERE id = ?').get(id);
  return { ...row, review_text: row.feedback_text, tags: JSON.parse(row.tags_json || '[]') };
}

function getTaskReview(taskId) {
  const row = db.prepare('SELECT * FROM task_reviews WHERE task_id = ?').get(taskId);
  if (!row) return null;
  return { ...row, review_text: row.feedback_text, tags: JSON.parse(row.tags_json || '[]') };
}

function getPartnerReviews(partnerId) {
  const rows = db.prepare('SELECT * FROM task_reviews WHERE partner_id = ? ORDER BY created_at DESC').all(partnerId);
  return rows.map((r) => ({ ...r, review_text: r.feedback_text, tags: JSON.parse(r.tags_json || '[]') }));
}

// ----------------- FAMILY MEMBERS / SIBLING COLLABORATION -----------------
function getFamilyMembers(clientId) {
  return db.prepare('SELECT * FROM family_members WHERE client_id = ? ORDER BY created_at ASC').all(clientId);
}

function addFamilyMember({ clientId, invitedName, fullName, invitedEmail, email, relationship = 'SIBLING' }) {
  const id = 'fam_' + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const name = invitedName || fullName || 'Family Member';
  const mail = invitedEmail || email || '';
  db.prepare(`
    INSERT INTO family_members (id, client_id, invited_name, invited_email, relationship, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
  `).run(id, clientId, name, mail, relationship, now);
  return db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
}

// ----------------- PARTNER LIVE LOCATION TELEMETRY -----------------
function updatePartnerLocation(partnerId, latitude, longitude) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE partners_profile 
    SET last_latitude = ?, last_longitude = ?, last_location_updated_at = ?
    WHERE user_id = ?
  `).run(Number(latitude), Number(longitude), now, partnerId);
  return { partnerId, latitude: Number(latitude), longitude: Number(longitude), updatedAt: now };
}

function getPartnerLocation(partnerId) {
  const row = db.prepare(`
    SELECT last_latitude, last_longitude, last_location_updated_at 
    FROM partners_profile 
    WHERE user_id = ?
  `).get(partnerId);
  if (!row) return null;
  return {
    latitude: row.last_latitude,
    longitude: row.last_longitude,
    last_latitude: row.last_latitude,
    last_longitude: row.last_longitude,
    updated_at: row.last_location_updated_at,
    last_location_updated_at: row.last_location_updated_at,
  };
}

// ----------------- EMAIL OTP MANAGEMENT -----------------
function createEmailOtp({ email, role = 'CLIENT', action = 'LOGIN', expiresInMinutes = 10 }) {
  const cleanEmail = email.trim().toLowerCase();
  const id = 'otp_' + crypto.randomBytes(6).toString('hex');
  const otpCode = String(crypto.randomInt(100000, 999999));

  // Invalidate previous active OTPs for this email & action
  try {
    db.prepare(`
      UPDATE email_otps SET used = 1 WHERE email = ? AND action = ? AND used = 0
    `).run(cleanEmail, action.toUpperCase());
  } catch {}

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO email_otps (id, email, otp_code, role, action, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, cleanEmail, otpCode, role, action.toUpperCase(), expiresAt, now.toISOString());

  return { id, otpCode, expiresAt };
}

function verifyEmailOtp({ email, otpCode, role, action }) {
  if (!email || !otpCode) {
    return { valid: false, reason: 'Email and verification code are required.' };
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = String(otpCode).trim();
  const cleanAction = action ? action.toUpperCase() : 'LOGIN';

  const row = db.prepare(`
    SELECT * FROM email_otps 
    WHERE email = ? AND otp_code = ? AND action = ? AND used = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(cleanEmail, cleanCode, cleanAction);

  if (!row) {
    return { valid: false, reason: 'Invalid or expired verification code.' };
  }

  const now = new Date();
  const expiry = new Date(row.expires_at);
  if (now > expiry) {
    db.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(row.id);
    return { valid: false, reason: 'Verification code has expired. Please request a new one.' };
  }

  // Mark as used
  db.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(row.id);
  return { valid: true, row };
}

module.exports = {
  db,
  initDatabase,
  closeDatabase,
  resetCleanDatabase,
  getTasks,
  getTaskById,
  createTask,
  assignPartner,
  partnerAcceptTask,
  partnerStartTask,
  submitVerification,
  approveEscrow,
  rejectVerification,
  getParents,
  createParent,
  updateParent,
  deleteParent,
  getPartners,
  getPartnerProfile,
  updatePartnerDuty,
  getClientProfile,
  getEscrowSummary,
  getWhatsAppAuditLog,
  resendWhatsApp,
  addAuditLog,
  getAuditLogs,
  getSecuritySettings,
  updateSecuritySetting,
  getUserByEmail,
  getUserById,
  registerClientAccount,
  registerPartnerAccount,
  updateClientProfile,
  syncUserFromCloud,
  // New features
  getVitals,
  addVital,
  getMedications,
  addMedication,
  deleteMedication,
  updateMedicationStock,
  getVaultDocuments,
  addVaultDocument,
  getEmergencyEventById,
  getActiveEmergencies,
  createEmergencyEvent,
  resolveEmergencyEvent,
  createTaskReview,
  getTaskReview,
  getPartnerReviews,
  getFamilyMembers,
  addFamilyMember,
  updatePartnerLocation,
  getPartnerLocation,
  // Email OTP
  createEmailOtp,
  verifyEmailOtp,
};

