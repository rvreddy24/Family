const { WebSocket } = require('ws');
const Database = require('better-sqlite3');
require('dotenv').config();

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:4000/ws/events';

const CLIENT_ID = 'c11e4701-0000-4000-8000-000000000001';
const PARTNER_ID = 'b22e4702-0000-4000-8000-000000000002';
const ADMIN_ID = '8c7b8a7c-e474-49be-a9ba-ba780a5d056c';

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

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

async function runTrioLiveCycleTest() {
  console.log('======================================================================');
  console.log('🔄 TESTING FULL LIVE INTERCONNECTION CYCLE (ADMIN + USER + PARTNER)');
  console.log('======================================================================');

  // Verify only 3 accounts exist in SQLite
  const db = new Database('./server/familyhubs.db');
  const allUsers = db.prepare('SELECT id, role, email FROM users').all();
  assert(allUsers.length === 3, `Strictly 3 accounts present in SQLite (Found ${allUsers.length})`);
  allUsers.forEach(u => console.log(`    • ${u.role}: ${u.email} (${u.id})`));

  // Connect 3 concurrent WebSockets
  console.log('\n--- 1. Establishing Real-Time WebSocket Connections for all 3 Users ---');
  const clientEvents = [];
  const partnerEvents = [];
  const adminEvents = [];

  const wsClient = new WebSocket(`${WS_URL}?role=CLIENT&userId=${CLIENT_ID}`);
  const wsPartner = new WebSocket(`${WS_URL}?role=PARTNER&userId=${PARTNER_ID}`);
  const wsAdmin = new WebSocket(`${WS_URL}?role=ADMIN&userId=${ADMIN_ID}`);

  await Promise.all([
    new Promise(r => wsClient.on('open', r)),
    new Promise(r => wsPartner.on('open', r)),
    new Promise(r => wsAdmin.on('open', r)),
  ]);

  wsClient.on('message', d => { try { clientEvents.push(JSON.parse(d)); } catch {} });
  wsPartner.on('message', d => { try { partnerEvents.push(JSON.parse(d)); } catch {} });
  wsAdmin.on('message', d => { try { adminEvents.push(JSON.parse(d)); } catch {} });

  assert(wsClient.readyState === WebSocket.OPEN, 'Client WebSocket connected');
  assert(wsPartner.readyState === WebSocket.OPEN, 'Partner WebSocket connected');
  assert(wsAdmin.readyState === WebSocket.OPEN, 'Admin WebSocket connected');

  let activeTaskId = null;

  try {
    // 2. Client Profile & Parents Verification
    console.log('\n--- 2. Client Views Parents Profile ---');
    const parentsRes = await request(`/api/parents?clientId=${CLIENT_ID}`);
    assert(parentsRes.status === 200 && parentsRes.data.length > 0, 'Client parents profile loaded');
    const parent = parentsRes.data[0];
    console.log(`    • Parent: ${parent.parent_name} in ${parent.locality}`);

    // 3. Client Books a Care Request ($45.00 Escrow)
    console.log('\n--- 3. Client Books Doctor Escort Service with Pre-funded Escrow ---');
    const taskPayload = {
      clientId: CLIENT_ID,
      parentId: parent.id,
      category: 'MEDICAL_TRANSPORT',
      title: 'Trio Live Test Doctor Escort & Health Vitals',
      instructions: 'Accompany parents to clinical vitals checkup and collect prescription.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 45.0,
    };

    const taskRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskPayload),
    });
    assert(taskRes.status === 201, 'Task created with HTTP 201');
    const task = taskRes.data;
    activeTaskId = task.id;
    assert(task.tracking_code.startsWith('FH-'), `Tracking code generated: ${task.tracking_code}`);
    assert(task.status === 'PENDING_OPS_REVIEW', 'Task status is PENDING_OPS_REVIEW');
    assert(task.escrow.status === 'HOLD_IN_ESCROW', 'Escrow funds securely locked ($45.00 USD)');

    // Verify Admin WS received TASK_CREATED event
    await new Promise(r => setTimeout(r, 600));
    const adminCreatedEvent = adminEvents.find(e => e.type === 'TASK_CREATED' && e.payload.id === task.id);
    assert(Boolean(adminCreatedEvent), 'Admin received real-time WebSocket event: TASK_CREATED');

    // 4. Admin Dispatches Task to the Single Field Partner
    console.log('\n--- 4. Admin Triages & Dispatches Task to Field Partner ---');
    const assignRes = await request(`/api/tasks/${task.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: PARTNER_ID, adminId: ADMIN_ID }),
    });
    assert(assignRes.status === 200, 'Admin successfully dispatched task');
    assert(assignRes.data.status === 'DISPATCHED', 'Task status updated to DISPATCHED');
    assert(assignRes.data.assigned_partner_id === PARTNER_ID, 'Assigned partner is Pavan Kumar');

    await new Promise(r => setTimeout(r, 600));
    const partnerDispatchedEvent = partnerEvents.find(e => e.type === 'TASK_DISPATCHED' && e.payload.id === task.id);
    assert(Boolean(partnerDispatchedEvent), 'Partner received real-time WebSocket event: TASK_DISPATCHED');

    // 5. Partner Accepts and Starts Task
    console.log('\n--- 5. Partner Accepts & Commences Service ---');
    const acceptRes = await request(`/api/tasks/${task.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: PARTNER_ID }),
    });
    assert(acceptRes.status === 200 && acceptRes.data.status === 'ACCEPTED', 'Partner accepted task');

    const startRes = await request(`/api/tasks/${task.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: PARTNER_ID }),
    });
    assert(startRes.status === 200 && startRes.data.status === 'IN_PROGRESS', 'Partner commenced transit to parents');

    // 6. Partner Uploads Photo Proof and Live GPS Check-in
    console.log('\n--- 6. Partner Logs Arrival Photo & GPS Check-In ---');
    const dummyPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const uploadRes = await request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: dummyPhoto,
        filename: `trio_test_arrival_${Date.now()}`,
      }),
    });
    assert(uploadRes.status === 200, 'Verification photo uploaded');

    const checkinRes = await request(`/api/tasks/${task.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        partnerId: PARTNER_ID,
        stage: 'ARRIVAL_CHECKIN',
        selfieImageUrl: uploadRes.data.imageUrl,
        latitude: 16.8724,
        longitude: 79.5631,
      }),
    });
    assert(checkinRes.status === 200, 'Check-in processed successfully');
    const checkinLog = checkinRes.data.verification_logs[0];
    assert(checkinLog.geofence_passed === 1, 'Geofence passed (distance <= 150m)');

    await new Promise(r => setTimeout(r, 600));
    const adminCheckinEvent = adminEvents.find(e => e.type === 'PARTNER_CHECKED_IN');
    assert(Boolean(adminCheckinEvent), 'Admin received real-time WebSocket event: PARTNER_CHECKED_IN');

    // Verify WhatsApp automated message generated
    const waLogs = await request('/api/whatsapp/logs');
    const taskWa = waLogs.data.find(w => w.task_id === task.id);
    assert(Boolean(taskWa), 'Automated WhatsApp arrival alert dispatched to parent');

    // 7. Admin Audits Photo Proof & Releases Escrow with 6-Digit PIN
    console.log('\n--- 7. Admin Authorizes Escrow Release with Security PIN ---');
    const secSettings = await request('/api/security/settings');
    const escrowPin = secSettings.data.escrow_release_pin;

    const partnerBefore = await request(`/api/partners/${PARTNER_ID}/profile`);
    const balanceBefore = partnerBefore.data.wallet_balance;

    const approveRes = await request(`/api/tasks/${task.id}/escrow/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminId: ADMIN_ID, escrowPin }),
    });
    assert(approveRes.status === 200, 'Escrow release authorized by Admin');
    assert(approveRes.data.status === 'COMPLETED', 'Task status is COMPLETED');
    assert(approveRes.data.escrow.status === 'RELEASED_TO_PARTNER', 'Escrow status is RELEASED_TO_PARTNER');

    const partnerAfter = await request(`/api/partners/${PARTNER_ID}/profile`);
    const expectedPayout = Math.round(45.0 * 83.5);
    assert(partnerAfter.data.wallet_balance === balanceBefore + expectedPayout, `Partner wallet credited by ₹${expectedPayout} INR`);

    await new Promise(r => setTimeout(r, 600));
    const clientEscrowEvent = clientEvents.find(e => e.type === 'ESCROW_RELEASED');
    assert(Boolean(clientEscrowEvent), 'Client received real-time WebSocket event: ESCROW_RELEASED');

    // 8. Admin Security Controls: Emergency Escrow Freeze Toggle
    console.log('\n--- 8. Admin Security Controls: Emergency Escrow Freeze Toggle ---');
    const freezeOn = await request('/api/security/panic-freeze', {
      method: 'POST',
      body: JSON.stringify({ actorId: ADMIN_ID }),
    });
    assert(freezeOn.status === 200 && freezeOn.data.active === true, 'Emergency Freeze activated');

    const freezeOff = await request('/api/security/panic-freeze', {
      method: 'POST',
      body: JSON.stringify({ actorId: ADMIN_ID }),
    });
    assert(freezeOff.status === 200 && freezeOff.data.active === false, 'Emergency Freeze lifted');

    console.log('\n======================================================================');
    console.log('🎉 ALL INTERCONNECTION FUNCTIONS SUCCEEDED BETWEEN THE 3 ACCOUNTS!');
    console.log('======================================================================');
  } finally {
    // Close WebSockets cleanly
    wsClient.close();
    wsPartner.close();
    wsAdmin.close();

    // Clean up the single ephemeral test task and logs so NO dangling records exist
    if (activeTaskId) {
      console.log('\n🧹 Purging ephemeral test task records...');
      db.transaction(() => {
        db.prepare('DELETE FROM whatsapp_logs WHERE task_id = ?').run(activeTaskId);
        db.prepare('DELETE FROM verification_logs WHERE task_id = ?').run(activeTaskId);
        db.prepare('DELETE FROM escrow_transactions WHERE task_id = ?').run(activeTaskId);
        db.prepare('DELETE FROM tasks WHERE id = ?').run(activeTaskId);
      })();
      console.log('✅ Ephemeral test task purged cleanly.');
    }

    // Final verification: Confirm strictly 3 accounts remain
    const finalUsers = db.prepare('SELECT id, role, email FROM users').all();
    console.log('\nFinal Accounts Count in System:', finalUsers.length);
    finalUsers.forEach(u => console.log(`  • ${u.role}: ${u.email}`));
    assert(finalUsers.length === 3, 'Exactly 3 accounts remain in system!');
  }
}

runTrioLiveCycleTest().catch(err => {
  console.error('\n❌ Trio Live Cycle Test Failed:', err);
  process.exit(1);
});
