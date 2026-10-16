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
    return { connected: true, tablesReady: true, message: 'Supabase cloud database fully connected and synchronized.' };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// Upload forensic proof to Supabase Storage Bucket
async function uploadToSupabaseStorage(buffer, filename, contentType = 'image/jpeg') {
  if (!supabaseAdmin) return null;

  try {
    const bucketName = 'verification-proofs';
    
    // Ensure bucket exists (public read)
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === bucketName);
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(bucketName, { public: true });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filename, buffer, { contentType, upsert: true });

    if (error) {
      console.warn('[SUPABASE STORAGE WARN]', error.message);
      return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn('[SUPABASE STORAGE FAILED]', err.message);
    return null;
  }
}

module.exports = {
  supabaseAdmin,
  isSupabaseConfigured,
  checkSupabaseHealth,
  uploadToSupabaseStorage,
};
