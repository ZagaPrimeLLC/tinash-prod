'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { CHAT } from '@/lib/chat-script';
import { submitLead } from '@/lib/leads';
import { site } from '@/lib/site';

type Line = { from: 'bot' | 'user'; text: string };

/**
 * Site-wide guided assistant (a fixed script, not a language model). Leads it
 * captures go to the CRM inbox as `chat-assistant` inquiries.
 */
export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState('start');
  const [lines, setLines] = useState<Line[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const trail = useRef<string[]>([]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [lines, capturing, sent]);

  function push(id: string) {
    const n = CHAT[id];
    if (!n) return;
    setNode(id);
    if (n.capture === 'lead') { setCapturing(true); return; }
    setLines((l) => [...l, ...n.say.map((t) => ({ from: 'bot' as const, text: t }))]);
  }

  function toggle() {
    if (!open && lines.length === 0) push('start');
    setOpen(!open);
  }

  function choose(label: string, next: string) {
    trail.current.push(label);
    setLines((l) => [...l, { from: 'user', text: label }]);
    setTimeout(() => push(next), 250);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (String(fd.get('company') ?? '')) { setSent(true); setCapturing(false); return; } // honeypot
    const name = String(fd.get('name') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const note = String(fd.get('note') ?? '').trim();

    if (!phone && !email) {
      setError('Please leave a phone number or an email so we can reply.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await submitLead({
      name, phone, email, kind: 'chat',
      message:
        `Assistant conversation\nPath: ${trail.current.join(' > ') || 'direct'}\n` +
        (note ? `Their note: ${note}` : 'No extra note left.'),
    });
    setBusy(false);
    if (r.ok) { setSent(true); setCapturing(false); }
    else setError(r.reason === 'rate_limited'
      ? 'Several messages arrived from you just now. Please wait a few minutes, or call us.'
      : `Could not send that. Please call ${site.phone}.`);
  }

  const current = CHAT[node];
  const field = 'w-full rounded-xl border border-plum-200 bg-white px-3 py-2.5 text-sm text-plum-950 outline-none focus:border-teal-500';

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[60] grid h-16 w-16 place-items-center">
        {!open && (
          <span aria-hidden="true" className="tinash-chat-halo pointer-events-none absolute inset-0 rounded-full bg-teal-500" />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Close the assistant' : 'Chat with us'}
          className={`relative grid h-14 w-14 place-items-center rounded-full bg-teal-500 text-plum-950 transition hover:bg-teal-400 ${open ? 'shadow-xl' : 'tinash-chat-fab'}`}
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={`${site.name} assistant`}
          className="fixed bottom-24 right-5 z-[60] flex max-h-[min(36rem,calc(100dvh-8rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-plum-950/20 sm:w-[23rem]"
        >
          <div className="shrink-0 bg-brand px-5 py-4 text-white">
            <p className="font-display font-semibold">{site.name}</p>
            <p className="text-xs text-mist-100/80">A guided assistant · we reply within one business day</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {lines.map((l, i) => (
              <p
                key={i}
                className={
                  l.from === 'bot'
                    ? 'max-w-[88%] rounded-2xl rounded-tl-sm bg-mist-100 px-3.5 py-2.5 text-sm leading-relaxed text-plum-950'
                    : 'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-plum-600 px-3.5 py-2.5 text-sm text-white'
                }
              >
                {l.text}
              </p>
            ))}

            {sent && (
              <div className="rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-300">
                <CheckCircle2 className="mb-2 h-6 w-6 text-teal-700" />
                <p className="text-sm leading-relaxed text-plum-950">
                  Thank you. Your details are with our team and someone will call you. For anything
                  urgent, call <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a>.
                </p>
              </div>
            )}

            {capturing && (
              <form onSubmit={submit} className="space-y-2.5 rounded-2xl bg-mist-100 p-3.5">
                <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <label className="sr-only" htmlFor="chat-name">Your name</label>
                <input id="chat-name" name="name" required maxLength={200} placeholder="Your name" className={field} />
                <label className="sr-only" htmlFor="chat-phone">Phone</label>
                <input id="chat-phone" name="phone" type="tel" maxLength={40} placeholder="Phone" className={field} />
                <label className="sr-only" htmlFor="chat-email">Email</label>
                <input id="chat-email" name="email" type="email" maxLength={200} placeholder="Email" className={field} />
                <label className="sr-only" htmlFor="chat-note">Anything else</label>
                <textarea id="chat-note" name="note" rows={2} maxLength={600} placeholder="Anything else? (optional)" className={field} />
                <p className="text-[11px] leading-relaxed text-plum-800/70">
                  Please do not include medical details here. For anything clinical, call us.
                </p>
                {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
                <button type="submit" disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-plum-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-plum-700 disabled:opacity-60">
                  <Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Send to our team'}
                </button>
              </form>
            )}

            <div ref={endRef} />
          </div>

          {!capturing && !sent && (current?.link || current?.options) && (
            <div className="max-h-[45%] shrink-0 space-y-2 overflow-y-auto border-t border-plum-100 px-4 py-3">
              {current?.link && (
                <a href={current.link.href}
                  className="flex items-center justify-center gap-2 rounded-full bg-teal-500 px-3.5 py-2.5 text-sm font-semibold text-plum-950 hover:bg-teal-400">
                  {current.link.label} <ArrowRight className="h-4 w-4" />
                </a>
              )}
              {current?.options?.map((o) => (
                <button key={o.id} type="button" onClick={() => choose(o.label, o.next)}
                  className="w-full rounded-xl border border-plum-200 px-3.5 py-2.5 text-left text-sm font-medium text-plum-800 hover:border-plum-600 hover:bg-plum-600 hover:text-white">
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {!capturing && !sent && !current?.options && !current?.link && (
            <div className="shrink-0 border-t border-plum-100 px-4 py-3">
              <a href={site.phoneHref} className="block rounded-full bg-teal-500 px-3.5 py-2.5 text-center text-sm font-semibold text-plum-950">
                Call {site.phone}
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
