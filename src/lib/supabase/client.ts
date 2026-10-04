'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_SCHEMA, SUPABASE_URL, supabaseConfigured } from './env';

export { supabaseConfigured };

/** Browser client. Callers must check `supabaseConfigured` first. */
export function createClient() {
  if (!supabaseConfigured) throw new Error('Supabase is not configured');
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: SUPABASE_SCHEMA } });
}
