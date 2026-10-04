'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2, Archive, Lock, Users2, Check } from 'lucide-react';
import { Card, CardHead } from '@/components/crm/ui';
import type { Board } from '@/lib/crm/board';
import {
  createBoard, updateBoardVisibility, archiveBoard,
} from '@/app/(dashboard)/dashboard/settings/actions';
import TeamAccess, { type Member, type Invite } from '@/components/crm/TeamAccess';

export type { Invite };

import { ROLE_OPTIONS as ROLES } from '@/components/crm/TeamAccess';

function Banner({ msg, tone }: { msg: string; tone: 'ok' | 'bad' }) {
  return (
    <p
      role={tone === 'bad' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ${
        tone === 'bad'
          ? 'bg-red-50 text-red-800 ring-red-200'
          : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      }`}
    >
      {msg}
    </p>
  );
}

export default function SettingsClient({
  boards, team, invites, isAdmin, meId,
}: { boards: Board[]; team: Member[]; invites: Invite[]; isAdmin: boolean; meId: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);
  const [adding, setAdding] = useState(false);

  function run(fn: () => Promise<{ ok: true; note?: string } | { ok: false; error: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg({ text: r.note ?? 'Saved.', tone: 'ok' }); setAdding(false); }
      else setMsg({ text: r.error, tone: 'bad' });
    });
  }

  const field = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm';
  const label = 'block text-xs font-semibold text-slate-700';

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <TeamAccess team={team} invites={invites} isAdmin={isAdmin} meId={meId} />

      {msg && <Banner msg={msg.text} tone={msg.tone} />}

      <Card>
        <CardHead
          title="Boards"
          sub="Each board names the roles allowed to open it. This is enforced by the database, not by hiding a menu item."
          icon={Users2}
          action={
            <button
              onClick={() => { setAdding((v) => !v); setMsg(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-plum-700 px-3 py-2 text-xs font-bold text-white hover:bg-plum-800"
            >
              <Plus className="h-3.5 w-3.5" /> New board
            </button>
          }
        />

        {adding && (
          <form action={(fd) => run(() => createBoard(fd))} className="border-b border-slate-100 bg-slate-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="b-name" className={label}>Board name</label>
                <input id="b-name" name="name" required placeholder="Compliance" className={field} />
              </div>
              <div>
                <label htmlFor="b-pos" className={label}>Order in the tab bar</label>
                <input id="b-pos" name="position" type="number" defaultValue={100} className={field} />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="b-desc" className={label}>What this board is for</label>
              <input id="b-desc" name="description" placeholder="Everything with a filing deadline attached." className={field} />
            </div>
            <fieldset className="mt-4">
              <legend className={label}>Who can open it</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <label key={r.key} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      name={`role_${r.key}`}
                      defaultChecked={r.key === 'admin' || r.key === 'ops'}
                      disabled={r.key === 'admin'}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      <span className="block font-semibold text-plum-950">{r.label}</span>
                      <span className="block text-xs text-slate-500">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Administrators always keep access, so nobody can create a board they cannot open.
              </p>
            </fieldset>
            <button
              type="submit"
              disabled={pending}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-plum-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Create board
            </button>
          </form>
        )}

        <ul className="divide-y divide-slate-100">
          {boards.map((b) => (
            <li key={b.id} className="p-5">
              <form action={(fd) => run(() => updateBoardVisibility(b.id, fd))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-plum-950">
                      {b.visible_to.includes('viewer')
                        ? <Users2 className="h-4 w-4 text-teal-700" />
                        : <Lock className="h-4 w-4 text-teal-700" />}
                      {b.name}
                    </p>
                    {b.description && <p className="mt-1 text-sm text-slate-600">{b.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => run(() => archiveBoard(b.id))}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ROLES.map((r) => (
                    <label
                      key={r.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium"
                    >
                      <input
                        type="checkbox"
                        name={`v_${b.id}_${r.key}`}
                        defaultChecked={b.visible_to.includes(r.key)}
                        disabled={r.key === 'admin'}
                        className="rounded border-slate-300"
                      />
                      {r.label}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-plum-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Save access
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </Card>

    </div>
  );
}
