'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc('tinash_role');
  return { supabase, user, canWrite: role === 'admin' || role === 'ops' };
}

export type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Create a new hire record and hand them an onboarding pack in one step. */
export async function startOnboarding(form: FormData): Promise<Result> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: 'Your role cannot assign onboarding.' };

  const fullName = String(form.get('full_name') ?? '').trim();
  const workflowId = String(form.get('workflow_id') ?? '');
  if (!fullName) return { ok: false, error: 'Give the new hire a name.' };
  if (!workflowId) return { ok: false, error: 'Choose a workflow.' };

  const email = String(form.get('email') ?? '').trim() || null;
  const phone = String(form.get('phone') ?? '').trim() || null;
  if (!email && !phone) {
    return { ok: false, error: 'Add an email address or a mobile number, otherwise there is no way to send them the link.' };
  }

  const startDate = String(form.get('start_date') ?? '').trim() || null;

  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .insert({
      full_name: fullName.slice(0, 120),
      email,
      phone,
      job_title: String(form.get('job_title') ?? 'Caregiver').slice(0, 120),
      employment: 'onboarding',
      start_date: startDate,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (empErr || !emp) return { ok: false, error: empErr?.message ?? 'Could not create the record.' };

  const dueOn = String(form.get('due_on') ?? '').trim() || null;

  const { data: assignment, error: asgErr } = await supabase
    .from('assignments')
    .insert({
      workflow_id: workflowId,
      employee_id: emp.id,
      status: 'draft',
      due_on: dueOn,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (asgErr || !assignment) return { ok: false, error: asgErr?.message ?? 'Could not create the pack.' };

  revalidatePath('/dashboard/onboarding');
  revalidatePath('/dashboard/people');
  return { ok: true, id: assignment.id };
}

/**
 * Marking a pack as sent is what makes its link work. A draft pack returns
 * nothing to the portal, so a link cannot leak before the office means to send it.
 */
export async function setAssignmentStatus(id: string, status: string): Promise<Result> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: 'Your role cannot change onboarding.' };
  if (!['draft', 'sent', 'in_progress', 'complete', 'revoked'].includes(status)) {
    return { ok: false, error: 'Unknown status.' };
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'sent') patch.sent_at = new Date().toISOString();

  const { error } = await supabase.from('assignments').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/onboarding');
  revalidatePath(`/dashboard/onboarding/${id}`);
  return { ok: true };
}

/** Issues a fresh token, which instantly kills the old link. */
export async function regenerateLink(id: string): Promise<Result> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: 'Your role cannot change onboarding.' };

  const { data, error } = await supabase.rpc('rotate_assignment_token', { p_assignment: id });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/onboarding/${id}`);
  return { ok: true, id: String(data ?? '') };
}
