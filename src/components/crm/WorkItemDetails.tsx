'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Send } from 'lucide-react';
import { saveItemDetails, addItemComment, saveItemInfo } from '@/app/(dashboard)/dashboard/board/actions';
import { STAGES, PRIORITIES, WORK_TYPES } from '@/lib/crm/board';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-plum-950 focus:border-plum-700 focus:outline-none focus:ring-2 focus:ring-plum-700/15 disabled:bg-slate-50';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg bg-plum-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-plum-800 disabled:opacity-60';

export function WorkItemDetails({
  id, title, notes, canWrite,
}: { id: string; title: string; notes: string | null; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNotes, setDraftNotes] = useState(notes ?? '');
  const [original, setOriginal] = useState({ title, notes });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!editing) return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-plum-950">Details</h2>
        {canWrite && <button type="button" onClick={() => {
          setOriginal({ title, notes }); setDraftTitle(title); setDraftNotes(notes ?? '');
          setEditing(true); setError(null); setSaved(false);
        }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-plum-700 hover:bg-slate-100">
          <Pencil className="h-3.5 w-3.5" /> Edit details
        </button>}
      </div>
      {saved && <p role="status" className="mt-3 text-sm text-emerald-700">Details saved.</p>}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
      <p className="mt-2 break-words text-base font-medium text-plum-950">{title}</p>
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
      <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed ${notes ? 'text-slate-700' : 'text-slate-400'}`}>
        {notes || 'No notes yet.'}
      </p>
    </div>
  );

  return (
    <form className="space-y-5 p-5 sm:p-6" action={(form) => start(async () => {
      setError(null);
      try {
        const result = await saveItemDetails(id, original, form);
        if (!result.ok) { setError(result.error); return; }
        setEditing(false); setSaved(true);
      } catch { setError('Could not save right now. Your edits are still here; please try again.'); }
    })}>
      <h2 className="text-sm font-bold text-plum-950">Edit details</h2>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div>
        <label htmlFor="item-summary" className="mb-2 block text-sm font-semibold text-plum-950">Summary</label>
        <input id="item-summary" name="title" required maxLength={200} autoFocus disabled={pending}
          value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="item-notes" className="mb-2 block text-sm font-semibold text-plum-950">Notes</label>
        <textarea id="item-notes" name="notes" rows={8} maxLength={4000} disabled={pending}
          value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} className={field}
          placeholder="Add context, instructions, or progress notes." />
        <p className="mt-1 text-xs text-slate-400">Up to 4,000 characters.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !draftTitle.trim()} className={button}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">Cancel</button>
      </div>
    </form>
  );
}

export function WorkItemCommentForm({ id, latestHref }: { id: string; latestHref: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  return (
    <form className="border-b border-slate-100 p-5 sm:p-6" action={(form) => start(async () => {
      setError(null); setPosted(false);
      try {
        const result = await addItemComment(id, form);
        if (!result.ok) { setError(result.error); return; }
        setBody(''); setPosted(true);
        router.replace(latestHref, { scroll: false });
      } catch { setError('Could not post right now. Your comment is still here; please try again.'); }
    })}>
      <label htmlFor="item-comment" className="mb-2 block text-sm font-semibold text-plum-950">Add a comment</label>
      <textarea id="item-comment" name="body" required maxLength={4000} rows={3} disabled={pending}
        value={body} onChange={(event) => { setBody(event.target.value); setPosted(false); }}
        placeholder="Share an update or ask a question." className={field} />
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {posted && <p role="status" className="mt-2 text-sm text-emerald-700">Comment added.</p>}
      <button type="submit" disabled={pending || !body.trim()} className={`${button} mt-3`}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  );
}

export type TeamOption = { id: string; name: string };

/** Status, priority, type, owner and due date, editable by admin and ops. */
export function ItemInfoForm({
  id, stage, priority, workType, ownerId, dueOn, team, canWrite, children,
}: {
  id: string; stage: string; priority: string; workType: string; ownerId: string | null;
  dueOn: string; team: TeamOption[]; canWrite: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const small = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-plum-950 focus:border-plum-700 focus:outline-none focus:ring-2 focus:ring-plum-700/15';
  const label = 'block text-xs text-slate-500';
  // Someone who left the team can still be shown as the current owner.
  const owners = ownerId && !team.some((t) => t.id === ownerId) ? [...team, { id: ownerId, name: 'Former team member' }] : team;

  if (!editing) return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-plum-950">Item information</h2>
        {canWrite && (
          <button type="button" onClick={() => { setEditing(true); setError(null); setSaved(false); }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-plum-700 hover:bg-slate-100">
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      {saved && <p role="status" className="mt-2 text-xs text-emerald-700">Saved.</p>}
      {children}
    </div>
  );

  return (
    <form className="space-y-3 p-5" action={(form) => start(async () => {
      setError(null);
      try {
        const r = await saveItemInfo(id, form);
        if (!r.ok) { setError(r.error); return; }
        setEditing(false); setSaved(true); router.refresh();
      } catch { setError('Could not save right now. Please try again.'); }
    })}>
      <h2 className="text-sm font-bold text-plum-950">Edit item information</h2>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      <div>
        <label htmlFor="ii-stage" className={label}>Status</label>
        <select id="ii-stage" name="stage" defaultValue={stage} disabled={pending} className={small}>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ii-priority" className={label}>Priority</label>
        <select id="ii-priority" name="priority" defaultValue={priority} disabled={pending} className={small}>
          {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ii-type" className={label}>Type</label>
        <select id="ii-type" name="work_type" defaultValue={workType} disabled={pending} className={small}>
          {WORK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ii-owner" className={label}>Assigned to</label>
        <select id="ii-owner" name="owner_id" defaultValue={ownerId ?? ''} disabled={pending} className={small}>
          <option value="">Unassigned</option>
          {owners.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ii-due" className={label}>Due date</label>
        <input id="ii-due" name="due_on" type="date" defaultValue={dueOn} disabled={pending} className={small} />
        <p className="mt-1 text-[11px] text-slate-400">Due by 5:00 PM New York time. Leave empty for no due date.</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={pending} className={`${button} px-3 py-2`}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={pending} onClick={() => setEditing(false)}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">Cancel</button>
      </div>
    </form>
  );
}
