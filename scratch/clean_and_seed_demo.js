require('dotenv').config();
const { db } = require('../server/db');
const { supabaseAdmin } = require('../server/supabase');

async function cleanAndSeed() {
  console.log('====================================================');
  console.log('🧹 Cleaning Database & Creating 3 Demo Accounts');
  console.log('====================================================');

  // --- Step 1: Wipe Local SQLite ---
  console.log('\n[1/3] Wiping and seeding Local SQLite database...');
  db.exec(`
    DELETE FROM whatsapp_logs;
    DELETE FROM verification_logs;
    DELETE FROM escrow_transactions;
    DELETE FROM tasks;
    DELETE FROM audit_logs;
    DELETE FROM parents_profile;
    DELETE FROM partners_profile;
    DELETE FROM clients_profile;
    DELETE FROM users;
  `);

  // Insert 3 Demo Accounts into SQLite
  const insertUser = db.prepare(`
    INSERT INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
    VALUES (@id, @role, @email, @phone, @full_name, @auth_provider_id, datetime('now'))
  `);

  const insertClient = db.prepare(`
    INSERT INTO clients_profile (user_id, country_residence, currency, subscription_tier)
    VALUES (@user_id, @country_residence, @currency, @subscription_tier)
  `);

  const insertParent = db.prepare(`
    INSERT INTO parents_profile (id, client_id, parent_name, primary_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
    VALUES (@id, @client_id, @parent_name, @primary_phone, @locality, @full_address, @coordinates_lat, @coordinates_lng, @medical_notes)
  `);

  const insertPartner = db.prepare(`
    INSERT INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance)
    VALUES (@user_id, @service_category, @operating_region, @kyc_verified, @is_active, @wallet_balance)
  `);

  // 1. Demo Client (NRI Family)
  insertUser.run({
    id: 'usr_demo_client',
    role: 'CLIENT',
    email: 'demo.client@familyhubs.com',
    phone: '+1 408 555 0192',
    full_name: 'Demo Client (NRI Family)',
    auth_provider_id: 'demo-auth|client-demo',
  });
  insertClient.run({
    user_id: 'usr_demo_client',
    country_residence: 'United States (San Jose, CA)',
    currency: 'USD',
    subscription_tier: 'GOLD',
  });
  insertParent.run({
    id: 'prt_demo_parent',
    client_id: 'usr_demo_client',
    parent_name: 'Lakshmi & Ramana Reddy (Parents)',
    primary_phone: '+91 94901 22334',
    locality: 'Reddy Colony, Miryalaguda',
    full_address: 'H.No 4-128/A, Beside Venkateswara Swamy Temple, Reddy Colony, Miryalaguda, Telangana 508207',
    coordinates_lat: 16.8724,
    coordinates_lng: 79.5631,
    medical_notes: 'Father: Daily BP monitoring & cardiac health. Mother: Knee care mobility support.',
  });

  // 2. Demo Operations Admin
  insertUser.run({
    id: 'usr_demo_admin',
    role: 'ADMIN',
    email: 'demo.admin@familyhubs.com',
    phone: '+91 90000 88888',
    full_name: 'Demo Operations Admin',
    auth_provider_id: 'demo-auth|admin-demo',
  });

  // 3. Demo Field Partner
  insertUser.run({
    id: 'usr_demo_partner',
    role: 'PARTNER',
    email: 'demo.partner@familyhubs.com',
    phone: '+91 94401 54321',
    full_name: 'Demo Field Partner',
    auth_provider_id: 'demo-auth|partner-demo',
  });
  insertPartner.run({
    user_id: 'usr_demo_partner',
    service_category: 'MEDICAL_TRANSPORT',
    operating_region: 'Miryalaguda Town & Rural Hub',
    kyc_verified: 1,
    is_active: 1,
    wallet_balance: 0.0,
  });

  db.prepare(`
    INSERT INTO audit_logs (id, event_type, actor_id, actor_role, ip_address, severity, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    'aud_init_demo',
    'DEMO_ENVIRONMENT_READY',
    'usr_demo_admin',
    'ADMIN',
    '127.0.0.1',
    'LOW',
    JSON.stringify({ message: 'Clean demo environment configured with 3 accounts.' })
  );

  console.log('  ✅ Local SQLite successfully seeded with exactly 3 demo accounts.');

  // --- Step 2: Wipe and Seed Supabase Cloud ---
  if (supabaseAdmin) {
    console.log('\n[2/3] Wiping and seeding Supabase PostgreSQL cloud database...');
    try {
      await supabaseAdmin.from('whatsapp_audit_log').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('task_verification_logs').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('escrow_transactions').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('tasks').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('audit_logs').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('parents_profile').delete().neq('id', 'placeholder');
      await supabaseAdmin.from('partners_profile').delete().neq('user_id', 'placeholder');
      await supabaseAdmin.from('clients_profile').delete().neq('user_id', 'placeholder');
      await supabaseAdmin.from('users').delete().neq('id', 'placeholder');

      // Insert Demo Users
      const { error: userErr } = await supabaseAdmin.from('users').insert([
        {
          id: 'usr_demo_client',
          role: 'CLIENT',
          email: 'demo.client@familyhubs.com',
          phone: '+1 408 555 0192',
          full_name: 'Demo Client (NRI Family)',
        },
        {
          id: 'usr_demo_admin',
          role: 'ADMIN',
          email: 'demo.admin@familyhubs.com',
          phone: '+91 90000 88888',
          full_name: 'Demo Operations Admin',
        },
        {
          id: 'usr_demo_partner',
          role: 'PARTNER',
          email: 'demo.partner@familyhubs.com',
          phone: '+91 94401 54321',
          full_name: 'Demo Field Partner',
        },
      ]);
      if (userErr) throw userErr;

      // Insert Demo Client Profile
      const { error: clientErr } = await supabaseAdmin.from('clients_profile').insert([
        {
          user_id: 'usr_demo_client',
          country_residence: 'United States (San Jose, CA)',
          currency: 'USD',
          subscription_tier: 'GOLD',
        },
      ]);
      if (clientErr) throw clientErr;

      // Insert Demo Parent
      const { error: parentErr } = await supabaseAdmin.from('parents_profile').insert([
        {
          id: 'prt_demo_parent',
          client_id: 'usr_demo_client',
          parent_name: 'Lakshmi & Ramana Reddy (Parents)',
          primary_phone: '+91 94901 22334',
          locality: 'Reddy Colony, Miryalaguda',
          full_address: 'H.No 4-128/A, Beside Venkateswara Swamy Temple, Reddy Colony, Miryalaguda, Telangana 508207',
          coordinates_lat: 16.8724,
          coordinates_lng: 79.5631,
          medical_notes: 'Father: Daily BP monitoring & cardiac health. Mother: Knee care mobility support.',
        },
      ]);
      if (parentErr) throw parentErr;

      // Insert Demo Partner Profile
      const { error: partnerErr } = await supabaseAdmin.from('partners_profile').insert([
        {
          user_id: 'usr_demo_partner',
          service_category: 'MEDICAL_TRANSPORT',
          operating_region: 'Miryalaguda Town & Rural Hub',
          kyc_verified: true,
          is_active: true,
          wallet_balance: 0.0,
        },
      ]);
      if (partnerErr) throw partnerErr;

      // Insert Security Settings
      await supabaseAdmin.from('security_settings').upsert([
        { key: 'escrow_release_pin', value: '849201' },
        { key: 'geofence_tolerance_meters', value: '150' },
        { key: 'emergency_escrow_freeze', value: '0' },
      ]);

      // Insert Audit Log
      await supabaseAdmin.from('audit_logs').insert([
        {
          id: 'aud_init_demo',
          event_type: 'DEMO_ENVIRONMENT_READY',
          actor_id: 'usr_demo_admin',
          actor_role: 'ADMIN',
          ip_address: '127.0.0.1',
          severity: 'LOW',
          details_json: { message: 'Clean demo environment configured with 3 accounts.' },
        },
      ]);

      console.log('  ✅ Supabase PostgreSQL cloud database successfully seeded with 3 demo accounts.');
    } catch (sbErr) {
      console.error('  ❌ Supabase seed error:', sbErr.message);
    }
  }

  // --- Step 3: Verification Check ---
  console.log('\n[3/3] Verifying Account Counts...');
  const localUsers = db.prepare('SELECT id, full_name, role, email FROM users').all();
  console.log('Local SQLite Users (Count: ' + localUsers.length + '):');
  console.table(localUsers);

  if (supabaseAdmin) {
    const { data: cloudUsers } = await supabaseAdmin.from('users').select('id, full_name, role, email');
    console.log('Supabase Cloud Users (Count: ' + (cloudUsers ? cloudUsers.length : 0) + '):');
    console.table(cloudUsers);
  }

  console.log('\n✨ Database reset complete! Clean demo state active.\n');
}

cleanAndSeed().catch(console.error);
