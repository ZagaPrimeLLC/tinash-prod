'use client';

import { useState, useTransition } from 'react';
import { Copy, Check, Mail, MessageSquare, Send, RefreshCw, Ban, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardHead } from '@/components/crm/ui';
import { site } from '@/lib/site';
import { setAssignmentStatus, regenerateLink } from '@/app/(dashboard)/dashboard/onboarding/actions';

export default function SharePanel({
  assignmentId, token, status, firstName, email, phone, workflowName,
}: {
  assignmentId: string; token: string; status: string; firstName: string;
  email: string | null; phone: string | null; workflowName: string;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(token);

  // Built in the browser so the link always matches wherever this is deployed.
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/welcome/${current}`
    : `/welcome/${current}`;

  const live = status === 'sent' || status === 'in_progress' || status === 'complete';

  const body =
    `Hi ${firstName},\n\n` +
    `Welcome to Tinash Homecare Services. Here is your ${workflowName.toLowerCase()}:\n\n` +
    `${url}\n\n` +
    `Open it on your phone or a computer. There is no password and nothing to sign up for. ` +
    `You can read every step and download the documents you need.\n\n` +
    `Please do not share this link, it is yours.\n\n` +
    `If anything is unclear, call the office on ${site.phone}.\n\n` +
    `Tinash Homecare Services`;

  const subject = `Your onboarding pack, ${firstName}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setError('Could not copy. Select the link and copy it by hand.'));
  }

  function act(fn: () => Promise<{ ok: true; id?: string } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else if (r.id && r.id.length > 30) setCurrent(r.id);
    });
  }

  const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition';

  return (
    <Card>
      <CardHead title="Send the pack" sub="No login, no account, nothing to install" icon={Send} />
      <div className="space-y-4 p-5">
        {!live && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            This link is switched off. It returns nothing until you mark the pack as sent, so it is
            safe to copy it into a draft first.
          </p>
        )}

        <div>
          <p className="text-xs font-semibold text-slate-700">Their link</p>
          <div className="mt-1.5 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2.5 font-mono text-[11px] text-slate-700">
              {url}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"
              aria-label="Copy the link"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined}
            aria-disabled={!email}
            className={`${btn} ${email ? 'bg-plum-700 text-white hover:bg-plum-800' : 'pointer-events-none bg-slate-100 text-slate-400'}`}
          >
            <Mail className="h-3.5 w-3.5" /> Email it
          </a>
          <a
            href={phone ? `sms:${phone}?&body=${encodeURIComponent(`Hi ${firstName}, your Tinash onboarding pack: ${url} No password needed.`)}` : undefined}
            aria-disabled={!phone}
            className={`${btn} ${phone ? 'bg-teal-700 text-white hover:opacity-90' : 'pointer-events-none bg-slate-100 text-slate-400'}`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Text it
          </a>
        </div>
        {!email && !phone && (
          <p className="text-xs text-slate-500">No email or mobile on this record, so copy the link instead.</p>
        )}

        <div className="space-y-2 border-t border-slate-100 pt-4">
          {!live ? (
            <button
              onClick={() => act(() => setAssignmentStatus(assignmentId, 'sent'))}
              disabled={pending}
              className={`${btn} w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60`}
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Switch the link on
            </button>
          ) : (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btn} w-full border border-slate-300 text-slate-700 hover:bg-slate-50`}
              >
                <ExternalLink className="h-3.5 w-3.5" /> See what they see
              </a>
              <button
                onClick={() => act(() => setAssignmentStatus(assignmentId, 'revoked'))}
                disabled={pending}
                className={`${btn} w-full border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60`}
              >
                <Ban className="h-3.5 w-3.5" /> Switch the link off
              </button>
            </>
          )}

          <button
            onClick={() => act(() => regenerateLink(assignmentId))}
            disabled={pending}
            className={`${btn} w-full text-slate-500 hover:bg-slate-50 disabled:opacity-60`}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Issue a new link
          </button>
          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            A new link stops the old one working straight away. Use it if a link went to the wrong person.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
