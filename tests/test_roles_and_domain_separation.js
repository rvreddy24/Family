const assert = require('assert');
const { spawn } = require('child_process');
const http = require('http');

const API_BASE = 'http://127.0.0.1:4000';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) return null;
  } catch {}

  console.log('Starting FamilyHubs server on port 4000 for test suite...');
  const serverProc = spawn('node', ['server/server.js'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        console.log('Server online.');
        return serverProc;
      }
    } catch {}
  }
  throw new Error('Server failed to start within 10 seconds.');
}

async function runTests() {
  const serverProc = await ensureServerRunning();
  try {
    console.log('======================================================================');
    console.log('🛡️ TESTING 3-ROLE PLATFORM ARCHITECTURE & DOMAIN/ROLE SEPARATION');
    console.log('======================================================================\n');

  // 1. Roles endpoint
  console.log('--- Test 1: Introspect /api/auth/roles ---');
  const rolesRes = await request('/api/auth/roles');
  assert.strictEqual(rolesRes.status, 200);
  assert.strictEqual(rolesRes.data.totalRoles, 3);
  assert.deepStrictEqual(rolesRes.data.roles, ['CLIENT', 'PARTNER', 'ADMIN']);
  assert.strictEqual(rolesRes.data.singleAdminEmail, 'admin@familyhubs.in');
  console.log('  ✅ PASS: 3 roles confirmed (CLIENT, PARTNER, ADMIN) with single admin.');

  // 2. Official Admin Login
  console.log('\n--- Test 2: Admin Login Verification ---');
  const adminLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@familyhubs.in',
      password: 'Admin@FamilyHubs2026!',
      role: 'ADMIN',
    }),
    headers: {
      Host: 'ops.familyhubs.in',
    },
  });
  assert.strictEqual(adminLoginRes.status, 200);
  assert.strictEqual(adminLoginRes.data.user.role, 'ADMIN');
  assert.strictEqual(adminLoginRes.data.user.email, 'admin@familyhubs.in');
  console.log('  ✅ PASS: Official Operations Admin authenticated successfully.');

  // 3. Admin self-registration rejection
  console.log('\n--- Test 3: Public Admin Registration Rejection ---');
  const fakeAdminRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: 'ADMIN',
      email: 'hacker@example.com',
      fullName: 'Fake Admin',
      password: 'Hacked123!',
    }),
  });
  assert.strictEqual(fakeAdminRes.status, 403);
  console.log('  ✅ PASS: Public admin self-registration strictly blocked with 403.');

  // 4. Client User Registration (accepts 'CLIENT' or 'user')
  console.log('\n--- Test 4: Client User Registration ---');
  const timestamp = Date.now();
  const clientEmail = `test.client.${timestamp}@familyhubs.in`;
  const clientRegRes = await request('/api/auth/register', {
    method: 'POST',
    headers: {
      Host: 'familyhubs.in',
    },
    body: JSON.stringify({
      role: 'user', // testing role normalization
      email: clientEmail,
      fullName: 'Test NRI Client',
      phone: '+1 408 555 9999',
      parentName: 'Ramesh Reddy',
      parentPhone: '+91 94401 11222',
      parentWhatsappPhone: '+91 94401 11222',
      parentLocality: 'Banjara Hills, Hyderabad',
      parentAddress: 'Road No 10, Banjara Hills',
    }),
  });
  assert.strictEqual(clientRegRes.status, 201);
  assert.strictEqual(clientRegRes.data.user.role, 'CLIENT');
  console.log('  ✅ PASS: Client (User) account registered with role CLIENT.');

  // 5. Partner Registration (accepts 'PARTNER' or 'partner')
  console.log('\n--- Test 5: Field Partner Registration ---');
  const partnerEmail = `test.partner.${timestamp}@familyhubs.in`;
  const partnerRegRes = await request('/api/auth/register', {
    method: 'POST',
    headers: {
      Host: 'partner.familyhubs.in',
    },
    body: JSON.stringify({
      role: 'partner',
      email: partnerEmail,
      fullName: 'Test Field Helper',
      phone: '+91 94401 88888',
      serviceCategory: 'MEDICAL_TRANSPORT',
      operatingRegion: 'Hyderabad Hub',
    }),
  });
  assert.strictEqual(partnerRegRes.status, 201);
  assert.strictEqual(partnerRegRes.data.user.role, 'PARTNER');
  console.log('  ✅ PASS: Partner account registered with role PARTNER.');

  // 6. Cross-Domain Role Separation Enforcement
  console.log('\n--- Test 6: Cross-Domain Login Separation ---');

  // Attempt A: Client trying to log into Partner Portal
  const clientOnPartnerRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Host: 'partner.familyhubs.in',
    },
    body: JSON.stringify({
      email: clientEmail,
      role: 'PARTNER',
    }),
  });
  assert.strictEqual(clientOnPartnerRes.status, 403);
  assert(clientOnPartnerRes.data.error.includes('registered as a Family Client'));
  console.log('  ✅ PASS: Client account blocked on Partner portal with clear portal redirection message.');

  // Attempt B: Partner trying to log into User Client Portal
  const partnerOnUserRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Host: 'familyhubs.in',
    },
    body: JSON.stringify({
      email: partnerEmail,
      role: 'CLIENT',
    }),
  });
  assert.strictEqual(partnerOnUserRes.status, 403);
  assert(partnerOnUserRes.data.error.includes('registered as a Field Partner'));
  console.log('  ✅ PASS: Partner account blocked on User portal with clear portal redirection message.');

  // Attempt C: Non-admin trying to log into Operations Admin Portal
  const clientOnAdminRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Host: 'ops.familyhubs.in',
    },
    body: JSON.stringify({
      email: clientEmail,
      role: 'ADMIN',
    }),
  });
  assert.strictEqual(clientOnAdminRes.status, 403);
  console.log('  ✅ PASS: Non-admin account blocked on Admin console with 403.');

  // 7. Valid Portal Logins
  console.log('\n--- Test 7: Valid Portal Logins ---');
  const validClientRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Host: 'familyhubs.in',
    },
    body: JSON.stringify({
      email: clientEmail,
      role: 'CLIENT',
    }),
  });
  assert.strictEqual(validClientRes.status, 200);
  assert.strictEqual(validClientRes.data.user.role, 'CLIENT');

  const validPartnerRes = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      Host: 'partner.familyhubs.in',
    },
    body: JSON.stringify({
      email: partnerEmail,
      role: 'PARTNER',
    }),
  });
  assert.strictEqual(validPartnerRes.status, 200);
  assert.strictEqual(validPartnerRes.data.user.role, 'PARTNER');
  console.log('  ✅ PASS: Legitimate Client and Partner successfully authenticated on their designated portals.');

  // 8. Clean up test users so only admin remains
  console.log('\n--- Cleanup: Purging test accounts ---');
  const db = require('better-sqlite3')('./server/familyhubs.db');
  db.prepare('DELETE FROM clients_profile WHERE user_id = ?').run(clientRegRes.data.user.id);
  db.prepare('DELETE FROM parents_profile WHERE client_id = ?').run(clientRegRes.data.user.id);
  db.prepare('DELETE FROM partners_profile WHERE user_id = ?').run(partnerRegRes.data.user.id);
  db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(clientEmail, partnerEmail);

  const testAccountsRemaining = db.prepare('SELECT count(*) as c FROM users WHERE email IN (?, ?)').get(clientEmail, partnerEmail).c;
  assert.strictEqual(testAccountsRemaining, 0, 'Test accounts must be purged');
  console.log('  ✅ PASS: Cleaned up test accounts successfully.');

  console.log('\n🎉 ALL 3-ROLE PLATFORM ARCHITECTURE & DOMAIN/ROLE SEPARATION TESTS PASSED!\n');
  } finally {
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
