// Automated Domain & Reverse Proxy Routing Verification Test
const assert = require('assert');

const API_BASE = 'http://localhost:4000';

async function testDomainRouting() {
  console.log('====================================================');
  console.log('🌐 Starting FamilyHubs Enterprise Domain & Host Test');
  console.log('====================================================\n');

  // 1. Health check with standard headers
  console.log('--- Test 1: Core Engine Health Check ---');
  const healthRes = await fetch(`${API_BASE}/api/health`);
  assert.strictEqual(healthRes.status, 200);
  const health = await healthRes.json();
  assert.strictEqual(health.status, 'ONLINE');
  console.log('  ✅ PASS: Core engine online');

  // 2. Cross-Origin Domain CORS checks
  console.log('\n--- Test 2: Multi-Domain CORS Preflight & Reflection ---');
  const testDomains = [
    'https://familyhubs.in',
    'https://ops.familyhubs.in',
    'https://partner.familyhubs.in',
    'https://mycustomconcierge.com',
    'https://my-app.onrender.com',
    'https://familyhubs.vercel.app',
  ];

  for (const origin of testDomains) {
    const corsRes = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: {
        Origin: origin,
      },
    });
    const allowOrigin = corsRes.headers.get('access-control-allow-origin');
    const allowCreds = corsRes.headers.get('access-control-allow-credentials');
    assert.strictEqual(allowOrigin, origin, `CORS origin mismatch for ${origin}`);
    assert.strictEqual(allowCreds, 'true', `Credentials should be true for ${origin}`);
    console.log(`  ✅ PASS: CORS allowed & reflected for domain: ${origin}`);
  }

  // Helper to make native HTTP requests with true socket-level Host and X-Forwarded-Host headers
  const requestWithHost = (path, host) => {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 4000,
          path,
          headers: {
            Host: host,
            'X-Forwarded-Host': host,
          },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve({ status: res.statusCode, body }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  };

  // 3. Domain Subdomain Routing (Host headers)
  console.log('\n--- Test 3: Domain & Subdomain Host Routing ---');

  // 3a. Root / Client Portal on standard domain
  const rootDomainRes = await requestWithHost('/', 'familyhubs.in');
  assert.strictEqual(rootDomainRes.status, 200);
  assert.ok(rootDomainRes.body.includes('FamilyHubs | Caring for Aging Parents'), 'Root domain must serve Client Portal');
  console.log('  ✅ PASS: familyhubs.in correctly serves NRI Client Portal');

  // 3b. Operations Subdomain
  const opsSubdomainRes = await requestWithHost('/', 'ops.familyhubs.in');
  assert.strictEqual(opsSubdomainRes.status, 200);
  assert.ok(opsSubdomainRes.body.includes('FamilyHubs Operations'), 'ops subdomain must serve Admin Portal');
  console.log('  ✅ PASS: ops.familyhubs.in correctly serves Operations Admin Portal');

  // 3c. Admin Subdomain with port
  const adminSubdomainRes = await requestWithHost('/', 'admin.mycompany.org:8443');
  assert.strictEqual(adminSubdomainRes.status, 200);
  assert.ok(adminSubdomainRes.body.includes('FamilyHubs Operations'), 'admin subdomain with custom port must serve Admin Portal');
  console.log('  ✅ PASS: admin.mycompany.org:8443 correctly serves Operations Admin Portal');

  // 3d. Partner Subdomain
  const partnerSubdomainRes = await requestWithHost('/', 'partner.familyhubs.in');
  assert.strictEqual(partnerSubdomainRes.status, 200);
  assert.ok(partnerSubdomainRes.body.includes('FamilyHubs Partner'), 'partner subdomain must serve Partner Portal');
  console.log('  ✅ PASS: partner.familyhubs.in correctly serves Partner Portal');

  // 3e. Field Subdomain
  const fieldSubdomainRes = await requestWithHost('/', 'field.care.co.in');
  assert.strictEqual(fieldSubdomainRes.status, 200);
  assert.ok(fieldSubdomainRes.body.includes('FamilyHubs Partner'), 'field subdomain must serve Partner Portal');
  console.log('  ✅ PASS: field.care.co.in correctly serves Partner Portal');

  // 4. Scoped Path-Based Multi-Portal Routing on Any Domain
  console.log('\n--- Test 4: Path-Based Multi-Portal Routing on Any Domain ---');
  const testHost = 'customdomain.com';

  const pathUserRes = await fetch(`${API_BASE}/`, { headers: { Host: testHost } });
  assert.strictEqual(pathUserRes.status, 200);
  const pathUserHtml = await pathUserRes.text();
  assert.ok(pathUserHtml.includes('FamilyHubs | Caring for Aging Parents'));
  console.log('  ✅ PASS: customdomain.com/ serves Client Portal');

  const pathOpsRes = await fetch(`${API_BASE}/ops`, { headers: { Host: testHost } });
  assert.strictEqual(pathOpsRes.status, 200);
  const pathOpsHtml = await pathOpsRes.text();
  assert.ok(pathOpsHtml.includes('FamilyHubs Operations'));
  console.log('  ✅ PASS: customdomain.com/ops serves Operations Portal');

  const pathPartnerRes = await fetch(`${API_BASE}/partner`, { headers: { Host: testHost } });
  assert.strictEqual(pathPartnerRes.status, 200);
  const pathPartnerHtml = await pathPartnerRes.text();
  assert.ok(pathPartnerHtml.includes('FamilyHubs Partner'));
  console.log('  ✅ PASS: customdomain.com/partner serves Partner Portal');

  // 5. Reverse Proxy Header Trust (X-Forwarded-Proto, X-Forwarded-For)
  console.log('\n--- Test 5: Reverse Proxy Header Inspection (X-Forwarded-Proto) ---');
  const proxyRes = await fetch(`${API_BASE}/api/health`, {
    headers: {
      Host: 'familyhubs.in',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': '203.0.113.195',
    },
  });
  assert.strictEqual(proxyRes.status, 200);
  console.log('  ✅ PASS: Reverse proxy headers accepted without error');

  // 6. WebSocket Connection on /ws and /ws/events
  console.log('\n--- Test 6: WebSocket Gateway on /ws and /ws/events ---');
  const WebSocket = require('ws');
  
  await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:4000/ws/events?role=ADMIN');
    ws.on('open', () => {
      console.log('  ✅ PASS: WebSocket connected successfully on /ws/events');
      ws.close();
      resolve();
    });
    ws.on('error', reject);
  });

  await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:4000/ws?role=PARTNER');
    ws.on('open', () => {
      console.log('  ✅ PASS: WebSocket connected successfully on alias /ws');
      ws.close();
      resolve();
    });
    ws.on('error', reject);
  });

  console.log('\n====================================================');
  console.log('🎉 ALL DOMAIN & PROXY ROUTING TESTS PASSED (100%)!');
  console.log('====================================================\n');
}

testDomainRouting().catch((err) => {
  console.error('❌ DOMAIN TEST ERROR:', err);
  process.exit(1);
});
