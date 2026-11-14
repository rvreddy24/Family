const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[SUPABASE] Admin Client initialized successfully with service_role privileges.');
  } catch (err) {
    console.error('[SUPABASE ERROR] Failed to initialize client:', err.message);
  }
}

function isSupabaseConfigured() {
  return Boolean(supabaseAdmin);
}

// Test live connectivity to Supabase
async function checkSupabaseHealth() {
  if (!supabaseAdmin) {
    return { connected: false, message: 'Supabase credentials not configured in environment.' };
  }

  try {
    const { data, error } = await supabaseAdmin.from('security_settings').select('*').limit(1);
    if (error) {
      // If table doesn't exist yet in Supabase schema
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return {
          connected: true,
          tablesReady: false,
          message: 'Connected to Supabase project, but database tables are not yet created in SQL Editor.',
        };
      }
      return { connected: false, error: error.message };
    }
    return { connected: true, tablesReady: true, message: 'Supabase connection and core tables verified. Operational records are stored in local SQLite.' };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {supabaseAdmin, isSupabaseConfigured, checkSupabaseHealth};
