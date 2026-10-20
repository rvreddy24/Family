const { WebSocket } = require('ws');
const db = require('better-sqlite3')('./server/familyhubs.db');

const API_BASE = process.env.TEST_API_URL || 'http://localhost:4000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:4000/ws/events';

let testResults = [];

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

async function runFeatureTests() {
  console.log('====================================================');
  console.log('🧪 Starting FamilyHubs Extended Features Automated Test Suite');
  console.log('====================================================\n');

  let testParentId = null;
  let testClientId = null;
  let testTaskId = null;
  let testPartnerId = null;
  let testSosId = null;

  try {
    // 1. Setup a test client and parent
    console.log('--- Step 1: Client & Parent Baseline Setup ---');
    const timestamp = Date.now();
    const clientRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        role: 'CLIENT',
        email: `feat.client.${timestamp}@familyhubs.in`,
        password: 'Password123!',
        fullName: 'Feature Test NRI Son',
        phone: '+1 555 123 4567',
        countryResidence: 'United States',
        currency: 'USD',
        subscriptionTier: 'CONCIERGE_UNLIMITED',
        parentName: 'Sita Ramaiah & Saraswathi',
        parentPhone: '+91 98888 77777',
        parentLocality: 'Banjara Hills, Hyderabad',
        parentAddress: 'Road No 12, Banjara Hills, Hyderabad',
        parentNotes: 'Hypertension and Type-2 Diabetes',
      }),
    });

    assert(clientRes.status === 201, 'Client registered successfully');
    testClientId = clientRes.data.user.id;

    const parents = await request(`/api/parents?clientId=${testClientId}`);
    assert(parents.status === 200 && parents.data.length > 0, 'Parent profile loaded');
    testParentId = parents.data[0].id;

    // Register test partner
    const partnerRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        role: 'PARTNER',
        email: `feat.partner.${timestamp}@familyhubs.in`,
        password: 'PartnerPassword123!',
        fullName: 'Srinivas Care Nurse',
        phone: '+91 97777 66666',
        serviceCategory: 'MEDICAL_TRANSPORT',
        operatingRegion: 'Hyderabad Central',
      }),
    });
    assert(partnerRes.status === 201, 'Partner registered successfully');
    testPartnerId = partnerRes.data.user.id;

    // Connect WebSocket
    const wsReceivedEvents = [];
    const ws = new WebSocket(`${WS_URL}?role=CLIENT&userId=${testClientId}`);
    await new Promise((resolve) => {
      ws.on('open', resolve);
      ws.on('message', (msg) => {
        try {
          wsReceivedEvents.push(JSON.parse(msg.toString()));
        } catch {}
      });
    });

    // 2. Test Health Vitals
    console.log('\n--- Step 2: Health Vitals Recording & History ---');
    const vitalRes = await request(`/api/parents/${testParentId}/vitals`, {
      method: 'POST',
      body: JSON.stringify({
        recordedBy: 'CLIENT',
        bloodPressureSys: 124,
        bloodPressureDia: 82,
        bloodSugar: 112,
        bloodSugarType: 'FASTING',
        pulse: 74,
        spo2: 98,
        weightKg: 68.5,
        notes: 'Morning vitals recorded after breakfast and light walk.',
      }),
    });
    assert(vitalRes.status === 201, 'Vital entry created with HTTP 201');
    assert(vitalRes.data.blood_pressure_sys === 124, 'Systolic blood pressure recorded accurately');
    assert(vitalRes.data.blood_sugar === 112, 'Blood sugar level recorded accurately');

    const vitalsList = await request(`/api/parents/${testParentId}/vitals`);
    assert(vitalsList.status === 200 && vitalsList.data.length > 0, 'Vitals list retrieved for parent');
    assert(vitalsList.data[0].pulse === 74, 'Pulse reading retrieved accurately');

    // 3. Test Medications Schedule & Refill Task Dispatch
    console.log('\n--- Step 3: Medication Schedule & Automated Refill Task ---');
    const medRes = await request(`/api/parents/${testParentId}/medications`, {
      method: 'POST',
      body: JSON.stringify({
        medicineName: 'Metformin Hydrochloride',
        dosage: '500mg',
        frequency: 'TWICE_DAILY',
        timeOfDay: 'Morning & Night (After Food)',
        stockRemaining: 6, // Low stock triggers alert
        lowStockThreshold: 7,
        instructions: 'Take with warm water after meals',
      }),
    });
    assert(medRes.status === 201, 'Medication scheduled successfully');
    const medId = medRes.data.id;

    const medsList = await request(`/api/parents/${testParentId}/medications`);
    assert(medsList.data.length > 0, 'Medications list retrieved');

    // 1-Click Refill Dispatch
    const refillRes = await request(`/api/parents/${testParentId}/medications/${medId}/refill`, {
      method: 'POST',
      body: JSON.stringify({ clientId: testClientId }),
    });
    assert(refillRes.status === 201, '1-Click Refill Task created automatically');
    assert(refillRes.data.task.title.includes('Pharmacy Delivery: Refill Metformin'), 'Refill task created with explicit pharmacy title');
    assert(refillRes.data.task.escrow.status === 'HOLD_IN_ESCROW', 'Refill escrow funds locked');

    // 4. Test Medical Vault Document Upload
    console.log('\n--- Step 4: Digital Health Vault Document Storage ---');
    const docRes = await request(`/api/parents/${testParentId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Apollo Hospital Annual Lipid & Cardiac Screening',
        category: 'LAB_REPORT',
        fileUrl: '/uploads/sample_cardiac_report.pdf',
        doctorName: 'Dr. K. S. Rao, MD Cardiology',
        hospitalName: 'Apollo Hospitals Jubilee Hills',
        documentDate: '2026-10-15',
        notes: 'Cholesterol levels stable. Advised 30 min walking daily.',
        uploadedBy: testClientId,
      }),
    });
    assert(docRes.status === 201, 'Medical document stored in vault with HTTP 201');

    const vaultDocs = await request(`/api/parents/${testParentId}/documents`);
    assert(vaultDocs.data.length > 0, 'Vault documents retrieved for parent');
    assert(vaultDocs.data[0].category === 'LAB_REPORT', 'Document category preserved correctly');

    // 5. Test Emergency SOS System
    console.log('\n--- Step 5: Emergency SOS Dispatch & Live Broadcast ---');
    const sosRes = await request('/api/emergency/sos', {
      method: 'POST',
      body: JSON.stringify({
        parentId: testParentId,
        triggeredByUserId: testClientId,
        latitude: 17.4123,
        longitude: 78.4088,
        notes: 'Severe chest discomfort and dizziness reported by mother.',
      }),
    });
    assert(sosRes.status === 201, 'Emergency SOS triggered successfully with HTTP 201');
    assert(sosRes.data.status === 'ACTIVE', 'Emergency event status is ACTIVE');
    assert(sosRes.data.ambulance_dispatched === 1, 'Ambulance dispatch flag active');
    testSosId = sosRes.data.id;

    const activeEmergencies = await request('/api/emergency/active');
    assert(activeEmergencies.data.some((e) => e.id === testSosId), 'Active emergencies list contains current SOS event');

    // Resolve SOS
    const resolveSos = await request(`/api/emergency/${testSosId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        resolvedBy: 'ops_admin',
        resolutionNotes: 'Ambulance arrived in 12 mins. Vitals stabilized at Apollo ER. NRI family updated via WhatsApp.',
      }),
    });
    assert(resolveSos.status === 200 && resolveSos.data.status === 'RESOLVED', 'Emergency SOS safely resolved');

    // 6. Test Task Lifecycle, Review & Rating CSAT
    console.log('\n--- Step 6: Task CSAT Review & Rating ---');
    const taskRes = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        clientId: testClientId,
        parentId: testParentId,
        category: 'HOME_MAINTENANCE',
        title: 'Reverse Osmosis Water Purifier Filter Replacement',
        instructions: 'Replace RO sediment and carbon filters in kitchen.',
        scheduledAt: new Date().toISOString(),
        escrowAmount: 35.0,
      }),
    });
    assert(taskRes.status === 201, 'Maintenance task created');
    testTaskId = taskRes.data.id;

    // Dispatch and complete task
    await request(`/api/tasks/${testTaskId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: testPartnerId }),
    });
    await request(`/api/tasks/${testTaskId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ partnerId: testPartnerId }),
    });

    const secRes = await request('/api/security/settings');
    await request(`/api/tasks/${testTaskId}/escrow/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminId: 'test_ops_admin', escrowPin: secRes.data.escrow_release_pin }),
    });

    // Client submits 5-star review
    const reviewRes = await request(`/api/tasks/${testTaskId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: testClientId,
        partnerId: testPartnerId,
        rating: 5,
        tags: ['Punctual', 'Elder Friendly', 'Clean Work'],
        feedbackText: 'Srinivas was extremely polite to my parents and completed the filter replacement with zero hassle. Highly recommended!',
      }),
    });
    assert(reviewRes.status === 201, 'Review submitted with HTTP 201');
    assert(reviewRes.data.rating === 5, '5-star rating registered');

    const taskReview = await request(`/api/tasks/${testTaskId}/review`);
    assert(taskReview.data.rating === 5, 'Task review verified from database');
    assert(taskReview.data.tags.includes('Elder Friendly'), 'Review tags preserved');

    // Partner profile rating updated
    const partnerProfile = await request(`/api/partners/${testPartnerId}/profile`);
    assert(partnerProfile.data.rating === 5, 'Partner average rating updated to 5.0');

    // 7. Test Sibling / Family Member Collaboration
    console.log('\n--- Step 7: Family Members Sibling Sharing ---');
    const famRes = await request(`/api/clients/${testClientId}/family`, {
      method: 'POST',
      body: JSON.stringify({
        invitedName: 'Priya Reddy (Sister in London)',
        invitedEmail: 'priya.reddy@uk.example.com',
        relationship: 'SIBLING',
      }),
    });
    assert(famRes.status === 201, 'Family sibling invited with HTTP 201');

    const famList = await request(`/api/clients/${testClientId}/family`);
    assert(famList.data.length > 0, 'Family members list retrieved');
    assert(famList.data[0].invited_name.includes('Priya Reddy'), 'Sibling profile verified');

    // 8. Test Partner Live GPS Telemetry
    console.log('\n--- Step 8: Partner Live GPS Telemetry Broadcast ---');
    const locRes = await request(`/api/partners/${testPartnerId}/location`, {
      method: 'POST',
      body: JSON.stringify({
        latitude: 17.415,
        longitude: 78.411,
        speed: 28.5,
        heading: 180,
        taskId: testTaskId,
      }),
    });
    assert(locRes.status === 200 && locRes.data.success === true, 'Partner GPS location posted');

    const locGet = await request(`/api/partners/${testPartnerId}/location`);
    assert(locGet.data.last_latitude === 17.415, 'Partner telemetry coordinate stored accurately');

    ws.close();

    console.log('\n====================================================');
    console.log(`🎉 ALL ${testResults.length} EXTENDED FEATURE TESTS PASSED!`);
    console.log('====================================================');
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test records...');
    try {
      db.transaction(() => {
        if (testSosId) db.prepare('DELETE FROM emergency_events WHERE id = ?').run(testSosId);
        if (testTaskId) {
          db.prepare('DELETE FROM task_reviews WHERE task_id = ?').run(testTaskId);
          db.prepare('DELETE FROM escrow_transactions WHERE task_id = ?').run(testTaskId);
          db.prepare('DELETE FROM tasks WHERE id = ?').run(testTaskId);
        }
        if (testParentId) {
          db.prepare('DELETE FROM parent_vitals WHERE parent_id = ?').run(testParentId);
          db.prepare('DELETE FROM parent_medications WHERE parent_id = ?').run(testParentId);
          db.prepare('DELETE FROM medical_vault_documents WHERE parent_id = ?').run(testParentId);
          db.prepare('DELETE FROM tasks WHERE parent_id = ?').run(testParentId);
          db.prepare('DELETE FROM parents_profile WHERE id = ?').run(testParentId);
        }
        if (testClientId) {
          db.prepare('DELETE FROM family_members WHERE client_id = ?').run(testClientId);
          db.prepare('DELETE FROM clients_profile WHERE user_id = ?').run(testClientId);
          db.prepare('DELETE FROM users WHERE id = ?').run(testClientId);
        }
        if (testPartnerId) {
          db.prepare('DELETE FROM partners_profile WHERE user_id = ?').run(testPartnerId);
          db.prepare('DELETE FROM users WHERE id = ?').run(testPartnerId);
        }
      })();
      console.log('✅ Ephemeral records cleaned.');
    } catch (e) {
      console.warn('Notice during test cleanup:', e.message);
    }
  }
}

runFeatureTests().catch((err) => {
  console.error('\n❌ Test Suite Aborted with Error:', err);
  process.exit(1);
});
