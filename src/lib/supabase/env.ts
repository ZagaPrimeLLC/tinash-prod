/**
 * Supabase settings. All three are public by design (the anon key ships in the
 * browser bundle; Row Level Security is the lock). When they are missing the
 * public site still builds and runs: forms fall back to /api/inquiry, careers
 * shows the "no openings listed" state, and the CRM shows "not connected".
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SUPABASE_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'proj_tinash';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
