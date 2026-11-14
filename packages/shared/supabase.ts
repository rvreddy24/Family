import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY) || '';

export let supabase: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
} catch (err) {
  console.warn('[SUPABASE CLIENT WARN] Could not initialize client:', err);
}

export function isSupabaseAvailable(): boolean {
  return Boolean(supabase);
}
