const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
require('dotenv').config();

const ADMIN_EMAIL = 'admin@familyhubs.in';
const ADMIN_ID = '8c7b8a7c-e474-49be-a9ba-ba780a5d056c';
const ADMIN_PASSWORD = 'Admin@FamilyHubs2026!';

async function cleanAllExceptAdmin() {
  console.log('======================================================================');
  console.log('🧹 PURGING ALL DEMO & NON-ADMIN ACCOUNTS (KEEPING ONLY ONE ADMIN)');
  console.log('======================================================================');

  // 1. Clean SQLite database
  console.log('\n--- 1. Purging SQLite Database ---');
  const db = new Database('./server/familyhubs.db');

  const deleteSqlite = db.transaction(() => {
    // Delete all dependent child tables first
    db.prepare('DELETE FROM whatsapp_logs').run();
    db.prepare('DELETE FROM verification_logs').run();
    db.prepare('DELETE FROM escrow_transactions').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM parents_profile').run();
    db.prepare('DELETE FROM clients_profile').run();
    db.prepare('DELETE FROM partners_profile').run();

    // Delete all users except admin
    const delResult = db.prepare('DELETE FROM users WHERE email != ?').run(ADMIN_EMAIL);
    console.log(`SQLite: Removed ${delResult.changes} non-admin users.`);

    // Ensure official admin exists in SQLite
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);
    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
        VALUES (?, 'ADMIN', ?, '+91 90000 88888', 'Operations Administrator', ?, datetime('now'))
      `).run(ADMIN_ID, ADMIN_EMAIL, ADMIN_ID);
      console.log('SQLite: Seeded single official Admin account.');
    } else {
      console.log('SQLite: Single official Admin account verified.');
    }
  });

  deleteSqlite();
  const remainingSqliteUsers = db.prepare('SELECT id, role, email, full_name FROM users').all();
  console.log('SQLite Remaining Users count:', remainingSqliteUsers.length);
  remainingSqliteUsers.forEach(u => console.log(`  • [${u.role}] ${u.email} (${u.full_name})`));

  // 2. Clean Supabase Auth & Public Database
  console.log('\n--- 2. Purging Supabase Cloud Database & Auth Users ---');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase credentials not configured in .env');
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // A. Purge public tables in Supabase
  try {
    await supabase.from('whatsapp_logs').delete().neq('id', 'keep_none');
    await supabase.from('verification_logs').delete().neq('id', 'keep_none');
    await supabase.from('escrow_transactions').delete().neq('id', 'keep_none');
    await supabase.from('tasks').delete().neq('id', 'keep_none');
    await supabase.from('parents_profile').delete().neq('id', 'keep_none');
    await supabase.from('clients_profile').delete().neq('user_id', 'keep_none');
    await supabase.from('partners_profile').delete().neq('user_id', 'keep_none');
    const { error: delDbErr } = await supabase.from('users').delete().neq('email', ADMIN_EMAIL);
    if (delDbErr) {
      console.warn('Supabase DB users deletion warning:', delDbErr.message);
    } else {
      console.log('Supabase: Cleaned all non-admin records from public tables.');
    }
  } catch (err) {
    console.warn('Error clearing Supabase public tables:', err.message);
  }

  // B. Purge Supabase Auth users except admin
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('Failed to list Supabase auth users:', listErr.message);
    return;
  }

  console.log(`Supabase Auth: Found ${users.length} total auth users.`);
  let deletedAuthCount = 0;

  for (const user of users) {
    if (user.email === ADMIN_EMAIL) {
      console.log(`  ⭐ Preserving Official Admin: ${user.email} (${user.id})`);
      continue;
    }

    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.warn(`  ⚠️ Failed to delete ${user.email}:`, delErr.message);
    } else {
      deletedAuthCount++;
    }
  }
  console.log(`Supabase Auth: Deleted ${deletedAuthCount} non-admin auth accounts.`);

  // C. Ensure single official Admin account is present and active in Supabase Auth & Public DB
  const { data: { users: checkUsers } } = await supabase.auth.admin.listUsers();
  const adminAuth = checkUsers.find(u => u.email === ADMIN_EMAIL);

  if (!adminAuth) {
    console.log('Creating single official admin in Supabase Auth...');
    const { data: newAdmin, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'ADMIN',
        full_name: 'Operations Administrator',
        phone: '+91 90000 88888',
      },
    });
    if (createErr) console.error('Error creating admin in Supabase:', createErr.message);
    else console.log('Created admin in Supabase Auth:', newAdmin.user.id);
  } else {
    // Update admin password to ensure it is known and valid
    await supabase.auth.admin.updateUserById(adminAuth.id, {
      password: ADMIN_PASSWORD,
      user_metadata: {
        role: 'ADMIN',
        full_name: 'Operations Administrator',
        phone: '+91 90000 88888',
      },
    });
    console.log('Admin account password and metadata confirmed in Supabase Auth.');
  }

  // Ensure Admin row in public.users
  await supabase.from('users').upsert({
    id: ADMIN_ID,
    role: 'ADMIN',
    email: ADMIN_EMAIL,
    phone: '+91 90000 88888',
    full_name: 'Operations Administrator',
    auth_provider_id: ADMIN_ID,
  });

  // Final verification
  console.log('\n======================================================================');
  console.log('✅ AUDIT CONFIRMATION: ONLY ONE ADMIN ACCOUNT REMAINS');
  console.log('======================================================================');
  const { data: { users: finalAuth } } = await supabase.auth.admin.listUsers();
  console.log(`Supabase Auth accounts count: ${finalAuth.length}`);
  finalAuth.forEach(u => console.log(`  • Email: ${u.email} | ID: ${u.id}`));

  const { data: finalDb } = await supabase.from('users').select('*');
  console.log(`Supabase public.users count: ${finalDb?.length}`);
  finalDb?.forEach(u => console.log(`  • Role: ${u.role} | Email: ${u.email}`));

  const finalSqlite = db.prepare('SELECT id, role, email, full_name FROM users').all();
  console.log(`SQLite users count: ${finalSqlite.length}`);
  finalSqlite.forEach(u => console.log(`  • Role: ${u.role} | Email: ${u.email}`));
  console.log('======================================================================\n');
}

cleanAllExceptAdmin().catch(console.error);
