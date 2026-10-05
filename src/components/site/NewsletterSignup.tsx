'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { pingOffice } from '@/lib/leads';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { getAttribution } from '@/lib/attribution';

/** Footer email signup. Insert-only for the public; nobody can read the list back. */
export default function NewsletterSignup() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nowhere to store it yet: show nothing rather than a form that cannot work.
  if (!supabaseConfigured) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (String(fd.get('company') ?? '')) { setDone(true); return; } // honeypot
    const email = String(fd.get('email') ?? '').trim();
    if (!email) { setError('Please add your email address.'); return; }
    setBusy(true);
    setError(null);

    const { error: err } = await createClient()
      .from('newsletter_subscribers')
      .insert({ email: email.slice(0, 200), attribution: getAttribution() });

    setBusy(false);
    if (err) {
      // Already on the list is not a failure worth alarming anyone about.
      if (err.code === '23505' || err.message.toLowerCase().includes('duplicate')) setDone(true);
      else if (err.code === 'PT429') setError('Too many tries just now. Please wait a few minutes.');
      else setError('That did not go through. Please try again later.');
    } else {
      pingOffice({ kind: 'newsletter', email });
      setDone(true);
    }
  }

  if (done) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-white/10 p-3.5 text-sm text-mist-100">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
        You&apos;re on the list. We&apos;ll only send occasional updates about our services and openings.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label htmlFor="nl-email" className="block text-sm font-medium text-mist-100/90">
        Occasional updates on services and job openings
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="nl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={200}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-mist-100/50 outline-none focus:border-teal-300"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-teal-500 px-4 py-2.5 text-sm font-semibold text-plum-950 hover:bg-teal-400 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Join
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{error}
        </p>
      )}
      <p className="mt-2 text-xs text-mist-100/60">
        No health information, ever. Unsubscribe any time.{' '}
        <Link href="/legal/privacy-policy" className="underline hover:text-white">Privacy Policy</Link>.
      </p>
    </form>
  );
}
