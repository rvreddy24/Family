const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const crypto = require('crypto');
require('dotenv').config();

const CLIENT_ID = 'c11e4701-0000-4000-8000-000000000001';
const CLIENT_EMAIL = 'user@familyhubs.in';
const CLIENT_PASSWORD = 'User@FamilyHubs2026!';

const PARTNER_ID = 'b22e4702-0000-4000-8000-000000000002';
const PARTNER_EMAIL = 'partner@familyhubs.in';
const PARTNER_PASSWORD = 'Partner@FamilyHubs2026!';

const PARENT_ID = 'p33e4703-0000-4000-8000-000000000003';

async function setupTrioAccounts() {
  console.log('======================================================================');
  console.log('👥 SETTING UP THE OFFICIAL TRIO ACCOUNTS (ADMIN, USER, PARTNER)');
  console.log('======================================================================');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = new Database('./server/familyhubs.db');

  // --- 1. Supabase Auth Setup ---
  console.log('\n--- 1. Setting up Supabase Auth Accounts ---');

  // Client User in Auth
  const { data: { users: existingAuth } } = await supabase.auth.admin.listUsers();
  
  let clientAuth = existingAuth.find(u => u.email === CLIENT_EMAIL);
  if (!clientAuth) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      id: CLIENT_ID,
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'CLIENT',
        full_name: 'Rajesh Reddy (NRI Son)',
        phone: '+1 408 555 0199',
      },
    });
    if (error) console.error('Error creating client auth:', error.message);
    else console.log('✅ Supabase Auth: Created single Client account:', CLIENT_EMAIL);
  } else {
    await supabase.auth.admin.updateUserById(clientAuth.id, {
      password: CLIENT_PASSWORD,
      user_metadata: {
        role: 'CLIENT',
        full_name: 'Rajesh Reddy (NRI Son)',
        phone: '+1 408 555 0199',
      },
    });
    console.log('✅ Supabase Auth: Updated single Client account:', CLIENT_EMAIL);
  }

  // Partner User in Auth
  let partnerAuth = existingAuth.find(u => u.email === PARTNER_EMAIL);
  if (!partnerAuth) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      id: PARTNER_ID,
      email: PARTNER_EMAIL,
      password: PARTNER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'PARTNER',
        full_name: 'Pavan Kumar (Field Partner)',
        phone: '+91 94401 55667',
      },
    });
    if (error) console.error('Error creating partner auth:', error.message);
    else console.log('✅ Supabase Auth: Created single Partner account:', PARTNER_EMAIL);
  } else {
    await supabase.auth.admin.updateUserById(partnerAuth.id, {
      password: PARTNER_PASSWORD,
      user_metadata: {
        role: 'PARTNER',
        full_name: 'Pavan Kumar (Field Partner)',
        phone: '+91 94401 55667',
      },
    });
    console.log('✅ Supabase Auth: Updated single Partner account:', PARTNER_EMAIL);
  }

  // --- 2. Supabase Public DB Tables Setup ---
  console.log('\n--- 2. Setting up Supabase Public Database Tables ---');
  await supabase.from('users').upsert([
    {
      id: CLIENT_ID,
      role: 'CLIENT',
      email: CLIENT_EMAIL,
      phone: '+1 408 555 0199',
      full_name: 'Rajesh Reddy (NRI Son)',
      auth_provider_id: CLIENT_ID,
    },
    {
      id: PARTNER_ID,
      role: 'PARTNER',
      email: PARTNER_EMAIL,
      phone: '+91 94401 55667',
      full_name: 'Pavan Kumar (Field Partner)',
      auth_provider_id: PARTNER_ID,
    },
  ]);

  await supabase.from('clients_profile').upsert([
    {
      user_id: CLIENT_ID,
      country_residence: 'United States',
      preferred_currency: 'USD',
      subscription_tier: 'GOLD',
    },
  ]);

  await supabase.from('parents_profile').upsert([
    {
      id: PARENT_ID,
      client_id: CLIENT_ID,
      parent_name: 'Mrs. Lakshmi & Mr. Ramana Reddy',
      primary_phone: '+91 94401 22334',
      locality: 'Reddy Colony, Miryalaguda',
      full_address: 'Plot 42, Beside Anjaneya Temple, Reddy Colony, Miryalaguda, Telangana 508207',
      latitude: 16.8724,
      longitude: 79.5631,
      medical_notes: 'Senior parents (71 & 74 yrs). Routine BP checkups & pharmacy runs.',
    },
  ]);

  await supabase.from('partners_profile').upsert([
    {
      user_id: PARTNER_ID,
      service_category: 'MEDICAL_TRANSPORT',
      operating_region: 'Miryalaguda & Nalgonda Hub',
      kyc_verified: true,
      is_active: true,
      wallet_balance: 0.0,
    },
  ]);
  console.log('✅ Supabase Public Tables: Seeded Client, Parent, and Partner profiles.');

  // --- 3. SQLite Database Setup ---
  console.log('\n--- 3. Setting up Local SQLite Database ---');
  db.transaction(() => {
    // Upsert Users
    db.prepare(`
      INSERT OR REPLACE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'CLIENT', ?, '+1 408 555 0199', 'Rajesh Reddy (NRI Son)', ?, datetime('now'))
    `).run(CLIENT_ID, CLIENT_EMAIL, CLIENT_ID);

    db.prepare(`
      INSERT OR REPLACE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
      VALUES (?, 'PARTNER', ?, '+91 94401 55667', 'Pavan Kumar (Field Partner)', ?, datetime('now'))
    `).run(PARTNER_ID, PARTNER_EMAIL, PARTNER_ID);

    // Upsert Client Profile
    db.prepare(`
      INSERT OR REPLACE INTO clients_profile (user_id, country_residence, currency, subscription_tier)
      VALUES (?, 'United States', 'USD', 'GOLD')
    `).run(CLIENT_ID);

    // Upsert Parent Profile
    db.prepare(`
      INSERT OR REPLACE INTO parents_profile (id, client_id, parent_name, primary_phone, locality, full_address, coordinates_lat, coordinates_lng, medical_notes)
      VALUES (?, ?, 'Mrs. Lakshmi & Mr. Ramana Reddy', '+91 94401 22334', 'Reddy Colony, Miryalaguda', 'Plot 42, Beside Anjaneya Temple, Reddy Colony, Miryalaguda, Telangana 508207', 16.8724, 79.5631, 'Senior parents (71 & 74 yrs). Routine BP checkups & pharmacy runs.')
    `).run(PARENT_ID, CLIENT_ID);

    // Upsert Partner Profile
    db.prepare(`
      INSERT OR REPLACE INTO partners_profile (user_id, service_category, operating_region, kyc_verified, is_active, wallet_balance)
      VALUES (?, 'MEDICAL_TRANSPORT', 'Miryalaguda & Nalgonda Hub', 1, 1, 0.0)
    `).run(PARTNER_ID);
  })();
  console.log('✅ SQLite: Seeded Client, Parent, and Partner profiles.');

  // --- 4. Final Verification ---
  console.log('\n======================================================================');
  console.log('📋 VERIFYING EXACTLY 3 ACCOUNTS ACROSS ALL PLATFORMS:');
  console.log('======================================================================');
  
  const { data: { users: finalAuth } } = await supabase.auth.admin.listUsers();
  console.log(`Supabase Auth Accounts (Count: ${finalAuth.length}):`);
  finalAuth.forEach(u => console.log(`  • [${u.user_metadata?.role || 'UNKNOWN'}] ${u.email} (ID: ${u.id})`));

  const { data: finalDb } = await supabase.from('users').select('*');
  console.log(`\nSupabase Public Users (Count: ${finalDb.length}):`);
  finalDb.forEach(u => console.log(`  • [${u.role}] ${u.email} (${u.full_name})`));

  const finalSqlite = db.prepare('SELECT id, role, email, full_name FROM users').all();
  console.log(`\nSQLite Users (Count: ${finalSqlite.length}):`);
  finalSqlite.forEach(u => console.log(`  • [${u.role}] ${u.email} (${u.full_name})`));

  if (finalAuth.length === 3 && finalDb.length === 3 && finalSqlite.length === 3) {
    console.log('\n🎉 SUCCESS: Exactly 3 accounts exist across all systems!');
  } else {
    console.error('\n⚠️ WARNING: Account count mismatch!');
  }
  console.log('======================================================================\n');
}

setupTrioAccounts().catch(console.error);
