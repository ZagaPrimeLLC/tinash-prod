'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Copy, Mail, UserMinus, UserPlus, Users2, X } from 'lucide-react';
import { Card, CardHead, ago } from '@/components/crm/ui';
import Avatar from '@/components/crm/Avatar';
import {
  addTeamMember, removeTeamMember, revokeTeamInvite, setTeamRole,
} from '@/app/(dashboard)/dashboard/settings/actions';

export const ROLE_OPTIONS = [
  { key: 'admin',      label: 'Administrator', hint: 'everything, including who is on the team' },
  { key: 'ops',        label: 'Operations',    hint: 'runs the boards, recruitment and onboarding' },
  { key: 'leadership', label: 'Leadership',    hint: 'sees the leadership board, changes nothing' },
  { key: 'viewer',     label: 'Viewer',        hint: 'limited, read only' },
] as const;

export type Member = {
  user_id: string; email: string; role: string; job_title: string | null;
  display_name: string | null; avatar_url: string | null; last_sign_in_at: string | null;
};
export type Invite = { id: string; email: string; role: string; job_title: string | null; created_at: string };

const roleLabel = (k: string) => ROLE_OPTIONS.find((r) => r.key === k)?.label ?? k;

export default function TeamAccess({
  team, invites, isAdmin, meId,
}: { team: Member[]; invites: Invite[]; isAdmin: boolean; meId: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [justInvited, setJustInvited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loginUrl = typeof window === 'undefined' ? '/login' : `${window.location.origin}/login`;
  const inviteText = (email: string) =>
    `You've been added to the Tinash Homecare Services team workspace. Sign in at ${loginUrl} with ${email}. ` +
    `We'll email you a one-time sign-in link; there is no password.`;

  function act(fn: () => Promise<{ ok: true; note?: string } | { ok: false; error: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { text: r.note ?? 'Saved.', ok: true } : { text: r.error, ok: false });
    });
  }

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setMsg(null);
    setJustInvited(null);
    start(async () => {
      const r = await addTeamMember(fd);
      if (!r.ok) {
        setMsg({ text: r.error, ok: false });
        return;
      }
      setMsg({ text: r.note, ok: true });
      if (r.status === 'invited') setJustInvited(r.email);
      form.reset();
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

  return (
    <Card>
      <CardHead
        title="Team and access"
        sub={isAdmin
          ? 'Add people by email and choose what they can do. No Supabase needed.'
          : 'Only an administrator can add people or change roles.'}
        icon={Users2}
      />

      {isAdmin && (
        <form onSubmit={add} className="grid gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div>
            <label htmlFor="tm-email" className="block text-xs font-semibold text-slate-700">Work email</label>
            <input id="tm-email" name="email" type="email" required autoComplete="off" placeholder="name@tinashhomecareservices.com" className={field} />
          </div>
          <div>
            <label htmlFor="tm-role" className="block text-xs font-semibold text-slate-700">Role</label>
            <select id="tm-role" name="role" defaultValue="ops" className={field}>
              {ROLE_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tm-title" className="block text-xs font-semibold text-slate-700">Job title <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="tm-title" name="job_title" maxLength={80} placeholder="Office supervisor" className={field} />
          </div>
          <button type="submit" disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-plum-700 px-4 py-2 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60">
            <UserPlus className="h-4 w-4" /> Add to team
          </button>
        </form>
      )}

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'}
          className={`mx-5 mt-4 rounded-lg px-4 py-3 text-sm ring-1 ${msg.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'}`}>
          {msg.text}
        </p>
      )}

      {justInvited && (
        <div className="mx-5 mt-3 rounded-lg bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
          <p className="font-semibold">Let {justInvited} know they can sign in:</p>
          <p className="mt-1.5 rounded bg-white px-3 py-2 text-slate-700 ring-1 ring-sky-100">{inviteText(justInvited)}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(inviteText(justInvited))}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-plum-700 ring-1 ring-sky-200 hover:bg-sky-100">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copy message
            </button>
            <a href={`mailto:${justInvited}?subject=${encodeURIComponent('Your Tinash Homecare Services team access')}&body=${encodeURIComponent(inviteText(justInvited))}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-plum-700 ring-1 ring-sky-200 hover:bg-sky-100">
              <Mail className="h-3.5 w-3.5" /> Email them
            </a>
          </div>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {team.map((m) => {
          const me = m.user_id === meId;
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Avatar name={m.display_name} email={m.email} url={m.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold text-plum-950">
                  {m.display_name || m.email}
                  {me && <span className="rounded bg-teal-500/20 px-2 py-0.5 text-[11px] font-bold text-plum-700">you</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {[m.job_title, m.display_name ? m.email : null].filter(Boolean).join(' · ') || 'no title set'}
                  {m.last_sign_in_at ? ` · signed in ${ago(m.last_sign_in_at)}` : ' · never signed in'}
                </p>
              </div>
              {me && (
                <Link href="/dashboard/profile" className="text-xs font-semibold text-teal-700 hover:underline">Edit my profile</Link>
              )}
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={m.role}
                    disabled={pending}
                    onChange={(e) => act(() => setTeamRole(m.user_id, e.target.value))}
                    aria-label={`Role for ${m.display_name || m.email}`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  {!me && (
                    <button type="button" disabled={pending}
                      onClick={() => {
                        if (confirm(`Remove ${m.display_name || m.email} from the team? Their login stays, but opens nothing here.`)) {
                          act(() => removeTeamMember(m.user_id));
                        }
                      }}
                      aria-label={`Remove ${m.display_name || m.email}`} title="Remove from team"
                      className="rounded-lg p-2 text-slate-400 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{roleLabel(m.role)}</span>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin && invites.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invited, not signed in yet</p>
          <ul className="mt-2 space-y-2">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <Avatar name={null} email={i.email} url={null} size={32} muted />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{i.email}</p>
                  <p className="text-xs text-slate-500">
                    {roleLabel(i.role)}{i.job_title ? ` · ${i.job_title}` : ''} · invited {ago(i.created_at)}
                  </p>
                </div>
                <button type="button" onClick={() => copy(inviteText(i.email))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
                  <Copy className="h-3.5 w-3.5" /> Copy sign-in message
                </button>
                <button type="button" disabled={pending} onClick={() => act(() => revokeTeamInvite(i.id))}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" /> Withdraw
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
