'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { STAGE_KEYS } from '@/lib/crm/board';

/**
 * Every action is also gated by row level security, so a leadership account
 * posting one of these by hand would still be refused by the database. These
 * checks exist to give a clear message, not to be the lock.
 */
async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc('tinash_role');
  return { supabase, user, canWrite: role === 'admin' || role === 'ops' };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const NO_WRITE = 'Your role can see this board but cannot change it.';

function touched(id?: string) {
  revalidatePath('/dashboard/board');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/my-work');
  if (id) revalidatePath(`/dashboard/board/${id}`);
}

const TASK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveItemDetails(
  id: string, original: { title: string; notes: string | null }, form: FormData
): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!user || !canWrite) return { ok: false, error: NO_WRITE };
  if (!TASK_ID.test(id)) return { ok: false, error: 'That item could not be found.' };
  const title = String(form.get('title') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim();
  if (!title || title.length > 200) return { ok: false, error: 'Enter a summary of 1 to 200 characters.' };
  if (notes.length > 4000) return { ok: false, error: 'Keep notes to 4,000 characters or fewer.' };
  if (!original || typeof original.title !== 'string' || (original.notes !== null && typeof original.notes !== 'string')) {
    return { ok: false, error: 'Reload this item before editing it.' };
  }

  // Compare the details the editor opened, so another person's changes cannot
  // be silently overwritten. A separate stage or assignment change is preserved.
  let query = supabase.from('tasks')
    .update({ title, notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', id).eq('title', original.title);
  query = original.notes === null ? query.is('notes', null) : query.eq('notes', original.notes);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'This item changed or is no longer available. Copy your edits, then reload to see the latest version.' };
  touched(id);
  return { ok: true };
}

const PRIORITY_KEYS = ['urgent', 'high', 'normal', 'low'];
const WORK_TYPE_KEYS = ['epic', 'story', 'task', 'todo', 'issue', 'bug', 'milestone'];

/** Status, priority, type, owner and due date from the item information panel. */
export async function saveItemInfo(id: string, form: FormData): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!user || !canWrite) return { ok: false, error: NO_WRITE };
  if (!TASK_ID.test(id)) return { ok: false, error: 'That item could not be found.' };

  const stage = String(form.get('stage') ?? '');
  const priority = String(form.get('priority') ?? '');
  const workType = String(form.get('work_type') ?? '');
  const owner = String(form.get('owner_id') ?? '');
  const due = String(form.get('due_on') ?? '').trim();

  if (!STAGE_KEYS.includes(stage as never)) return { ok: false, error: 'Choose a status.' };
  if (!PRIORITY_KEYS.includes(priority)) return { ok: false, error: 'Choose a priority.' };
  if (!WORK_TYPE_KEYS.includes(workType)) return { ok: false, error: 'Choose a type.' };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: 'Enter the due date as a date.' };

  // Only people on the team can own work.
  if (owner) {
    if (!TASK_ID.test(owner)) return { ok: false, error: 'Choose someone from the team.' };
    const { data: member } = await supabase.from('team_roles').select('user_id').eq('user_id', owner).maybeSingle();
    if (!member) return { ok: false, error: 'That person is not on the team any more.' };
  }

  const { data: current } = await supabase.from('tasks').select('stage, completed_at').eq('id', id).maybeSingle();
  if (!current) return { ok: false, error: 'That item could not be found.' };

  const stageChanged = current.stage !== stage;
  const { error } = await supabase
    .from('tasks')
    .update({
      stage,
      priority,
      work_type: workType,
      owner_id: owner || null,
      due_at: due ? officeDeadline(due) : null,
      ...(stageChanged
        ? { completed_at: stage === 'done' ? new Date().toISOString() : null, status: stage === 'done' ? 'done' : 'open' }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  touched(id);
  return { ok: true };
}

/** A due date means close of business in the office: 5:00 PM New York time that day. */
function officeDeadline(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 17, 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(guess));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
  return new Date(guess - (asIfUtc - guess)).toISOString();
}

export async function addItemComment(id: string, form: FormData): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!user || !canWrite) return { ok: false, error: NO_WRITE };
  if (!TASK_ID.test(id)) return { ok: false, error: 'That item could not be found.' };
  const body = String(form.get('body') ?? '').trim();
  if (!body || body.length > 4000) return { ok: false, error: 'Enter a comment of 1 to 4,000 characters.' };
  const { error } = await supabase.from('task_comments').insert({ task_id: id, body });
  if (error) return { ok: false, error: 'Could not add the comment. Reload the item and try again.' };
  touched(id);
  return { ok: true };
}

