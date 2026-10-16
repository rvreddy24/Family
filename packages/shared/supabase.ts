import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL) || 'https://afuzvijsaubndtgwirrs.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmdXp2aWpzYXVibmR0Z3dpcnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMjg4ODUsImV4cCI6MjEwNzcwNDg4NX0.HUBt74yzOA8jFW56JqbOLzEV2alcmBu4rJA05_6d7ck';

export let supabase: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (err) {
  console.warn('[SUPABASE CLIENT WARN] Could not initialize client:', err);
}

export function isSupabaseAvailable(): boolean {
  return Boolean(supabase);
}
