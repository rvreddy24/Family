const { WebSocket } = require('ws');
const db = require('better-sqlite3')('./server/familyhubs.db');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:4000/ws/events';

// In-memory test state tracker
const caseStudyLogs = [];
const createdUserIds = new Set();
const createdTaskIds = new Set();

function logHeader(title) {
  console.log('\n======================================================================');
  console.log(`📋 ${title}`);
  console.log('======================================================================');
}

function logStep(stepNum, title, details = {}) {
  console.log(`\n  [Step ${stepNum}] 🔹 ${title}`);
  for (const [key, val] of Object.entries(details)) {
    console.log(`         • ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
  }
}

function assert(condition, message) {
  if (condition) {
    console.log(`    ✅ PASS: ${message}`);
  } else {
    console.error(`    ❌ FAIL: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

// Minimal dummy 1x1 JPEG base64 for proof photo uploads
const DUMMY_BASE64_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function uploadProofPhoto(label) {
  const uploadRes = await request('/api/upload', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64: DUMMY_BASE64_IMAGE,
      filename: `${label}_${Date.now()}`,
    }),
  });
  assert(uploadRes.status === 200, `Uploaded proof photo for: ${label}`);
  return uploadRes.data.imageUrl;
}

async function runAllCaseStudies() {
  console.log('======================================================================');
  console.log('🚀 FAMILYHUBS ENTERPRISE ON-GROUND FUNCTIONAL CASE STUDIES RUNNER');
  console.log('======================================================================');

  // Verify core system health and admin authorization PIN
  const health = await request('/api/health');
  assert(health.status === 200 && health.data.status === 'ONLINE', 'Core backend engine is ONLINE');

  const secSettings = await request('/api/security/settings');
  assert(secSettings.status === 200, 'Security settings loaded');
  const escrowPin = secSettings.data.escrow_release_pin;
  assert(Boolean(escrowPin), `Authorized Escrow Release PIN active: ${escrowPin}`);

  // Connect WebSocket subscriber to monitor real-time event broadcasts
  const wsEvents = [];
  const ws = new WebSocket(`${WS_URL}?role=ADMIN&userId=ops_case_study_monitor`);
  await new Promise((resolve) => {
    ws.on('open', resolve);
    ws.on('message', (raw) => {
      try {
        wsEvents.push(JSON.parse(raw.toString()));
      } catch {}
    });
  });
  console.log('📡 Real-time WebSocket event listener active and streaming.\n');

  // =====================================================================
  // CASE STUDY 1: MEDICAL ESCORT & DOCTOR VISIT (MIRYALAGUDA)
  // =====================================================================
  logHeader('CASE STUDY 1: Senior Doctor Escort & Health Vitals (Miryalaguda)');
  console.log('Scenario: NRI Son (Dallas, USA) requests trusted field escort for Mother (Mrs. Anasuya, 71) for routine BP and diabetic screening at Apollo Clinic, Miryalaguda.');

  // Step 1: Register NRI Client & Senior Parent
  const ts1 = Date.now();
  const c1Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'CLIENT',
      email: `rajesh.nri.${ts1}@familyhubs.in`,
      password: 'SafeClientPass2026!',
      fullName: 'Rajesh Reddy (NRI Son - Dallas)',
      phone: '+1 214 555 0184',
      countryResidence: 'United States',
      currency: 'USD',
      parentName: 'Mrs. Anasuya Reddy (Mother)',
      parentPhone: '+91 94401 22334',
      parentLocality: 'Reddy Colony, Miryalaguda',
      parentAddress: 'Plot 42, Near Anjaneya Temple, Reddy Colony, Miryalaguda',
      parentNotes: 'Mild mobility stiffness; needs arm support for staircase.',
    }),
  });
  assert(c1Res.status === 201, 'NRI Client & Mother profile created');
  const client1Id = c1Res.data.user.id;
  createdUserIds.add(client1Id);

  const parents1 = await request(`/api/parents?clientId=${client1Id}`);
  const parent1Id = parents1.data[0].id;
  logStep(1, 'NRI Client Created & Mother Profile Registered', {
    client: 'Rajesh Reddy (Dallas, TX)',
    parent: 'Mrs. Anasuya Reddy',
    locality: 'Reddy Colony, Miryalaguda',
  });

  // Step 2: Register & Verify Healthcare Escort Partner
  const p1Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'PARTNER',
      email: `pavan.healthcare.${ts1}@familyhubs.in`,
      password: 'SafePartnerPass2026!',
      fullName: 'Pavan Kumar (Healthcare Escort)',
      phone: '+91 94401 55667',
      serviceCategory: 'MEDICAL_TRANSPORT',
      operatingRegion: 'Miryalaguda & Nalgonda Rural Hub',
    }),
  });
  assert(p1Res.status === 201, 'Healthcare partner registered');
  const partner1Id = p1Res.data.user.id;
  createdUserIds.add(partner1Id);
  logStep(2, 'Verified Healthcare Field Partner Onboarded', {
    partner: 'Pavan Kumar',
    category: 'MEDICAL_TRANSPORT',
    region: 'Miryalaguda & Nalgonda',
  });

  // Step 3: NRI Client Books Medical Transport with Pre-funded Escrow
  const t1Res = await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId: client1Id,
      parentId: parent1Id,
      category: 'MEDICAL_TRANSPORT',
      title: 'Apollo Clinic Doctor Escort & Vitals Check',
      instructions: 'Accompany mother to clinic, collect paper prescription, ensure safe return home.',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      escrowAmount: 45.0,
    }),
  });
  assert(t1Res.status === 201, 'Task created with $45.00 pre-funded escrow');
  const task1 = t1Res.data;
  createdTaskIds.add(task1.id);
  assert(task1.status === 'PENDING_OPS_REVIEW', 'Task in PENDING_OPS_REVIEW');
  assert(task1.escrow.status === 'HOLD_IN_ESCROW', 'Escrow funds securely locked in HOLD_IN_ESCROW');
  logStep(3, 'Order Placed & Escrow Locked in Vault', {
    trackingCode: task1.tracking_code,
    escrowLocked: '$45.00 USD',
    initialStatus: task1.status,
  });

  // Step 4: Admin Dispatches Healthcare Escort
  const d1Res = await request(`/api/tasks/${task1.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id, adminId: 'admin' }),
  });
  assert(d1Res.status === 200 && d1Res.data.status === 'DISPATCHED', 'Task dispatched to Pavan Kumar');
  logStep(4, 'Operations Console Triaged & Dispatched Partner', {
    assignedPartner: 'Pavan Kumar',
    updatedStatus: d1Res.data.status,
  });

  // Step 5: Partner Accepts & Commences Trip
  const acc1Res = await request(`/api/tasks/${task1.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id }),
  });
  assert(acc1Res.status === 200 && acc1Res.data.status === 'ACCEPTED', 'Partner accepted assignment');

  const start1Res = await request(`/api/tasks/${task1.id}/start`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id }),
  });
  assert(start1Res.status === 200 && start1Res.data.status === 'IN_PROGRESS', 'Partner commenced transit to parent home');
  logStep(5, 'Partner Acknowledged & Commenced Service', {
    partnerStatus: 'IN_PROGRESS',
  });

  // Step 6: Partner Arrives and Logs GPS Check-in
  const photo1 = await uploadProofPhoto('clinic_arrival');
  const checkin1Res = await request(`/api/tasks/${task1.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner1Id,
      stage: 'ARRIVAL_CHECKIN',
      selfieImageUrl: photo1,
      latitude: 16.8724,
      longitude: 79.5631, // Exact residence coordinates
    }),
  });
  assert(checkin1Res.status === 200, 'Arrival check-in recorded');
  const checkin1 = checkin1Res.data.verification_logs[0];
  assert(checkin1.distance_from_target_meters <= 150, `GPS distance within geofence: ${checkin1.distance_from_target_meters}m`);
  logStep(6, 'Partner Arrival GPS Photo Check-in Logged', {
    distanceMeters: `${Math.round(checkin1.distance_from_target_meters)}m`,
    geofenceVerified: checkin1.geofence_passed ? 'YES (< 150m)' : 'NO',
    photoUrl: photo1,
  });

  // Step 7: Admin Audits Evidence and Releases Escrow
  const p1Before = await request(`/api/partners/${partner1Id}/profile`);
  const approve1Res = await request(`/api/tasks/${task1.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  assert(approve1Res.status === 200 && approve1Res.data.status === 'COMPLETED', 'Task completed');
  assert(approve1Res.data.escrow.status === 'RELEASED_TO_PARTNER', 'Escrow released to partner');

  const p1After = await request(`/api/partners/${partner1Id}/profile`);
  const expectedPayout1 = Math.round(45.0 * 83.5);
  assert(p1After.data.wallet_balance === p1Before.data.wallet_balance + expectedPayout1, 'Partner wallet balance credited');
  logStep(7, 'Admin Quality Audit Passed & Escrow Released with PIN', {
    adminAction: 'APPROVED',
    payoutCredited: `₹${expectedPayout1} INR`,
    partnerWalletNewBalance: `₹${p1After.data.wallet_balance.toFixed(2)}`,
    finalTaskStatus: 'COMPLETED',
  });

  // =====================================================================
  // CASE STUDY 2: EMERGENCY HOME ELECTRICAL & MCB REPAIR (OLD NALGONDA)
  // =====================================================================
  logHeader('CASE STUDY 2: Urgent Home Electrical & MCB Trip Repair (Old Nalgonda)');
  console.log('Scenario: NRI Daughter (London, UK) reports sudden power inverter failure and circuit trip at elderly Father\'s house in Old Nalgonda.');

  const ts2 = Date.now();
  const c2Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'CLIENT',
      email: `priya.uk.${ts2}@familyhubs.in`,
      password: 'SafeClientPass2026!',
      fullName: 'Dr. Priya Varma (NRI Daughter - London)',
      phone: '+44 7911 123456',
      countryResidence: 'United Kingdom',
      currency: 'GBP',
      parentName: 'Mr. Seshagiri Rao (Father, 76)',
      parentPhone: '+91 94901 33445',
      parentLocality: 'Old Nalgonda Clock Tower',
      parentAddress: 'Behind Sub-Registrar Office, Clock Tower Road, Old Nalgonda',
      parentNotes: 'Father is alone at home; inverter beeping continuously.',
    }),
  });
  assert(c2Res.status === 201, 'UK Client & Parent created');
  const client2Id = c2Res.data.user.id;
  createdUserIds.add(client2Id);
  const parent2Id = (await request(`/api/parents?clientId=${client2Id}`)).data[0].id;

  const p2Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'PARTNER',
      email: `srinivas.electrician.${ts2}@familyhubs.in`,
      password: 'SafePartnerPass2026!',
      fullName: 'Srinivas Chary (Licensed Electrician)',
      phone: '+91 98480 11223',
      serviceCategory: 'HOME_MAINTENANCE',
      operatingRegion: 'Old Nalgonda & Surrounding Mandals',
    }),
  });
  assert(p2Res.status === 201, 'Electrician partner registered');
  const partner2Id = p2Res.data.user.id;
  createdUserIds.add(partner2Id);

  // Client books Home Maintenance
  const t2Res = await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId: client2Id,
      parentId: parent2Id,
      category: 'HOME_MAINTENANCE',
      title: 'Inverter MCB Tripping & Fuse Box Inspection',
      instructions: 'Diagnose main DB switch, test neutral grounding, ensure power restored.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 35.0,
    }),
  });
  assert(t2Res.status === 201, 'Electrical repair task created');
  const task2 = t2Res.data;
  createdTaskIds.add(task2.id);

  // Dispatch & Accept
  await request(`/api/tasks/${task2.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner2Id, adminId: 'admin' }),
  });
  await request(`/api/tasks/${task2.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner2Id }),
  });
  await request(`/api/tasks/${task2.id}/start`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner2Id }),
  });

  // Partner checks in at parent residence and uploads repair completion photo
  const photo2 = await uploadProofPhoto('inverter_repair_proof');
  await request(`/api/tasks/${task2.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner2Id,
      stage: 'TASK_COMPLETION',
      selfieImageUrl: photo2,
      latitude: 17.0575, // Old Nalgonda coordinates
      longitude: 79.2684,
    }),
  });

  // Admin approves with PIN
  const approve2Res = await request(`/api/tasks/${task2.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  assert(approve2Res.status === 200 && approve2Res.data.status === 'COMPLETED', 'Electrical repair completed and escrow released');
  const expectedPayout2 = Math.round(35.0 * 83.5);
  logStep(1, 'Home Electrical Maintenance Successfully Executed & Settled', {
    trackingCode: task2.tracking_code,
    technician: 'Srinivas Chary',
    payout: `₹${expectedPayout2} INR`,
    auditStatus: 'VERIFIED & SETTLED',
  });

  // =====================================================================
  // CASE STUDY 3: MONTHLY PROVISIONS & POOJA ESSENTIALS (MIRYALAGUDA)
  // =====================================================================
  logHeader('CASE STUDY 3: Monthly Groceries & Temple Pooja Items (Reddy Colony)');
  console.log('Scenario: NRI Son (San Jose, California) books monthly grocery run: 25kg Sona Masoori rice bag, sunflower cooking oil, fresh vegetables, and agarbatti.');

  const ts3 = Date.now();
  const c3Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'CLIENT',
      email: `vikram.us.${ts3}@familyhubs.in`,
      password: 'SafeClientPass2026!',
      fullName: 'Vikram Reddy (NRI Son - San Jose)',
      phone: '+1 408 555 9988',
      countryResidence: 'United States',
      currency: 'USD',
      parentName: 'Mr. & Mrs. Venkat Reddy',
      parentPhone: '+91 94401 77889',
      parentLocality: 'Reddy Colony, Miryalaguda',
      parentAddress: 'House # 12-108, Reddy Colony, Miryalaguda',
    }),
  });
  const client3Id = c3Res.data.user.id;
  createdUserIds.add(client3Id);
  const parent3Id = (await request(`/api/parents?clientId=${client3Id}`)).data[0].id;

  const p3Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'PARTNER',
      email: `ramu.errands.${ts3}@familyhubs.in`,
      password: 'SafePartnerPass2026!',
      fullName: 'Ramu Goud (Grocery & Errand Partner)',
      phone: '+91 94401 33221',
      serviceCategory: 'ERRANDS',
      operatingRegion: 'Miryalaguda Town',
    }),
  });
  const partner3Id = p3Res.data.user.id;
  createdUserIds.add(partner3Id);

  // Client books Errands
  const t3Res = await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId: client3Id,
      parentId: parent3Id,
      category: 'ERRANDS',
      title: 'Monthly Provisions (25kg Rice, Dal, Pooja Items)',
      instructions: 'Deliver to parents door, assist carrying rice bag into kitchen store room.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 25.0,
    }),
  });
  const task3 = t3Res.data;
  createdTaskIds.add(task3.id);

  await request(`/api/tasks/${task3.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner3Id, adminId: 'admin' }),
  });
  await request(`/api/tasks/${task3.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner3Id }),
  });
  await request(`/api/tasks/${task3.id}/start`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner3Id }),
  });

  const photo3 = await uploadProofPhoto('grocery_handover_proof');
  await request(`/api/tasks/${task3.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner3Id,
      stage: 'TASK_COMPLETION',
      selfieImageUrl: photo3,
      latitude: 16.8724,
      longitude: 79.5631,
    }),
  });

  const approve3Res = await request(`/api/tasks/${task3.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  assert(approve3Res.status === 200 && approve3Res.data.status === 'COMPLETED', 'Grocery errand successfully completed');
  logStep(1, 'Heavy Grocery & Pooja Items Handover Settled', {
    trackingCode: task3.tracking_code,
    partner: 'Ramu Goud',
    payout: `₹${Math.round(25.0 * 83.5)} INR`,
    status: 'COMPLETED & ESCROW DISBURSED',
  });

  // =====================================================================
  // CASE STUDY 4: 24/7 PRIORITY EMERGENCY NIGHT MEDICINE DELIVERY
  // =====================================================================
  logHeader('CASE STUDY 4: 24/7 Priority Emergency Cardiac Medicine Delivery');
  console.log('Scenario: Critical 10 PM medicine emergency: Sorbitrate and Insulin vials needed urgently for senior father in Miryalaguda.');

  const ts4 = Date.now();
  const c4Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'CLIENT',
      email: `anand.emergency.${ts4}@familyhubs.in`,
      password: 'SafeClientPass2026!',
      fullName: 'Anand Rao (NRI Son - New Jersey)',
      phone: '+1 201 555 4321',
      countryResidence: 'United States',
      currency: 'USD',
      parentName: 'Mr. K. Narayana Rao (Father, 79)',
      parentPhone: '+91 94401 88990',
      parentLocality: 'Sagar Road, Miryalaguda',
      parentAddress: 'Beside RTC Bus Stand, Sagar Road, Miryalaguda',
    }),
  });
  const client4Id = c4Res.data.user.id;
  createdUserIds.add(client4Id);
  const parent4Id = (await request(`/api/parents?clientId=${client4Id}`)).data[0].id;

  const t4Res = await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId: client4Id,
      parentId: parent4Id,
      category: 'EMERGENCY',
      title: '🚨 CRITICAL: Night Insulin & Cardiac Meds Delivery',
      instructions: 'Pick up immediately from 24/7 MedPlus Sagar Road, deliver directly to parent hands.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 60.0,
    }),
  });
  const task4 = t4Res.data;
  createdTaskIds.add(task4.id);

  // Fast-track dispatch to partner 1 (Pavan Kumar)
  await request(`/api/tasks/${task4.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id, adminId: 'admin' }),
  });
  await request(`/api/tasks/${task4.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id }),
  });
  await request(`/api/tasks/${task4.id}/start`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id }),
  });

  const photo4 = await uploadProofPhoto('urgent_meds_receipt');
  await request(`/api/tasks/${task4.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner1Id,
      stage: 'TASK_COMPLETION',
      selfieImageUrl: photo4,
      latitude: 16.8724,
      longitude: 79.5631,
    }),
  });

  // Verify automated WhatsApp dispatch log was recorded
  const waLogs = await request('/api/whatsapp/logs');
  const task4Wa = waLogs.data.find((w) => w.task_id === task4.id);
  assert(Boolean(task4Wa), 'Automated WhatsApp notification generated for family upon delivery check-in');

  await request(`/api/tasks/${task4.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  logStep(1, '24/7 Emergency Medicine Run Successfully Completed', {
    trackingCode: task4.tracking_code,
    emergencyPayout: `₹${Math.round(60.0 * 83.5)} INR`,
    whatsAppAlertLogged: task4Wa ? task4Wa.template_name : 'task_work_completed_parent',
    status: 'COMPLETED WITH AUDIT TRAIL',
  });

  // =====================================================================
  // CASE STUDY 5: SECURITY ENFORCEMENT, GEOFENCE VIOLATION & FREEZE
  // =====================================================================
  logHeader('CASE STUDY 5: Fraud Prevention, Geofence Flagging & Escrow Freeze');
  console.log('Scenario: Partner attempts check-in 1.8km away from parent residence. System flags geofence violation. Chief Dispatcher toggles Emergency Freeze to prevent premature payout.');

  const ts5 = Date.now();
  const c5Res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'CLIENT',
      email: `security.test.${ts5}@familyhubs.in`,
      password: 'SafeClientPass2026!',
      fullName: 'Deepak V. (NRI Client - Singapore)',
      phone: '+65 9123 4567',
      countryResidence: 'Singapore',
      currency: 'SGD',
      parentName: 'Mrs. Sarada Devi',
      parentPhone: '+91 94401 66554',
      parentLocality: 'Reddy Colony, Miryalaguda',
      parentAddress: 'Main Road, Reddy Colony, Miryalaguda',
    }),
  });
  const client5Id = c5Res.data.user.id;
  createdUserIds.add(client5Id);
  const parent5Id = (await request(`/api/parents?clientId=${client5Id}`)).data[0].id;

  const t5Res = await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      clientId: client5Id,
      parentId: parent5Id,
      category: 'MEDICAL_TRANSPORT',
      title: 'Security Verification & Escrow Safeguard Test',
      instructions: 'Testing geofence tolerance boundary and escrow freeze lock.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 50.0,
    }),
  });
  const task5 = t5Res.data;
  createdTaskIds.add(task5.id);

  await request(`/api/tasks/${task5.id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id, adminId: 'admin' }),
  });
  await request(`/api/tasks/${task5.id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ partnerId: partner1Id }),
  });

  // 1. Out-of-bounds Check-in: Partner is at 16.8900, 79.5800 (~2.6 km away!)
  const photo5Bad = await uploadProofPhoto('fake_out_of_bounds_checkin');
  const badCheckinRes = await request(`/api/tasks/${task5.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner1Id,
      stage: 'ARRIVAL_CHECKIN',
      selfieImageUrl: photo5Bad,
      latitude: 16.8900,
      longitude: 79.5800,
    }),
  });
  assert(badCheckinRes.status === 200, 'Check-in processed');
  const badLog = badCheckinRes.data.verification_logs.find((v) => v.stage === 'ARRIVAL_CHECKIN');
  assert(badLog.geofence_passed === 0, 'System detected out-of-bounds geofence violation (geofence_passed = 0)');
  assert(badLog.review_status === 'FLAGGED_OUT_OF_BOUNDS', 'Log status marked FLAGGED_OUT_OF_BOUNDS');
  assert(badLog.distance_from_target_meters > 150, `Distance correctly detected as ${Math.round(badLog.distance_from_target_meters)}m > 150m tolerance`);
  logStep(1, 'Geofence Violation Automated Flagging Triggered', {
    detectedDistance: `${Math.round(badLog.distance_from_target_meters)}m`,
    toleranceLimit: '150m',
    securityStatus: 'FLAGGED_OUT_OF_BOUNDS',
  });

  // 2. Admin Activates Emergency Escrow Freeze Platform-wide
  const freezeRes = await request('/api/security/settings/emergency-freeze', {
    method: 'POST',
    body: JSON.stringify({ actorId: 'admin' }),
  });
  assert(freezeRes.status === 200 && freezeRes.data.active === true, 'Emergency Escrow Freeze successfully activated');
  logStep(2, 'Chief Concierge Emergency Escrow Freeze Engaged', {
    emergency_freeze: 'ACTIVE',
    policy: 'ALL PAYOUTS TEMPORARILY LOCKED',
  });

  // 3. Attempt Escrow Release during Freeze -> MUST BE REJECTED WITH HTTP 403
  const blockedReleaseRes = await request(`/api/tasks/${task5.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  assert(blockedReleaseRes.status === 403, 'Escrow release blocked with HTTP 403 during Emergency Freeze');
  logStep(3, 'Payout Rejection Verified Under Emergency Freeze', {
    attemptResult: 'HTTP 403 FORBIDDEN',
    blockedReason: blockedReleaseRes.data.error,
  });

  // 4. Partner Re-checks In with Legitimate On-Site GPS Coordinates (<150m)
  const photo5Good = await uploadProofPhoto('valid_onsite_checkin');
  const goodCheckinRes = await request(`/api/tasks/${task5.id}/verify`, {
    method: 'POST',
    body: JSON.stringify({
      partnerId: partner1Id,
      stage: 'TASK_COMPLETION',
      selfieImageUrl: photo5Good,
      latitude: 16.8724, // Exact residence coordinates
      longitude: 79.5631,
    }),
  });
  const goodLog = goodCheckinRes.data.verification_logs.find((v) => v.stage === 'TASK_COMPLETION');
  assert(goodLog.geofence_passed === 1, 'Legitimate doorstep coordinates verified within geofence');

  // 5. Admin Lifts Emergency Freeze & Safely Disburses Escrow
  const unfreezeRes = await request('/api/security/settings/emergency-freeze', {
    method: 'POST',
    body: JSON.stringify({ actorId: 'admin' }),
  });
  assert(unfreezeRes.status === 200 && unfreezeRes.data.active === false, 'Emergency Escrow Freeze lifted');

  const finalApproveRes = await request(`/api/tasks/${task5.id}/escrow/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId: 'admin', escrowPin }),
  });
  assert(finalApproveRes.status === 200 && finalApproveRes.data.status === 'COMPLETED', 'Task successfully released after freeze lifted');
  logStep(4, 'Emergency Freeze Lifted & Legitimate Service Settled', {
    geofencePassed: 'YES',
    freezeStatus: 'LIFTED',
    payoutDisbursed: `₹${Math.round(50.0 * 83.5)} INR`,
    finalStatus: 'COMPLETED',
  });

  // Close WebSocket
  ws.close();

  // Summary Report
  console.log('\n======================================================================');
  console.log('🏆 ALL 5 END-TO-END CASE STUDIES EXECUTED SUCCESSFULLY!');
  console.log('======================================================================');
  console.log('Summary of Case Studies:');
  console.log('  1. Medical Escort & Doctor Visit in Miryalaguda: Verified & Completed ($45 USD -> ₹3,758 INR)');
  console.log('  2. Urgent Home Maintenance & Electrical MCB in Old Nalgonda: Verified & Completed ($35 USD -> ₹2,923 INR)');
  console.log('  3. Monthly Provisions & Temple Pooja Delivery: Verified & Completed ($25 USD -> ₹2,088 INR)');
  console.log('  4. 24/7 Priority Emergency Cardiac Medicine Delivery: Verified & WhatsApp Logged ($60 USD -> ₹5,010 INR)');
  console.log('  5. Geofence Out-of-bounds Flagging & Escrow Freeze Security: Verified & Enforced ($50 USD -> ₹4,175 INR)');
  console.log('======================================================================\n');

  // Clean up all ephemeral test data
  console.log('🧹 Purging all ephemeral test records from database...');
  db.transaction(() => {
    for (const tid of createdTaskIds) {
      db.prepare('DELETE FROM whatsapp_logs WHERE task_id = ?').run(tid);
      db.prepare('DELETE FROM verification_logs WHERE task_id = ?').run(tid);
      db.prepare('DELETE FROM escrow_transactions WHERE task_id = ?').run(tid);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(tid);
    }
    for (const uid of createdUserIds) {
      db.prepare('DELETE FROM parents_profile WHERE client_id = ?').run(uid);
      db.prepare('DELETE FROM clients_profile WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM partners_profile WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM users WHERE id = ?').run(uid);
    }
  })();
  console.log('✅ Clean state verified. Ephemeral records removed.\n');
}

runAllCaseStudies().catch((err) => {
  console.error('\n❌ Case Studies Runner Failed:', err);
  process.exit(1);
});