export async function createItem(form: FormData): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };

  const title = String(form.get('title') ?? '').trim();
  if (!title) return { ok: false, error: 'Give the item a title.' };

  const stage = String(form.get('stage') ?? 'backlog');
  if (!STAGE_KEYS.includes(stage as never)) return { ok: false, error: 'Unknown column.' };

  const boardId = String(form.get('board_id') ?? '');
  if (!boardId) return { ok: false, error: 'No board chosen.' };

  const dueRaw = String(form.get('due_at') ?? '').trim();

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: title.slice(0, 200),
      notes: String(form.get('notes') ?? '').trim().slice(0, 4000) || null,
      work_type: String(form.get('work_type') ?? 'task'),
      priority: String(form.get('priority') ?? 'normal'),
      stage,
      due_at: dueRaw ? new Date(dueRaw).toISOString() : null,
      created_by: user?.id ?? null,
      owner_id: form.get('mine') ? user?.id ?? null : null,
      position: Date.now(),
    })
    .select('id')
    .single();

  if (error || !task) return { ok: false, error: error?.message ?? 'Could not create that.' };

  // A card with no board is invisible to everyone but admin and ops, so it is
  // placed on the board it was created from in the same breath.
  const { error: linkErr } = await supabase
    .from('board_items')
    .insert({ board_id: boardId, task_id: task.id, position: Date.now(), added_by: user?.id ?? null });

  if (linkErr) return { ok: false, error: linkErr.message };

  touched();
  return { ok: true };
}

export async function moveItem(id: string, stage: string): Promise<ActionResult> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };
  if (!STAGE_KEYS.includes(stage as never)) return { ok: false, error: 'Unknown column.' };

  const { error } = await supabase
    .from('tasks')
    .update({
      stage,
      completed_at: stage === 'done' ? new Date().toISOString() : null,
      status: stage === 'done' ? 'done' : 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  touched();
  return { ok: true };
}

export async function claimItem(id: string, take: boolean): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };

  const { error } = await supabase
    .from('tasks')
    .update({ owner_id: take ? user?.id ?? null : null, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  touched();
  return { ok: true };
}

/**
 * Put an existing card on another board, or take it off one. There is still
 * only one task row behind it, so a change made on either board shows on both.
 */
export async function setBoardLink(
  taskId: string, boardId: string, on: boolean
): Promise<ActionResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };

  if (on) {
    const { error } = await supabase
      .from('board_items')
      .insert({ board_id: boardId, task_id: taskId, position: Date.now(), added_by: user?.id ?? null });
    if (error && !error.message.includes('duplicate')) return { ok: false, error: error.message };
  } else {
    // Refuse to strand a card where nobody but admin and ops can find it.
    const { count } = await supabase
      .from('board_items')
      .select('board_id', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'This is the only board it is on. Put it on another board first, otherwise it disappears from every board.' };
    }

    const { error } = await supabase
      .from('board_items')
      .delete()
      .eq('task_id', taskId)
      .eq('board_id', boardId);
    if (error) return { ok: false, error: error.message };
  }

  touched();
  return { ok: true };
}

/**
 * Persists a drag. The client sends the whole target column in its new order,
 * which avoids fractional index drift and means one call covers both a move
 * between columns and a reorder within one.
 *
 * Stage lives on the task and position lives on the board link, so dragging a
 * shared card to Done moves it on every board it appears on, while reordering
 * it only affects the board you are looking at. That is deliberate.
 *
 * Only the card that was dragged can change column. The rest of the list comes
 * from the browser and may be stale: a teammate may have finished one of those
 * cards since this tab loaded, and a reorder must not drag it back to To Do.
 */
export async function applyColumnOrder(
  boardId: string, stage: string, orderedTaskIds: string[], movedTaskId: string
): Promise<ActionResult> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: NO_WRITE };
  if (!STAGE_KEYS.includes(stage as never)) return { ok: false, error: 'Unknown column.' };
  if (orderedTaskIds.length > 500) return { ok: false, error: 'Too many cards in one move.' };

  const ids = orderedTaskIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return { ok: true };

  const { data: current } = await supabase
    .from('tasks')
    .select('id, stage')
    .in('id', ids);

  const moved = (current ?? []).find((t) => t.id === movedTaskId);
  const needsStage = moved && moved.stage !== stage ? [moved.id] : [];

  if (needsStage.length > 0) {
    const { error } = await supabase
      .from('tasks')
      .update({
        stage,
        completed_at: stage === 'done' ? new Date().toISOString() : null,
        status: stage === 'done' ? 'done' : 'open',
        updated_at: new Date().toISOString(),
      })
      .in('id', needsStage);
    if (error) return { ok: false, error: error.message };
  }

  // Positions only for cards that really are in this column now (plus the one
  // just moved into it); anything else in the stale list keeps its place.
  const inColumn = new Set((current ?? []).filter((t) => t.stage === stage).map((t) => t.id));
  if (moved) inColumn.add(moved.id);
  const rows = ids.filter((id) => inColumn.has(id)).map((taskId, i) => ({
    board_id: boardId,
    task_id: taskId,
    position: (i + 1) * 1000,
  }));

  const { error: posErr } = await supabase
    .from('board_items')
    .upsert(rows, { onConflict: 'board_id,task_id' });

  if (posErr) return { ok: false, error: posErr.message };

  touched();
  return { ok: true };
}
