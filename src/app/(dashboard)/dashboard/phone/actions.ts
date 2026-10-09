'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LIMITS, VOICES } from '@/lib/crm/phone';

export type Result = { ok: true; note?: string } | { ok: false; error: string };

/**
 * Saves the Phone Assistant settings. The database checks the role again
 * (only admin and ops may update the row) and stamps who changed it; the
 * receptionist picks the change up within about 30 seconds, from its next call.
 */
export async function savePhoneSettings(form: FormData): Promise<Result> {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('tinash_role');
  if (role !== 'admin' && role !== 'ops') {
    return { ok: false, error: 'Only the operations team can change the phone assistant.' };
  }

  const text = (k: string) => String(form.get(k) ?? '').replace(/\r\n/g, '\n').trim();
  const greeting = text('greeting');
  const farewell = text('farewell');
  const custom = text('custom_instructions');
  const facts = text('extra_facts');
  const voice = VOICES.find((v) => v.key === text('voice'));
  const speed = Number(text('voice_speed'));
  const retention = Number.parseInt(text('transcript_retention_days'), 10);

  if (!voice) return { ok: false, error: 'Choose one of the voices.' };
  if (!Number.isFinite(speed) || speed < LIMITS.speedMin || speed > LIMITS.speedMax) {
    return { ok: false, error: `Speed must be between ${LIMITS.speedMin} and ${LIMITS.speedMax}.` };
  }
  if (!greeting) return { ok: false, error: 'The greeting cannot be empty: it is the first thing callers hear.' };
  if (!farewell) return { ok: false, error: 'The goodbye cannot be empty.' };
  if (greeting.length > LIMITS.greeting) return { ok: false, error: `Keep the greeting under ${LIMITS.greeting} characters.` };
  if (farewell.length > LIMITS.farewell) return { ok: false, error: `Keep the goodbye under ${LIMITS.farewell} characters.` };
  if (custom.length > LIMITS.custom_instructions) {
    return { ok: false, error: `Keep the tone and instructions under ${LIMITS.custom_instructions} characters.` };
  }
  if (facts.length > LIMITS.extra_facts) return { ok: false, error: `Keep the extra facts under ${LIMITS.extra_facts} characters.` };
  if (!Number.isInteger(retention) || retention < LIMITS.retentionMin || retention > LIMITS.retentionMax) {
    return { ok: false, error: `Keep transcripts for between ${LIMITS.retentionMin} and ${LIMITS.retentionMax} days.` };
  }

  const { data, error } = await supabase
    .from('phone_settings')
    .update({
      enabled: form.get('enabled') === 'on',
      test_mode: form.get('test_mode') === 'on',
      voice_engine: voice.engine,
      voice: voice.key,
      voice_speed: Math.round(speed * 100) / 100,
      greeting,
      farewell,
      custom_instructions: custom || null,
      extra_facts: facts || null,
      transcript_retention_days: retention,
    })
    .eq('id', 1)
    .select('id');

  if (error) return { ok: false, error: error.message };
  // RLS turns a refused update into "no rows", not an error.
  if (!data?.length) return { ok: false, error: 'Nothing was saved. Your role may not allow it; reload and try again.' };

  revalidatePath('/dashboard/phone', 'layout');
  return { ok: true, note: 'Saved. The assistant uses the new settings from its next call (within about 30 seconds).' };
}
