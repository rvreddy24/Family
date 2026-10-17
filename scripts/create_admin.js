require('dotenv').config();
const { supabaseAdmin } = require('../server/supabase');
const db = require('better-sqlite3')('./server/familyhubs.db');

async function createSingleAdmin() {
  console.log('--- CREATING SINGLE OFFICIAL ADMIN ACCOUNT ---');
  const email = 'admin@familyhubs.in';
  const password = 'Admin@FamilyHubs2026!';
  const fullName = 'Operations Administrator';
  const phone = '+91 90000 88888';

  let authUserId = 'usr_ops_admin';

  // 1. Supabase Cloud Sync
  if (supabaseAdmin) {
    try {
      console.log('Checking Supabase Auth for existing admin user...');
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuth = authList?.users?.find(u => u.email && u.email.toLowerCase() === email);

      if (existingAuth) {
        console.log(`Found existing auth user ${existingAuth.id}. Updating password & metadata...`);
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, {
          password,
          user_metadata: { role: 'ADMIN', full_name: fullName, phone },
          email_confirm: true,
        });
        if (updErr) console.error('Error updating auth user:', updErr.message);
        else console.log('✅ Supabase Auth user password and metadata updated.');
        authUserId = existingAuth.id;
      } else {
        console.log('Creating new auth user in Supabase Auth...');
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'ADMIN', full_name: fullName, phone },
        });
        if (createErr) {
          console.error('Error creating auth user:', createErr.message);
        } else {
          console.log(`✅ Created Supabase Auth user: ${newUser.user.id}`);
          authUserId = newUser.user.id;
        }
      }

      // Upsert into public.users
      console.log('Upserting into Supabase public.users table...');
      const { error: pubErr } = await supabaseAdmin.from('users').upsert({
        id: authUserId,
        role: 'ADMIN',
        email,
        phone,
        full_name: fullName,
      });
      if (pubErr) console.error('Error upserting public.users:', pubErr.message);
      else console.log('✅ Supabase public.users updated successfully.');

    } catch (err) {
      console.error('Supabase admin creation error:', err.message);
    }
  } else {
    console.warn('Supabase admin client not initialized.');
  }

  // 2. Local SQLite Sync
  console.log('Syncing into local SQLite database...');
  db.prepare(`
    INSERT OR REPLACE INTO users (id, role, email, phone, full_name, auth_provider_id, created_at)
    VALUES (?, 'ADMIN', ?, ?, ?, ?, datetime('now'))
  `).run(authUserId, email, phone, fullName, authUserId);

  console.log('✅ Local SQLite admin user created.');

  // Verification
  console.log('\n--- VERIFICATION ---');
  const localAdmin = db.prepare("SELECT id, role, email, full_name, phone FROM users WHERE email = ?").get(email);
  console.log('Local SQLite record:', localAdmin);

  if (supabaseAdmin) {
    const { data: cloudAdmin } = await supabaseAdmin.from('users').select('*').eq('email', email).maybeSingle();
    console.log('Supabase Cloud record:', cloudAdmin);
  }

  console.log('\n🎉 Single Admin Account successfully created and configured!');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     ADMIN`);
}

createSingleAdmin().catch(console.error);
