const http = require('http');
const { spawn } = require('child_process');
const db = require('../server/db');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const PORT = 4002;
  const env = { ...process.env, PORT: PORT.toString() };
  const srv = spawn('node', ['server/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  srv.stdout.on('data', (d) => process.stdout.write('[srv] ' + d.toString()));
  srv.stderr.on('data', (d) => process.stderr.write('[srv-err] ' + d.toString()));

  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n=== TESTING PARENT CRUD & OTP AUTH FLOWS ===\n');

  try {
    const testEmail = `parent.test.${Date.now()}@example.com`;

    // 1. Send OTP for signup
    console.log('1. Dispatching signup OTP...');
    const otpSendRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/otp/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmail,
      role: 'CLIENT',
      action: 'SIGNUP',
    });

    if (otpSendRes.status !== 200 || !otpSendRes.data.debugOtp) {
      throw new Error(`Failed to dispatch OTP: ${JSON.stringify(otpSendRes)}`);
    }
    const testOtp = otpSendRes.data.debugOtp;
    console.log('  ✅ OTP received:', testOtp);

    // 2. Complete signup WITHOUT any parent details
    console.log('2. Completing user registration without parent details...');
    const verifySignupRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/otp/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmail,
      otp: testOtp,
      role: 'CLIENT',
      action: 'SIGNUP',
      fullName: 'Vikram Singh',
      phone: '+1 408 555 1234',
      country: 'United States',
    });

    if ((verifySignupRes.status !== 200 && verifySignupRes.status !== 201) || !verifySignupRes.data.user) {
      throw new Error(`Signup failed: ${JSON.stringify(verifySignupRes)}`);
    }
    const userId = verifySignupRes.data.user.id;
    console.log('  ✅ User registered successfully without mandatory parent details. User ID:', userId);

    // 3. Add parent residence explicitly from Parents tab
    console.log('3. Adding parent residence from Parents tab...');
    const addParentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/parents',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      clientId: userId,
      parentName: 'Suresh & Anita Singh',
      primaryPhone: '+91 98765 43210',
      whatsappPhone: '+91 98765 43210',
      locality: 'Chandigarh',
      fullAddress: 'House 42, Sector 15, Chandigarh',
      medicalNotes: 'Father is diabetic, mother has mild hypertension',
    });

    if (addParentRes.status !== 200 && addParentRes.status !== 201) {
      throw new Error(`Failed to add parent: ${JSON.stringify(addParentRes)}`);
    }
    const parentId = addParentRes.data.id;
    console.log('  ✅ Parent residence added. Parent ID:', parentId);

    // 4. Update Parent residence (Edit Parent)
    console.log('4. Testing Edit Parent (PUT /api/parents/:id)...');
    const updateParentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/parents/${parentId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }, {
      parentName: 'Suresh & Anita Singh (Updated)',
      primaryPhone: '+91 98765 99999',
      whatsappPhone: '+91 98765 99999',
      locality: 'Chandigarh City',
      fullAddress: 'House 42B, Sector 15, Chandigarh',
      medicalNotes: 'Updated: regular BP check and medication delivered monthly',
    });

    if (updateParentRes.status !== 200 || !updateParentRes.data.id) {
      throw new Error(`Failed to update parent: ${JSON.stringify(updateParentRes)}`);
    }
    console.log('  ✅ Parent residence updated:', updateParentRes.data.parent_name);
    if (updateParentRes.data.parent_name !== 'Suresh & Anita Singh (Updated)') {
      throw new Error('Update did not reflect expected name');
    }

    // 5. Delete Parent residence (Delete Parent)
    console.log('5. Testing Delete Parent (DELETE /api/parents/:id)...');
    const deleteParentRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/parents/${parentId}`,
      method: 'DELETE',
    });

    if (deleteParentRes.status !== 200 || !deleteParentRes.data.success) {
      throw new Error(`Failed to delete parent: ${JSON.stringify(deleteParentRes)}`);
    }
    console.log('  ✅ Parent residence deleted successfully.');

    // Verify parent is gone
    const getParentsRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: `/api/parents?clientId=${userId}`,
      method: 'GET',
    });
    const exists = (getParentsRes.data || []).some((p) => p.id === parentId);
    if (exists) {
      throw new Error('Deleted parent still appears in list!');
    }
    console.log('  ✅ Confirmed parent was purged from database.');

    // 6. Test Password Login then OTP challenge
    console.log('6. Testing Login with Password then OTP verification...');
    const passLoginRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmail,
      password: 'SecurePass123!',
      role: 'CLIENT',
    });

    if (passLoginRes.status !== 200 || !passLoginRes.data.success) {
      throw new Error(`Password check failed: ${JSON.stringify(passLoginRes)}`);
    }
    console.log('  ✅ Password validated by /api/auth/login.');

    // Now OTP is dispatched for login
    const loginOtpRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/otp/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmail,
      role: 'CLIENT',
      action: 'LOGIN',
    });

    if (loginOtpRes.status !== 200 || !loginOtpRes.data.debugOtp) {
      throw new Error(`Failed to dispatch login OTP: ${JSON.stringify(loginOtpRes)}`);
    }
    const loginCode = loginOtpRes.data.debugOtp;
    console.log('  ✅ Login OTP dispatched:', loginCode);

    // Verify OTP to complete sign-in
    const verifyLoginRes = await request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/otp/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: testEmail,
      otp: loginCode,
      role: 'CLIENT',
      action: 'LOGIN',
    });

    if (verifyLoginRes.status !== 200 || !verifyLoginRes.data.user) {
      throw new Error(`Login OTP verification failed: ${JSON.stringify(verifyLoginRes)}`);
    }
    console.log('  ✅ Login completed with OTP! Logged in as:', verifyLoginRes.data.user.email);

    // Cleanup test user
    const sqlite = require('better-sqlite3')('./server/familyhubs.db');
    sqlite.prepare('DELETE FROM clients_profile WHERE user_id = ?').run(userId);
    sqlite.prepare('DELETE FROM parents_profile WHERE client_id = ?').run(userId);
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId);
    sqlite.close();
    console.log('  ✅ Cleaned up test user.');

    console.log('\n🎉 ALL PARENT CRUD & OTP AUTH TESTS PASSED!\n');
  } finally {
    srv.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
