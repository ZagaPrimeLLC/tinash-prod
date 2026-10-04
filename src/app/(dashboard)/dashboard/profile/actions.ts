'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ProfileResult = { ok: true; note: string } | { ok: false; error: string };

/**
 * Saves the signed-in person's own name, title and photo. The profiles RLS
 * policy only lets anyone write their own row, so this cannot touch anyone else.
 */
export async function saveProfile(fd: FormData): Promise<ProfileResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const displayName = String(fd.get('display_name') ?? '').trim().slice(0, 80);
  const jobTitle = String(fd.get('job_title') ?? '').trim().slice(0, 80);
  const avatarRaw = String(fd.get('avatar_url') ?? '').trim();

  // Only a photo in this person's own folder of the avatars bucket is accepted.
  const ownFolder = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tinash-avatars/${user.id}/`;
  if (avatarRaw && !avatarRaw.startsWith(ownFolder)) {
    return { ok: false, error: 'That photo could not be used. Please upload it again.' };
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: displayName || null,
    job_title: jobTitle || null,
    avatar_url: avatarRaw || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard', 'layout');
  return { ok: true, note: 'Profile saved.' };
}
