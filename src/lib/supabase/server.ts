import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON_KEY, SUPABASE_SCHEMA, SUPABASE_URL, supabaseConfigured } from './env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Cookie-bound server client. Callers must check `supabaseConfigured` first. */
export async function createClient() {
  if (!supabaseConfigured) throw new Error('Supabase is not configured');
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: SUPABASE_SCHEMA },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component; the proxy refreshes the session instead
        }
      },
    },
  });
}
