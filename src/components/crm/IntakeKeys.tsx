'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, KeyRound, Zap } from 'lucide-react';
import { createIntakeKey, revokeIntakeKey } from '@/app/(dashboard)/dashboard/settings/actions';
import { Card, CardHead, ago } from '@/components/crm/ui';

export type IntakeKey = {
  id: string; label: string; source: string; key_prefix: string;
  created_at: string; last_used_at: string | null; revoked_at: string | null;
};

const EXAMPLE = `{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "973-555-0100",
  "job_title": "Certified Home Health Aide (CHHA) - Part Time",
  "location": "Newark, NJ",
  "external_id": "careerplug-applicant-id",
  "applied_at": "2026-09-30T14:00:00Z"
}`;

export default function IntakeKeys({ keys, endpoint }: { keys: IntakeKey[]; endpoint: string }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setMsg(null);
    start(async () => {
      const res = await createIntakeKey(fd);
      if (res.ok) {
        setFresh(res.key);
        form.reset();
      } else setMsg({ ok: false, text: res.error });
    });
  }

  function revoke(id: string, label: string) {
    if (!confirm(`Revoke "${label}"? Anything using it stops being able to add applicants.`)) return;
    start(async () => {
      const res = await revokeIntakeKey(id);
      setMsg(res.ok ? { ok: true, text: res.note ?? 'Revoked.' } : { ok: false, text: res.error });
    });
  }

  const active = keys.filter((k) => !k.revoked_at);

  return (
    <Card>
      <CardHead
        title="Automatic applicant feed"
        sub="Lets n8n, Zapier or a job board add applicants to the board without anyone exporting a file"
        icon={Zap}
      />
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Send applicants to</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-plum-950 ring-1 ring-slate-200">
              POST {endpoint}
            </code>
            <button type="button" onClick={() => copy(endpoint, 'url')} aria-label="Copy the address"
              className="rounded-lg p-2 text-slate-500 ring-1 ring-slate-200 hover:text-plum-700">
              {copied === 'url' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            With the header <code className="rounded bg-slate-100 px-1">Authorization: Bearer &lt;key&gt;</code> and a JSON
            body for one applicant, or a list of up to 100. Duplicates are matched the same way as a CSV import.
          </p>
          <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-teal-700">Example body</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[12px] leading-relaxed text-slate-100">{EXAMPLE}</pre>
          </details>
        </div>

        {fresh && (
          <div role="status" className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-sm font-bold text-amber-900">Copy this key now. It will not be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 text-xs text-slate-900 ring-1 ring-amber-200">{fresh}</code>
              <button type="button" onClick={() => copy(fresh, 'key')} aria-label="Copy key"
                className="rounded-lg bg-white p-2 text-slate-600 ring-1 ring-amber-200 hover:text-plum-700">
                {copied === 'key' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button type="button" onClick={() => setFresh(null)} className="mt-3 text-xs font-semibold text-amber-900 underline">
              I have stored it somewhere safe
            </button>
          </div>
        )}

        {active.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {active.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-plum-950">
                    <KeyRound className="h-3.5 w-3.5 text-teal-700" /> {k.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {k.source} · <code>{k.key_prefix}…</code> · created {ago(k.created_at)} ·{' '}
                    {k.last_used_at ? `last used ${ago(k.last_used_at)}` : 'never used'}
                  </p>
                </div>
                <button type="button" disabled={pending} onClick={() => revoke(k.id, k.label)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={create} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-5">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="key-label" className="block text-xs font-semibold text-slate-700">New key name</label>
            <input id="key-label" name="label" required maxLength={80} placeholder="n8n CareerPlug emails"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="key-source" className="block text-xs font-semibold text-slate-700">Applicants come from</label>
            <select id="key-source" name="source" className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option>CareerPlug</option>
              <option>Indeed</option>
              <option>ZipRecruiter</option>
              <option>Other</option>
            </select>
          </div>
          <button type="submit" disabled={pending}
            className="rounded-lg bg-plum-700 px-4 py-2 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60">
            Create key
          </button>
        </form>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
