/**
 * Client Supabase - BillShops (Hol Corporation)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Le mode local n'est autorisé qu'en développement explicite (VITE_DEV_LOCAL=true),
 * jamais en build de production (import.meta.env.DEV === false).
 */
export const isDevLocalMode =
  import.meta.env.DEV && import.meta.env.VITE_DEV_LOCAL === 'true';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://'))
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (!isSupabaseConfigured && !isDevLocalMode) {
  console.warn('[BillShops] Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY absentes.');
}
