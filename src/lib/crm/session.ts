import { createClient } from '@/lib/supabase/server';
import type { Role } from './nav';

const KNOWN: Role[] = ['admin', 'ops', 'leadership', 'viewer'];

/**
 * Who is signed in and what they may do.
 *
 * The role lookup lives in proj_tinash, because the Supabase client is pinned to
 * that schema and every rpc() call resolves against it. A lookup that failed
 * used to be indistinguishable from a user with no role, which sent a real
 * administrator to the "not on the team" screen. The two are now separate:
 * `failed` means we could not ask, `role === null` means we asked and the
 * answer was nobody.
 */
export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: raw, error }, { data: profile }] = await Promise.all([
    supabase.rpc('tinash_role'),
    user
      ? supabase.from('profiles').select('display_name, avatar_url, job_title').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const role = (KNOWN as string[]).includes(raw as string)
    ? (raw as Role)
    : raw
      ? 'viewer'
      : null;

  return {
    supabase,
    user,
    email: user?.email ?? '',
    profile: (profile ?? null) as Profile | null,
    role: error ? null : role,
    failed: error ? error.message : null,
  };
}

export type Profile = { display_name: string | null; avatar_url: string | null; job_title: string | null };
