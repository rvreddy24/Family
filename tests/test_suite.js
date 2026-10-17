const { WebSocket } = require('ws');
const db = require('better-sqlite3')('./server/familyhubs.db');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:4000/ws/events';

let testResults = [];
let createdClientUserId = null;
let createdPartnerUserId = null;
let createdTaskId = null;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testResults.push({ message, status: 'PASS' });
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testResults.push({ message, status: 'FAIL' });
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting FamilyHubs Enterprise Automated Test Suite');
  console.log('====================================================\n');

  try {
    // Test 1: Health Check
    console.log('--- Test 1: Backend Engine Health Check ---');
    const health = await request('/api/health');
    assert(health.status === 200, 'Health endpoint responds with HTTP 200');
    assert(health.data.status === 'ONLINE', 'System status is ONLINE');
    assert(typeof health.data.uptime === 'number', 'Uptime counter is numeric');

    // Test 2: WebSocket Connection & Handshake
    console.log('\n--- Test 2: Real-Time WebSocket Handshake ---');
    const wsEvents = [];
    const ws = new WebSocket(`${WS_URL}?role=ADMIN&userId=test_ops_admin`);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        assert(ws.readyState === WebSocket.OPEN, 'WebSocket connection opened successfully');
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          wsEvents.push(msg);
          if (msg.type === 'CONNECTED') {
            assert(msg.payload.role === 'ADMIN', 'WebSocket handshake authenticated as ADMIN');
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
    });

    // Test 3: Security Settings & Core Configuration
    console.log('\n--- Test 3: Core Settings & Security Config ---');
    const sec = await request('/api/security/settings');
    assert(sec.status === 200, 'Security settings retrieved');
    assert(typeof sec.data.escrow_release_pin === 'string', 'Escrow release PIN exists');
    assert(sec.data.geofence_tolerance_meters === '150', 'Default geofence tolerance is 150m');

    // Test 4: Dynamic Dynamic Client & Parent Registration
    console.log('\n--- Test 4: Client & Parent Self-Registration ---');
    const testTimestamp = Date.now();
    const clientPayload = {
      role: 'CLIENT',
      email: `test.client.${testTimestamp}@familyhubs.in`,
      password: 'SecureTestPassword123!',
      fullName: 'Test NRI Client',
      phone: '+1 408 555 0199',
      countryResidence: 'United States',
      currency: 'USD',
      subscriptionTier: 'GOLD',
      parentName: 'Test Parent (Lakshmi & Ramana)',
      parentPhone: '+91 94901 00000',
      parentLocality: 'Reddy Colony, Miryalaguda',
      parentAddress: 'Beside Temple, Reddy Colony, Miryalaguda',
      parentNotes: 'Routine BP checks',
    };

    const regClientRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(clientPayload),
    });
    assert(regClientRes.status === 201, 'Client registered successfully with HTTP 201');
    createdClientUserId = regClientRes.data.user.id;

    const parents = await request(`/api/parents?clientId=${createdClientUserId}`);
    assert(parents.status === 200 && Array.isArray(parents.data), 'Client parents profile loaded');
    assert(parents.data.length > 0, 'Parent profile registered dynamically');
    const parentId = parents.data[0].id;

    // Test 5: Dynamic Partner Self-Registration
    console.log('\n--- Test 5: Field Partner Registration & KYC ---');
    const partnerPayload = {
      role: 'PARTNER',
      email: `test.partner.${testTimestamp}@familyhubs.in`,
      password: 'SecurePartnerPassword123!',
      fullName: 'Test Field Partner',
      phone: '+91 94401 99999',
      serviceCategory: 'MEDICAL_TRANSPORT',
      operatingRegion: 'Miryalaguda Town & Rural Hub',
    };

    const regPartnerRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(partnerPayload),
    });
    assert(regPartnerRes.status === 201, 'Partner registered successfully with HTTP 201');
    createdPartnerUserId = regPartnerRes.data.user.id;

    // Test 6: Task Creation (Escrow Lock)
    console.log('\n--- Test 6: Task Creation & Escrow Locking ---');
    const taskPayload = {
      clientId: createdClientUserId,
      parentId: parentId,
      category: 'MEDICAL_TRANSPORT',
      title: 'Automated Test Doctor Escort & Health Vitals',
      instructions: 'Accompany parents to clinical vitals screening.',
      scheduledAt: new Date().toISOString(),
      escrowAmount: 45.0,
    };

    const createRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskPayload),
    });

    assert(createRes.status === 201, 'Task created with HTTP 201');
    const createdTask = createRes.data;
    createdTaskId = createdTask.id;
    assert(createdTask.tracking_code.startsWith('FH-'), `Valid tracking code generated: ${createdTask.tracking_code}`);
    assert(createdTask.status === 'PENDING_OPS_REVIEW', 'Initial task status is PENDING_OPS_REVIEW');
    assert(createdTask.escrow && createdTask.escrow.status === 'HOLD_IN_ESCROW', 'Escrow funds successfully locked in HOLD_IN_ESCROW');
    assert(createdTask.escrow.amount === 45.0, 'Escrow amount is $45.00');

    // Verify WebSocket event for TASK_CREATED
    await new Promise((r) => setTimeout(r, 600));
    const createdEvent = wsEvents.find((e) => e.type === 'TASK_CREATED' && e.payload.id === createdTask.id);
    assert(Boolean(createdEvent), 'WebSocket broadcasted TASK_CREATED event to active subscribers');

    // Test 7: Operations Dispatches Task to Partner
    console.log('\n--- Test 7: Operations Partner Dispatch ---');
    const assignRes = await request(`/api/tasks/${createdTask.id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: createdPartnerUserId, adminId: 'test_ops_admin' }),
    });
    assert(assignRes.status === 200, 'Task dispatched to partner');
    assert(assignRes.data.status === 'DISPATCHED', 'Task status updated to DISPATCHED');
    assert(assignRes.data.assigned_partner_id === createdPartnerUserId, 'Partner successfully assigned');

    // Test 8: Partner Accepts & Commences Task
    console.log('\n--- Test 8: Partner Accepts & Commences Task ---');
    const acceptRes = await request(`/api/tasks/${createdTask.id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: createdPartnerUserId }),
    });
    assert(acceptRes.status === 200, 'Partner accepted task');
    assert(acceptRes.data.status === 'ACCEPTED', 'Task status is ACCEPTED');

    const startRes = await request(`/api/tasks/${createdTask.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: createdPartnerUserId }),
    });
    assert(startRes.status === 200, 'Partner commenced task');
    assert(startRes.data.status === 'IN_PROGRESS', 'Task status is IN_PROGRESS');

    // Test 9: Forensic Verification Photo & Geofence Check
    console.log('\n--- Test 9: Forensic Verification & Haversine Geofence ---');
    const uploadRes = await request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        filename: `test_proof_${Date.now()}`,
      }),
    });
    assert(uploadRes.status === 200, 'Photo uploaded successfully');
    assert(uploadRes.data.imageUrl.startsWith('/uploads/') || uploadRes.data.imageUrl.startsWith('http'), 'Upload returned safe image URL path');

    const verifyRes = await request(`/api/tasks/${createdTask.id}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        partnerId: createdPartnerUserId,
        stage: 'ARRIVAL_CHECKIN',
        selfieImageUrl: uploadRes.data.imageUrl,
        latitude: 16.8724, // Exact residence coordinate
        longitude: 79.5631,
      }),
    });
    assert(verifyRes.status === 200, 'Verification check-in submitted');
    const verifiedTask = verifyRes.data;
    assert(verifiedTask.verification_logs.length > 0, 'Verification log recorded on task');
    assert(verifiedTask.verification_logs[0].distance_from_target_meters <= 150, 'Computed distance is within 150m geofence tolerance');

    // Test 10: Escrow Release Authorization with PIN
    console.log('\n--- Test 10: Escrow Release Authorization with PIN ---');
    const escrowPin = sec.data.escrow_release_pin;

    // Invalid PIN check
    const badPinRes = await request(`/api/tasks/${createdTask.id}/escrow/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminId: 'test_ops_admin', escrowPin: '000000' }),
    });
    assert(badPinRes.status === 403, 'System rejected unauthorized escrow PIN with HTTP 403');

    // Correct PIN release
    const partnerBefore = await request(`/api/partners/${createdPartnerUserId}/profile`);
    const initialBalance = partnerBefore.data.wallet_balance;

    const approveRes = await request(`/api/tasks/${createdTask.id}/escrow/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminId: 'test_ops_admin', escrowPin }),
    });
    assert(approveRes.status === 200, 'Escrow release successfully authorized with valid PIN');
    assert(approveRes.data.status === 'COMPLETED', 'Task status updated to COMPLETED');
    assert(approveRes.data.escrow.status === 'RELEASED_TO_PARTNER', 'Escrow status transitioned to RELEASED_TO_PARTNER');

    const partnerAfter = await request(`/api/partners/${createdPartnerUserId}/profile`);
    const expectedPayoutInr = Math.round(45.0 * 83.5);
    assert(
      partnerAfter.data.wallet_balance === initialBalance + expectedPayoutInr,
      `Partner wallet correctly credited with INR payout ₹${expectedPayoutInr} (New Balance: ₹${partnerAfter.data.wallet_balance.toFixed(2)})`
    );

    ws.close();

    console.log('\n====================================================');
    console.log(`🎉 ALL ${testResults.length} AUTOMATED INTEGRATION TESTS PASSED!`);
    console.log('====================================================');
  } finally {
    // Clean up temporary test data from SQLite so no dummy records remain
    if (createdTaskId || createdClientUserId || createdPartnerUserId) {
      console.log('\n🧹 Cleaning up ephemeral test records from SQLite...');
      try {
        db.transaction(() => {
          if (createdTaskId) {
            db.prepare('DELETE FROM verification_logs WHERE task_id = ?').run(createdTaskId);
            db.prepare('DELETE FROM escrow_transactions WHERE task_id = ?').run(createdTaskId);
            db.prepare('DELETE FROM tasks WHERE id = ?').run(createdTaskId);
          }
          if (createdClientUserId) {
            db.prepare('DELETE FROM parents_profile WHERE client_id = ?').run(createdClientUserId);
            db.prepare('DELETE FROM clients_profile WHERE user_id = ?').run(createdClientUserId);
            db.prepare('DELETE FROM users WHERE id = ?').run(createdClientUserId);
          }
          if (createdPartnerUserId) {
            db.prepare('DELETE FROM partners_profile WHERE user_id = ?').run(createdPartnerUserId);
            db.prepare('DELETE FROM users WHERE id = ?').run(createdPartnerUserId);
          }
        })();
        console.log('✅ Ephemeral test records purged cleanly. Zero dummy records remain.');
      } catch (cleanErr) {
        console.warn('Notice during test cleanup:', cleanErr.message);
      }
    }
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Aborted with Error:', err);
  process.exit(1);
});
