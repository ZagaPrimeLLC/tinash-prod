import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_SCHEMA, SUPABASE_URL, supabaseConfigured } from './env';

/**
 * A plain anonymous client with no cookies: what a member of the public can
 * see. Returns null when Supabase is not configured.
 */
export function anonClient() {
  if (!supabaseConfigured) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: SUPABASE_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
