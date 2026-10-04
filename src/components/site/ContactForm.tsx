'use client';

import { useState } from 'react';
import { Phone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { site } from '@/lib/site';
import { CARE_SERVICES } from '@/lib/care-services';
import { submitLead } from '@/lib/leads';
import FormPrivacyNote from '@/components/site/FormPrivacyNote';

const field =
  'mt-1.5 w-full rounded-xl border border-plum-200 bg-white px-4 py-3 text-base text-plum-950 outline-none transition-colors focus:border-teal-500';
const label = 'block text-sm font-medium text-plum-900';

/** "Send a message" on the contact page. Writes to the CRM inbox. */
export default function ContactForm({ defaultService = 'Not sure yet' }: { defaultService?: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (String(fd.get('company') ?? '')) { setDone(true); return; } // honeypot

    const phone = String(fd.get('phone') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!phone && !email) {
      setError('Please give us either a phone number or an email address so we can reply.');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await submitLead({
      name: String(fd.get('name') ?? ''),
      phone, email,
      service: String(fd.get('service') ?? ''),
      message: String(fd.get('message') ?? ''),
      kind: 'care',
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.reason === 'rate_limited'
      ? 'We have received several messages from you just now. Please wait a few minutes, or call us.'
      : `We could not send that. Please call us on ${site.phone}.`);
  }

  if (done) {
    return (
      <div className="glass flex items-start gap-3 rounded-2xl p-6 text-plum-900">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-teal-600" aria-hidden />
        <p className="font-medium">
          Thank you — we have your message and will reach out within one business day. If it&apos;s
          urgent, please call <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className={label}>Your name *</label>
          <input id="cf-name" name="name" required autoComplete="name" maxLength={200} className={field} />
        </div>
        <div>
          <label htmlFor="cf-phone" className={label}>Phone</label>
          <input id="cf-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="cf-email" className={label}>Email</label>
        <input id="cf-email" name="email" type="email" autoComplete="email" maxLength={200} className={field} />
        <p className="mt-1.5 text-xs text-plum-700/70">A phone number or an email — whichever you prefer we use.</p>
      </div>
      <div>
        <label htmlFor="cf-service" className={label}>Service you&apos;re asking about</label>
        <select id="cf-service" name="service" defaultValue={defaultService} className={field}>
          {CARE_SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="cf-message" className={label}>How can we help? (No medical details needed — just the basics)</label>
        <textarea id="cf-message" name="message" rows={4} maxLength={1500} className={field} />
      </div>

      <FormPrivacyNote />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {busy ? 'Sending…' : 'Send message'}
        </button>
        <a href={site.phoneHref} className="inline-flex items-center gap-2 font-semibold text-plum-700">
          <Phone className="h-4 w-4 text-teal-600" /> or call {site.phone}
        </a>
      </div>
    </form>
  );
}
