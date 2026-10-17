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

  seedCleanCoreData();
}

// Clean core setup: ONLY system users, KYC-verified partners with 0 balance, and clean parent profiles
// ZERO preloaded tasks, ZERO preloaded escrows, ZERO preloaded verification logs!
const USER_ID_ALIASES = {};

function resolveUserId(id) {
  if (!id) return id;
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
    whatsapp_logs: whatsappLogs,
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
  db.prepare(`
    INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.clientId,
    data.parentName,
    data.primaryPhone,
    data.locality,
    data.fullAddress,
    data.coordinatesLat || 16.8724,
    data.coordinatesLng || 79.5631,
    data.medicalNotes || null
  );

  addAuditLog({
    eventType: 'PARENT_RESIDENCE_REGISTERED',
    actorId: data.clientId,
    actorRole: 'CLIENT',
    severity: 'LOW',
    details: { parentId: id, name: data.parentName, locality: data.locality },
  });

  return db.prepare('SELECT * FROM parents_profile WHERE id = ?').get(id);
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
  return db.prepare(`
    SELECT c.*, u.full_name, u.email, u.phone 
    FROM clients_profile c
    JOIN users u ON c.user_id = u.id
    WHERE c.user_id = ?
  `).get(resolveUserId(userId));
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
  locality = 'Reddy Colony, Miryalaguda',
  fullAddress = 'Miryalaguda, Telangana',
  coordinatesLat = 16.8724,
  coordinatesLng = 79.5631,
  medicalNotes = null,
  authProviderId = null,
}) {
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
        INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(parentId, userId, parentName, parentPhone || phone, locality, fullAddress, coordinatesLat, coordinatesLng, medicalNotes);
    }

    addAuditLog({
      eventType: 'CLIENT_ACCOUNT_REGISTERED',
      actorId: userId,
      actorRole: 'CLIENT',
      severity: 'LOW',
      details: { email, fullName, countryResidence },
    });
  });

  tx();
  return getClientProfile(userId);
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
  syncUserFromCloud,
};
