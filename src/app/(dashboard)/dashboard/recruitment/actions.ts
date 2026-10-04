'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { STAGE_KEYS } from '@/lib/pipeline';

export type Result = { ok: true } | { ok: false; error: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves a caregiver application to another stage. Row level security is the
 * lock (member write); this check only gives a clear message.
 */
export async function setApplicationStage(id: string, stage: string): Promise<Result> {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('tinash_role');
  if (role !== 'admin' && role !== 'ops') return { ok: false, error: 'Your role can see the pipeline but cannot change it.' };
  if (!ID.test(id)) return { ok: false, error: 'That applicant could not be found.' };
  if (!STAGE_KEYS.includes(stage)) return { ok: false, error: 'Unknown stage.' };

  const { error } = await supabase
    .from('applications')
    .update({ stage, last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/recruitment');
  revalidatePath('/dashboard');
  return { ok: true };
}
