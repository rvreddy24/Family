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
    const auth = await fetch(new URL('/auth/v1/settings',supabaseUrl),{
      headers:{apikey:process.env.SUPABASE_ANON_KEY||supabaseServiceKey},signal:AbortSignal.timeout(5000),
    });
    await require('./db').db.prepare('SELECT id FROM users LIMIT 1').get();
    const cloud = process.env.DATA_BACKEND === 'postgres';
    let storageReady = null;
    if(cloud){
      const bucket=await supabaseAdmin.storage.getBucket(process.env.PRIVATE_STORAGE_BUCKET||'familyhubs-proofs');
      storageReady=!bucket.error&&bucket.data?.public===false;
    }
    const connected=auth.ok&&storageReady!==false;
    return {connected,authConnected:auth.ok,operationalConnected:true,tablesReady:true,storageReady,backend:cloud?'postgres':'sqlite',
      message:connected?`Authentication and operational ${cloud?'PostgreSQL/private storage':'SQLite'} connections verified.`:'An authentication or private storage connection needs attention.'};
  } catch {
    return { connected: false, message:'A required service could not be reached. Check the server configuration and service status.' };
  }
}

module.exports = {supabaseAdmin, isSupabaseConfigured, checkSupabaseHealth};
