'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { INQUIRY_STAGE_KEYS } from '@/lib/pipeline';

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc('tinash_role');
  return { supabase, user, canWrite: role === 'admin' || role === 'ops' };
}

export type Result = { ok: true; note?: string } | { ok: false; error: string };

const NO_WRITE = 'Your role can see the inbox but cannot work it.';

function touched() {
  revalidatePath('/dashboard/inbox');
  revalidatePath('/dashboard/contacts');
  revalidatePath('/dashboard');
}

export async function setInquiryStatus(id: string, status: string): Promise<Result> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };
  if (!INQUIRY_STAGE_KEYS.includes(status)) return { ok: false, error: 'Unknown status.' };

  const { data: row, error } = await supabase
    .from('inquiries')
    .update({ status, handled_at: status === 'new' ? null : new Date().toISOString() })
    .eq('id', id)
    .select('contact_id')
    .single();

  if (error) return { ok: false, error: error.message };

  // The person's own status follows the enquiry, so the contacts list stays true.
  if (row?.contact_id) {
    await supabase
      .from('contacts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', row.contact_id);
  }

  touched();
  revalidatePath('/dashboard/inquiries');
  return { ok: true, note: `Marked ${status.replace(/_/g, ' ')}.` };
}

export async function claimInquiry(id: string, take: boolean): Promise<Result> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };

  const { error } = await supabase
    .from('inquiries')
    .update({ owner_id: take ? user?.id ?? null : null })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  touched();
  return { ok: true, note: take ? 'You own this one.' : 'Released.' };
}

export async function setBookingStatus(id: string, status: string): Promise<Result> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };
  if (!['requested', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return { ok: false, error: 'Unknown status.' };
  }

  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  touched();
  return { ok: true, note: `Appointment ${status}.` };
}

/**
 * The point of the whole thing: an enquiry becomes a card someone owns, on a
 * board, with a due date. It carries the contact details across so nobody has
 * to go back and look them up.
 */
export async function inquiryToTask(
  inquiryId: string, boardId: string
): Promise<Result> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };
  if (!boardId) return { ok: false, error: 'Choose a board first.' };

  const { data: inq, error: readErr } = await supabase
    .from('inquiries')
    .select('id, name, email, phone, service_interested, message, source_page, cta, status')
    .eq('id', inquiryId)
    .single();

  if (readErr || !inq) return { ok: false, error: readErr?.message ?? 'Could not read that enquiry.' };

  const reach = [inq.phone, inq.email].filter(Boolean).join(' · ') || 'no contact details given';
  const notes = [
    `From the website${inq.source_page ? ` (${inq.source_page})` : ''}${inq.cta ? ` via ${inq.cta}` : ''}.`,
    `Reach them on ${reach}.`,
    inq.service_interested ? `Asked about: ${inq.service_interested}.` : null,
    inq.message ? `\nWhat they wrote:\n${inq.message}` : null,
  ].filter(Boolean).join('\n');

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      title: `Follow up: ${inq.name}`,
      notes: notes.slice(0, 4000),
      work_type: 'todo',
      priority: 'high',
      stage: 'todo',
      // Home care inquiries go cold fast, so it lands with tomorrow on it.
      due_at: new Date(Date.now() + 864e5).toISOString(),
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
      position: Date.now(),
      linked_type: 'inquiry',
      linked_id: inq.id,
      labels: ['website-lead'],
    })
    .select('id')
    .single();

  if (taskErr || !task) return { ok: false, error: taskErr?.message ?? 'Could not create the card.' };

  const { error: linkErr } = await supabase
    .from('board_items')
    .insert({ board_id: boardId, task_id: task.id, position: Date.now(), added_by: user?.id ?? null });

  if (linkErr) return { ok: false, error: linkErr.message };

  if (inq.status === 'new') {
    await supabase
      .from('inquiries')
      .update({ status: 'contacted', handled_at: new Date().toISOString() })
      .eq('id', inq.id);
  }

  touched();
  revalidatePath('/dashboard/board');
  revalidatePath('/dashboard/my-work');
  return { ok: true, note: `Card created and assigned to you, due tomorrow.` };
}
