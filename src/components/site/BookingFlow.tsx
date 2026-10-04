'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { CalendarCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { getAttribution } from '@/lib/attribution';
import { submitLead } from '@/lib/leads';
import { availableDays, SLOT_MINUTES, timeLabel } from '@/lib/booking';
import { site } from '@/lib/site';
import FormPrivacyNote from '@/components/site/FormPrivacyNote';

const field =
  'mt-1.5 w-full rounded-xl border border-plum-200 bg-white px-4 py-3 text-base text-plum-950 outline-none transition-colors focus:border-teal-500 disabled:bg-mist-100 disabled:text-plum-300';
const label = 'block text-sm font-medium text-plum-900';

// True only in the browser. The page itself is built ahead of time, so the
// times are worked out when someone opens it, never frozen at build time.
const noop = () => () => {};
const useInBrowser = () => useSyncExternalStore(noop, () => true, () => false);

/** Request a free consultation call. A request, not a confirmed booking. */
export default function BookingFlow() {
  const inBrowser = useInBrowser();
  const days = useMemo(() => (inBrowser ? availableDays() : []), [inBrowser]);
  const [dayKey, setDayKey] = useState('');
  const [slotIso, setSlotIso] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const day = days.find((d) => d.key === dayKey) ?? null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!day || !slotIso) {
      setError('Choose a day and a time.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    if (String(fd.get('company') ?? '')) { setDone('your chosen time'); return; } // honeypot
    setBusy(true);
    setError(null);

    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    const notes = String(fd.get('notes') ?? '').trim();
    const when = `${day.label} at ${timeLabel(slotIso)}`;

    let failed = false;
    let limited = false;
    if (supabaseConfigured) {
      const { error } = await createClient().from('bookings').insert({
        name, email, phone,
        requested_slot: slotIso,
        notes: notes || null,
        attribution: getAttribution(),
      });
      failed = Boolean(error);
      limited = error?.code === 'PT429';
    }
    if (!supabaseConfigured || (failed && !limited)) {
      // No booking table reachable: send it as an inquiry so it is not lost.
      const r = await submitLead({
        name, email, phone, kind: 'care',
        message: `Free consultation requested for ${when} (${slotIso}).${notes ? `\n${notes}` : ''}`,
      });
      failed = !r.ok;
      limited = !r.ok && r.reason === 'rate_limited';
    }

    setBusy(false);
    if (limited) setError('We have received several requests from you just now. Please wait a few minutes, or call us.');
    else if (failed) setError(`We could not hold that time. Please call ${site.phone}.`);
    else setDone(when);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-teal-300 bg-teal-50 p-7">
        <CheckCircle2 className="mb-3 h-8 w-8 text-teal-700" />
        <h3 className="font-display text-xl font-bold text-plum-950">Consultation requested</h3>
        <p className="mt-3 text-plum-900"><strong>{done}</strong></p>
        <p className="mt-3 text-sm leading-relaxed text-plum-900">
          This is a request, not a confirmed booking. Our team will call you to confirm the time
          before it is final. If you need to change it, call{' '}
          <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <p className="flex items-center gap-2 font-semibold text-plum-950">
          <CalendarCheck className="h-5 w-5 text-teal-600" />
          Pick a time for a free consultation call
        </p>
        <p className="mt-2 text-sm text-plum-800/80">
          {site.consultation.label} (New Jersey time). Each call takes about {SLOT_MINUTES} minutes.
        </p>
      </div>

      {inBrowser && days.length === 0 ? (
        <p className="rounded-xl bg-mist-100 p-4 text-sm text-plum-900">
          No times are open in the next few weeks. Please call{' '}
          <a href={site.phoneHref} className="font-semibold text-plum-700 underline">{site.phone}</a>.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="b-day" className={label}>Day</label>
            <select id="b-day" required value={dayKey} disabled={!inBrowser}
              onChange={(e) => { setDayKey(e.target.value); setSlotIso(''); }} className={field}>
              <option value="">{inBrowser ? 'Choose a day' : 'Loading…'}</option>
              {days.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="b-time" className={label}>Time</label>
            <select id="b-time" required value={slotIso} disabled={!day}
              onChange={(e) => setSlotIso(e.target.value)} className={field}>
              <option value="">{day ? 'Choose a time' : 'Choose a day first'}</option>
              {day?.slots.map((s) => <option key={s.iso} value={s.iso}>{s.time}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="b-name" className={label}>Your name *</label>
          <input id="b-name" name="name" required autoComplete="name" maxLength={200} className={field} />
        </div>
        <div>
          <label htmlFor="b-phone" className={label}>Phone *</label>
          <input id="b-phone" name="phone" type="tel" required autoComplete="tel" maxLength={40} className={field} />
        </div>
      </div>

      <div>
        <label htmlFor="b-email" className={label}>Email *</label>
        <input id="b-email" name="email" type="email" required autoComplete="email" maxLength={200} className={field} />
      </div>

      <div>
        <label htmlFor="b-notes" className={label}>
          Anything we should know before the call? <span className="font-normal text-plum-700/70">(optional)</span>
        </label>
        <textarea id="b-notes" name="notes" rows={3} maxLength={800} className={field} />
      </div>

      <FormPrivacyNote />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      <button type="submit" disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60">
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {busy ? 'Requesting…' : 'Request this time'}
      </button>
    </form>
  );
}
