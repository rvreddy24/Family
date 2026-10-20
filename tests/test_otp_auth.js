const assert = require('assert');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'server', 'familyhubs.db');
const TEST_PORT = 4001;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  console.log(`Starting test server on port ${TEST_PORT}...`);
  const server = spawn('node', ['server/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: TEST_PORT.toString() },
    stdio: 'ignore',
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        console.log('Server is healthy and ready.');
        return server;
      }
    } catch (e) {
      // Wait for server to come up
    }
    await sleep(300);
  }
  server.kill();
  throw new Error('Failed to start test server within timeout');
}

async function runOtpTests() {
  let serverProcess;
  try {
    serverProcess = await startServer();
    const db = new Database(DB_PATH);

    console.log('\n======================================================================');
    console.log('🔑 TESTING EMAIL OTP AUTHENTICATION (SIGNUP & LOGIN)');
    console.log('======================================================================\n');

    const testClientEmail = `test.client.otp.${Date.now()}@example.com`;
    const testPartnerEmail = `test.partner.otp.${Date.now()}@example.com`;

    // ------------------------------------------------------------------
    // TEST 1: Login OTP for non-existent email must return 404
    // ------------------------------------------------------------------
    console.log('--- Test 1: Login OTP for unregistered email ---');
    const res1 = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: 'unregistered.user.random@example.com',
        role: 'CLIENT',
        action: 'LOGIN',
      }),
    });
    const data1 = await res1.json();
    if (res1.status === 404 && !data1.success) {
      console.log('  ✅ PASS: Unregistered email login OTP returned 404 not found.');
    } else {
      throw new Error(`Test 1 Failed: Expected 404, got ${res1.status}: ${JSON.stringify(data1)}`);
    }

    // ------------------------------------------------------------------
    // TEST 2: Request Signup OTP for Client
    // ------------------------------------------------------------------
    console.log('\n--- Test 2: Request Signup OTP for Client User ---');
    const res2 = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testClientEmail,
        role: 'CLIENT',
        action: 'SIGNUP',
      }),
    });
    const data2 = await res2.json();
    if (res2.ok && data2.success) {
      console.log(`  ✅ PASS: Signup OTP sent successfully. (Code: ${data2.debugOtp})`);
    } else {
      throw new Error(`Test 2 Failed: ${JSON.stringify(data2)}`);
    }

    // Inspect OTP stored in SQLite
    const otpRowClient = db.prepare('SELECT * FROM email_otps WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(testClientEmail);
    if (!otpRowClient || !otpRowClient.otp_code) {
      throw new Error('Test 2 Failed: OTP not stored in SQLite email_otps table');
    }
    const clientCode = otpRowClient.otp_code;
    console.log(`  ✅ PASS: Database verified OTP row: email=${otpRowClient.email}, action=${otpRowClient.action}`);

    // ------------------------------------------------------------------
    // TEST 3: Verify with Invalid OTP code
    // ------------------------------------------------------------------
    console.log('\n--- Test 3: Verify with Invalid OTP code ---');
    const res3 = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testClientEmail,
        otp: '000000',
        role: 'CLIENT',
        action: 'SIGNUP',
        fullName: 'OTP Client User',
        phone: '+14085551234',
        parentName: 'Ramesh Reddy',
        parentPhone: '+919440123456',
        parentLocality: 'Hyderabad',
        parentAddress: 'Flat 402, Banjara Hills',
      }),
    });
    const data3 = await res3.json();
    if (res3.status === 400 && !data3.success) {
      console.log('  ✅ PASS: Verification with invalid code strictly rejected.');
    } else {
      throw new Error(`Test 3 Failed: Expected 400, got ${res3.status}`);
    }

    // ------------------------------------------------------------------
    // TEST 4: Verify with Correct OTP code to Complete Registration
    // ------------------------------------------------------------------
    console.log('\n--- Test 4: Complete Client Registration via Valid OTP ---');
    const res4 = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testClientEmail,
        otp: clientCode,
        role: 'CLIENT',
        action: 'SIGNUP',
        fullName: 'OTP Client User',
        phone: '+14085551234',
        countryResidence: 'United States',
        parentName: 'Ramesh Reddy',
        parentPhone: '+919440123456',
        parentWhatsappPhone: '+919440123456',
        parentLocality: 'Hyderabad',
        parentAddress: 'Flat 402, Banjara Hills',
      }),
    });
    const data4 = await res4.json();
    if (res4.ok && data4.success && data4.user && data4.user.role === 'CLIENT') {
      console.log(`  ✅ PASS: Client registered via OTP with role CLIENT (User ID: ${data4.user.id}).`);
    } else {
      throw new Error(`Test 4 Failed: ${JSON.stringify(data4)}`);
    }

    // Verify parent profile was created
    const parentRow = db.prepare('SELECT * FROM parents_profile WHERE client_id = ?').get(data4.user.id);
    if (parentRow && parentRow.parent_name === 'Ramesh Reddy') {
      console.log(`  ✅ PASS: Parent profile automatically created for new client.`);
    } else {
      throw new Error('Test 4 Failed: Parent profile not created.');
    }

    // ------------------------------------------------------------------
    // TEST 5: Send Login OTP for newly registered Client
    // ------------------------------------------------------------------
    console.log('\n--- Test 5: Request Login OTP for registered Client ---');
    const res5 = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testClientEmail,
        role: 'CLIENT',
        action: 'LOGIN',
      }),
    });
    const data5 = await res5.json();
    if (res5.ok && data5.success) {
      console.log(`  ✅ PASS: Login OTP sent to registered client. (Code: ${data5.debugOtp})`);
    } else {
      throw new Error(`Test 5 Failed: ${JSON.stringify(data5)}`);
    }

    const otpRowLogin = db.prepare('SELECT * FROM email_otps WHERE email = ? AND action = ? ORDER BY created_at DESC LIMIT 1').get(testClientEmail, 'LOGIN');
    if (!otpRowLogin) throw new Error('Test 5 Failed: Login OTP row not found.');

    // ------------------------------------------------------------------
    // TEST 6: Verify Login OTP
    // ------------------------------------------------------------------
    console.log('\n--- Test 6: Verify Login OTP for Client ---');
    const res6 = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testClientEmail,
        otp: otpRowLogin.otp_code,
        role: 'CLIENT',
        action: 'LOGIN',
      }),
    });
    const data6 = await res6.json();
    if (res6.ok && data6.success && data6.user.email === testClientEmail) {
      console.log(`  ✅ PASS: Client successfully logged in via OTP!`);
    } else {
      throw new Error(`Test 6 Failed: ${JSON.stringify(data6)}`);
    }

    // ------------------------------------------------------------------
    // TEST 7: Partner Signup via Email OTP
    // ------------------------------------------------------------------
    console.log('\n--- Test 7: Partner Signup via Email OTP ---');
    const res7Send = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3003' },
      body: JSON.stringify({
        email: testPartnerEmail,
        role: 'PARTNER',
        action: 'SIGNUP',
      }),
    });
    const data7Send = await res7Send.json();
    if (!res7Send.ok || !data7Send.success) throw new Error(`Partner send OTP failed: ${JSON.stringify(data7Send)}`);

    const partnerOtpRow = db.prepare('SELECT * FROM email_otps WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(testPartnerEmail);

    const res7Verify = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3003' },
      body: JSON.stringify({
        email: testPartnerEmail,
        otp: partnerOtpRow.otp_code,
        role: 'PARTNER',
        action: 'SIGNUP',
        fullName: 'Suresh Field Partner',
        phone: '+919876543210',
        serviceCategory: 'MEDICAL_TRANSPORT',
        operatingRegion: 'Pan-India Verified Network',
      }),
    });
    const data7Verify = await res7Verify.json();
    if (res7Verify.ok && data7Verify.success && data7Verify.user.role === 'PARTNER') {
      console.log(`  ✅ PASS: Partner registered via OTP with role PARTNER (Partner ID: ${data7Verify.user.id}).`);
    } else {
      throw new Error(`Test 7 Failed: ${JSON.stringify(data7Verify)}`);
    }

    // ------------------------------------------------------------------
    // TEST 8: Domain Mismatch Rejection with OTP
    // ------------------------------------------------------------------
    console.log('\n--- Test 8: Cross-Domain Rejection for OTP verification ---');
    // Partner trying to login via User domain (port 3001)
    const res8 = await fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify({
        email: testPartnerEmail,
        role: 'PARTNER',
        action: 'LOGIN',
      }),
    });
    const data8 = await res8.json();
    if (res8.status === 403 && !data8.success) {
      console.log('  ✅ PASS: Partner login attempt on Client domain strictly blocked with 403.');
    } else {
      throw new Error(`Test 8 Failed: Expected 403, got ${res8.status}`);
    }

    // ------------------------------------------------------------------
    // Cleanup test accounts
    // ------------------------------------------------------------------
    console.log('\n--- Cleanup: Purging test OTP accounts ---');
    db.prepare('DELETE FROM email_otps WHERE email IN (?, ?)').run(testClientEmail, testPartnerEmail);
    db.prepare('DELETE FROM parents_profile WHERE client_id IN (SELECT id FROM users WHERE email = ?)').run(testClientEmail);
    db.prepare('DELETE FROM clients_profile WHERE user_id IN (SELECT id FROM users WHERE email = ?)').run(testClientEmail);
    db.prepare('DELETE FROM partners_profile WHERE user_id IN (SELECT id FROM users WHERE email = ?)').run(testPartnerEmail);
    db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(testClientEmail, testPartnerEmail);

    const remainingNonAdmin = db.prepare("SELECT count(*) as count FROM users WHERE role != 'ADMIN'").get();
    if (remainingNonAdmin.count === 0) {
      console.log('  ✅ PASS: Only official admin account remains in DB.');
    } else {
      console.log(`  ⚠️ Notice: ${remainingNonAdmin.count} other non-admin users exist.`);
    }

    console.log('\n🎉 ALL EMAIL OTP AUTHENTICATION TESTS PASSED PERFECTLY!\n');
    db.close();
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runOtpTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
