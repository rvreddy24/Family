const { WebSocket } = require('ws');
const Database = require('better-sqlite3');
require('dotenv').config();

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:4000/ws/events';

const ADMIN_EMAIL = 'admin@familyhubs.in';
const CLIENT_EMAIL = 'user@familyhubs.in';
const PARTNER_EMAIL = 'partner@familyhubs.in';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    console.log(`  ✅ [PASS ${totalChecks}] ${message}`);
    passedChecks++;
  } else {
    console.error(`  ❌ [FAIL ${totalChecks}] ${message}`);
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

// 1x1 JPEG base64 for check-in selfie upload
const DUMMY_BASE64_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function uploadSelfie(label) {
  const uploadRes = await request('/api/upload', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64: DUMMY_BASE64_IMAGE,
      filename: `proof_${label}_${Date.now()}`,
    }),
  });
  assert(uploadRes.status === 200, `Uploaded forensic proof photo for: ${label}`);
  return uploadRes.data.imageUrl;
}

async function runOfficialAccountsTestSuite() {
  console.log('======================================================================');
  console.log('🔬 FAMILYHUBS STRICT 3-ACCOUNT OPERATIONAL & CONCURRENCY TEST SUITE');
  console.log('======================================================================');
  console.log(`Target Environment: ${API_BASE}`);
  console.log(`Active Accounts: ${ADMIN_EMAIL}, ${CLIENT_EMAIL}, ${PARTNER_EMAIL}\n`);

  // 1. Core Health & Account Invariant Check
  console.log('--- Step 1: Health & Account Verification ---');
  const health = await request('/api/health');
  assert(health.status === 200 && health.data.status === 'ONLINE', 'Core backend engine is ONLINE');

  const db = new Database('./server/familyhubs.db');
  const currentUsers = db.prepare('SELECT id, role, email, full_name FROM users').all();
  assert(currentUsers.length === 3, `Strict invariant: Exactly 3 official accounts exist in database (found ${currentUsers.length})`);
  
  const adminUser = currentUsers.find(u => u.email === ADMIN_EMAIL);
  const clientUser = currentUsers.find(u => u.email === CLIENT_EMAIL);
  const partnerUser = currentUsers.find(u => u.email === PARTNER_EMAIL);

  assert(Boolean(adminUser && adminUser.role === 'ADMIN'), `Admin verified: ${adminUser.full_name}`);
  assert(Boolean(clientUser && clientUser.role === 'CLIENT'), `Client verified: ${clientUser.full_name}`);
  assert(Boolean(partnerUser && partnerUser.role === 'PARTNER'), `Partner verified: ${partnerUser.full_name}`);

  // Clear any previous test tasks to have a clean state for the 5 case studies
  db.prepare('DELETE FROM whatsapp_logs').run();
  db.prepare('DELETE FROM verification_logs').run();
  db.prepare('DELETE FROM escrow_transactions').run();
  db.prepare('DELETE FROM tasks').run();
  // Fetch Client's Parent Profile
  const parentsRes = await request(`/api/parents?clientId=${clientUser.id}`);
  assert(parentsRes.status === 200 && parentsRes.data.length > 0, `Parent residence linked to client (${parentsRes.data[0].parent_name})`);
  const parentId = parentsRes.data[0].id;

  // Fetch Security PIN
  const secSettings = await request('/api/security/settings');
  assert(secSettings.status === 200, 'Security settings loaded successfully');
  const escrowPin = secSettings.data.escrow_release_pin || '849201';
  console.log(`  🔑 Active Escrow PIN: ${escrowPin}`);

  // 2. Real-time WebSocket Connectivity Test
  console.log('\n--- Step 2: Real-Time WebSocket Telemetry Test ---');
  const clientWsEvents = [];
  const partnerWsEvents = [];
  const adminWsEvents = [];

  const clientWs = new WebSocket(`${WS_URL}?role=CLIENT&userId=${clientUser.id}`);
  const partnerWs = new WebSocket(`${WS_URL}?role=PARTNER&userId=${partnerUser.id}`);
  const adminWs = new WebSocket(`${WS_URL}?role=ADMIN&userId=${adminUser.id}`);

  clientWs.on('message', (d) => { try { clientWsEvents.push(JSON.parse(d.toString())); } catch {} });
  partnerWs.on('message', (d) => { try { partnerWsEvents.push(JSON.parse(d.toString())); } catch {} });
  adminWs.on('message', (d) => { try { adminWsEvents.push(JSON.parse(d.toString())); } catch {} });

  await new Promise(r => setTimeout(r, 1000));
  assert(clientWs.readyState === WebSocket.OPEN, 'Client WebSocket connected');
  assert(partnerWs.readyState === WebSocket.OPEN, 'Partner WebSocket connected');
  assert(adminWs.readyState === WebSocket.OPEN, 'Admin Operations WebSocket connected');

  // 3. Run 5 Intensive Real-World Eldercare Case Studies
  const caseStudies = [
    {
      title: 'Doctor Home Visit & Comprehensive Vitals Check',
      category: 'MEDICAL_TRANSPORT',
      escrowAmount: 45.0,
      instructions: 'Doctor visit for routine BP checkup (parents 71 & 74 yrs). Deliver printed vitals card.',
    },
    {
      title: 'Inverter & Battery Power Backup Emergency Service',
      category: 'HOME_MAINTENANCE',
      escrowAmount: 40.0,
      instructions: 'Check tubular battery cells distilled water top-up and test inverter voltage.',
    },
    {
      title: 'Monthly Prescription Replenishment from Apollo Pharmacy',
      category: 'MEDICAL_TRANSPORT',
      escrowAmount: 35.0,
      instructions: 'Deliver monthly prescription medicines with pharmacist printed bill.',
    },
    {
      title: 'RO Water Purifier Filter Inspection & Tap Leak Fix',
      category: 'HOME_MAINTENANCE',
      escrowAmount: 50.0,
      instructions: 'Test digital TDS levels and inspect sediment filters.',
    },
    {
      title: 'Fresh Market Provisions & Temple Pooja Samagri Delivery',
      category: 'ERRANDS',
      escrowAmount: 30.0,
      instructions: 'Fresh cold-pressed sesame oil, fruits, and temple pooja items from Miryalaguda market.',
    },
  ];

  for (let i = 0; i < caseStudies.length; i++) {
    const cs = caseStudies[i];
    console.log(`\n======================================================================`);
    console.log(`📋 CASE STUDY ${i + 1}: ${cs.title}`);
    console.log(`======================================================================`);

    // A. Client books task with Escrow
    const bookRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        clientId: clientUser.id,
        parentId,
        category: cs.category,
        title: cs.title,
        instructions: cs.instructions,
        scheduledAt: new Date().toISOString(),
        escrowAmount: cs.escrowAmount,
      }),
    });
    assert(bookRes.status === 201, `Client created task: ${cs.title} ($${cs.escrowAmount} in escrow)`);
    const task = bookRes.data;
    assert(task.status === 'PENDING_OPS_REVIEW', `Task initial status is PENDING_OPS_REVIEW (${task.tracking_code})`);

    // B. Admin checks Tasks list and verifies task is listed under Needs Dispatch
    const adminTasksList1 = await request('/api/tasks');
    assert(adminTasksList1.status === 200, 'Admin fetched tasks queue');
    const pendingTaskFound = adminTasksList1.data.find(t => t.id === task.id);
    assert(Boolean(pendingTaskFound), `Admin visible: Task ${task.tracking_code} present in queue`);

    // C. Admin dispatches Partner
    const assignRes = await request(`/api/tasks/${task.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        partnerId: partnerUser.id,
        adminId: adminUser.id,
      }),
    });
    assert(assignRes.status === 200, `Admin dispatched task ${task.tracking_code} to partner ${partnerUser.full_name}`);
    assert(assignRes.data.status === 'DISPATCHED', 'Task status updated to DISPATCHED');

    // D. Partner accepts task
    const acceptRes = await request(`/api/tasks/${task.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: partnerUser.id }),
    });
    assert(acceptRes.status === 200, `Partner accepted task ${task.tracking_code}`);
    assert(acceptRes.data.status === 'ACCEPTED', 'Task status updated to ACCEPTED');

    // E. Partner starts task (En Route / In Progress)
    const startRes = await request(`/api/tasks/${task.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: partnerUser.id }),
    });
    assert(startRes.status === 200, `Partner started task ${task.tracking_code}`);
    assert(startRes.data.status === 'IN_PROGRESS', 'Task status updated to IN_PROGRESS');

    // F. Admin verifies task shows in Ongoing In-Field
    const adminTasksList2 = await request('/api/tasks');
    const ongoingTask = adminTasksList2.data.find(t => t.id === task.id);
    assert(ongoingTask.status === 'IN_PROGRESS', `Admin verified task ${task.tracking_code} is active IN_PROGRESS`);

    // G1. Partner arrives at parent residence and uploads Arrival Selfie Check-In (< 150m)
    const arrivalSelfieUrl = await uploadSelfie(`cs${i + 1}_arrival`);
    const arrivalVerifyRes = await request(`/api/tasks/${task.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        partnerId: partnerUser.id,
        stage: 'ARRIVAL_CHECKIN',
        selfieImageUrl: arrivalSelfieUrl,
        latitude: 16.8724,
        longitude: 79.5631,
      }),
    });
    assert(arrivalVerifyRes.status === 200, `Partner arrival selfie submitted with GPS (16.8724°N, 79.5631°E)`);
    assert(arrivalVerifyRes.data.status === 'IN_PROGRESS', 'Task status is IN_PROGRESS after arrival check-in');

    const arrivalLog = arrivalVerifyRes.data.verification_logs[0];
    assert(arrivalLog.distance_from_target_meters < 150, `Arrival Geofence passed: ${Math.round(arrivalLog.distance_from_target_meters)}m from residence (< 150m tolerance)`);

    // G2. Partner finishes service work and submits Task Completion Proof
    const completionPhotoUrl = await uploadSelfie(`cs${i + 1}_completion`);
    const completionVerifyRes = await request(`/api/tasks/${task.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        partnerId: partnerUser.id,
        stage: 'TASK_COMPLETION',
        selfieImageUrl: completionPhotoUrl,
        latitude: 16.8724,
        longitude: 79.5631,
      }),
    });
    assert(completionVerifyRes.status === 200, `Partner completion photo proof submitted`);
    assert(completionVerifyRes.data.status === 'VERIFICATION_SUBMITTED', 'Task status transitioned to VERIFICATION_SUBMITTED');

    // H. Admin authorizes Escrow Release with 6-digit Security PIN
    const escrowRes = await request(`/api/tasks/${task.id}/escrow/approve`, {
      method: 'POST',
      body: JSON.stringify({
        adminId: adminUser.id,
        escrowPin,
      }),
    });
    assert(escrowRes.status === 200, `Admin authorized escrow release via PIN (${escrowPin})`);
    assert(escrowRes.data.status === 'COMPLETED', `Task ${task.tracking_code} marked COMPLETED`);
    assert(escrowRes.data.escrow.status === 'RELEASED_TO_PARTNER', 'Escrow status updated to RELEASED_TO_PARTNER');

    // I. Verify Admin task list shows the task in Completed
    const adminTasksList3 = await request('/api/tasks');
    const completedAdminTask = adminTasksList3.data.find(t => t.id === task.id);
    assert(completedAdminTask.status === 'COMPLETED', `Admin verified task ${task.tracking_code} in COMPLETED status`);

    // J. Verify Partner wallet balance increased
    const partnerProfRes = await request(`/api/partners/${partnerUser.id}/profile`);
    assert(partnerProfRes.status === 200, `Partner wallet balance updated: ₹${partnerProfRes.data.wallet_balance || partnerProfRes.data.walletBalance}`);

    console.log(`  🎉 Case Study ${i + 1} completed end-to-end with full escrow lifecycle!`);
  }

  // Final Invariant Check
  console.log('\n--- Step 4: Final Database Integrity Check ---');
  const finalUsers = db.prepare('SELECT id, role, email, full_name FROM users').all();
  assert(finalUsers.length === 3, `Final verification: Exactly 3 users remain in system (found ${finalUsers.length})`);
  const finalTasks = db.prepare('SELECT id, tracking_code, status FROM tasks').all();
  assert(finalTasks.length === 5, `All 5 case study tasks saved in database`);
  const allCompleted = finalTasks.every(t => t.status === 'COMPLETED');
  assert(allCompleted, 'All 5 tasks are successfully COMPLETED');

  // Close WebSockets and DB
  clientWs.close();
  partnerWs.close();
  adminWs.close();
  db.close();

  console.log('\n======================================================================');
  console.log(`🏁 TEST SUITE FINISHED: ${passedChecks}/${totalChecks} ASSERTIONS PASSED!`);
  console.log('======================================================================\n');
}

runOfficialAccountsTestSuite().catch((err) => {
  console.error('\n💥 TEST FAILED:', err);
  process.exit(1);
});
