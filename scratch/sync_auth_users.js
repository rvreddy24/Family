require('dotenv').config();
const { supabaseAdmin } = require('../server/supabase');

async function syncAuthUsers() {
  console.log('Syncing demo accounts into Supabase Auth (auth.users)...');

  const demoAccounts = [
    {
      email: 'demo.client@familyhubs.com',
      password: 'DemoPassword123!',
      user_metadata: {
        full_name: 'Demo Client (NRI Family)',
        role: 'CLIENT',
        app_user_id: 'usr_demo_client',
      },
      appUserId: 'usr_demo_client',
    },
    {
      email: 'demo.admin@familyhubs.com',
      password: 'DemoPassword123!',
      user_metadata: {
        full_name: 'Demo Operations Admin',
        role: 'ADMIN',
        app_user_id: 'usr_demo_admin',
      },
      appUserId: 'usr_demo_admin',
    },
    {
      email: 'demo.partner@familyhubs.com',
      password: 'DemoPassword123!',
      user_metadata: {
        full_name: 'Demo Field Partner',
        role: 'PARTNER',
        app_user_id: 'usr_demo_partner',
      },
      appUserId: 'usr_demo_partner',
    },
  ];

  for (const acc of demoAccounts) {
    try {
      // Check if user already exists in Supabase Auth
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users?.find((u) => u.email === acc.email);

      let authUserId;
      if (!found) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true, // Auto-confirm email so they can log in without verification link
          user_metadata: acc.user_metadata,
        });

        if (error) {
          console.error(`Failed to create ${acc.email} in auth.users:`, error.message);
          continue;
        }
        authUserId = data.user.id;
        console.log(`✅ Created ${acc.email} in Supabase Auth (UUID: ${authUserId})`);
      } else {
        authUserId = found.id;
        console.log(`ℹ️ ${acc.email} already exists in Supabase Auth (UUID: ${authUserId})`);
      }

      // Link auth_provider_id in public.users table
      await supabaseAdmin
        .from('users')
        .update({ auth_provider_id: authUserId })
        .eq('id', acc.appUserId);
    } catch (err) {
      console.error(`Error processing ${acc.email}:`, err.message);
    }
  }

  // Verify list
  const { data: finalAuth } = await supabaseAdmin.auth.admin.listUsers();
  console.log('\nSupabase Auth Users count:', finalAuth?.users?.length);
  console.table(
    finalAuth?.users?.map((u) => ({
      id: u.id,
      email: u.email,
      confirmed: Boolean(u.email_confirmed_at),
      role: u.user_metadata?.role,
    }))
  );
}

syncAuthUsers().catch(console.error);
