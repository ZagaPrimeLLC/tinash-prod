'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { getAttribution } from '@/lib/attribution';
import { submitLead, pingOffice } from '@/lib/leads';
import { site } from '@/lib/site';
import FormPrivacyNote from '@/components/site/FormPrivacyNote';

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const field =
  'mt-1.5 w-full rounded-xl border border-plum-200 bg-white px-4 py-3 text-base text-plum-950 outline-none transition-colors focus:border-teal-500';
const label = 'block text-sm font-medium text-plum-900';

/**
 * The general caregiver application ("no opening fits? apply anyway"). Lands
 * on the CRM Applicants board with no job attached, through
 * proj_tinash.apply_general(), which is rate limited and returns nothing about
 * the person. Resumes go to the private tinash-resumes bucket (insert-only).
 */
export default function CareersForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeFailed, setResumeFailed] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (String(fd.get('website') ?? '')) { setDone(true); return; } // honeypot

    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    if (!email && !phone) {
      setError('Please give us an email address or a phone number so we can reach you.');
      return;
    }
    const answers = {
      role: String(fd.get('role') ?? '') || null,
      area: String(fd.get('area') ?? '').trim() || null,
      availability: String(fd.get('availability') ?? '') || null,
      certified: Boolean(fd.get('certified')),
      cpr_first_aid: Boolean(fd.get('cpr')),
      driver_with_vehicle: Boolean(fd.get('driver')),
      applied_via: 'website general application',
    };
    const experience = String(fd.get('experience') ?? '').trim();

    setBusy(true);
    setError(null);

    if (!supabaseConfigured) {
      // Not connected yet: still reach the office (email / function logs).
      const r = await submitLead({
        name, email, phone, kind: 'careers',
        message:
          `General caregiver application\nRole: ${answers.role ?? 'not given'}\nArea: ${answers.area ?? 'not given'}\n` +
          `Availability: ${answers.availability ?? 'not given'}\nCHHA/CNA certified: ${answers.certified ? 'yes' : 'not stated'}\n` +
          `CPR/First Aid: ${answers.cpr_first_aid ? 'yes' : 'not stated'}\nDrives with own vehicle: ${answers.driver_with_vehicle ? 'yes' : 'not stated'}\n` +
          `Experience: ${experience}`,
      });
      setBusy(false);
      if (r.ok) setDone(true);
      else setError(`We could not send that. Please call us on ${site.phone}.`);
      return;
    }

    const supabase = createClient();
    let resumePath: string | null = null;
    const resume = fd.get('resume') as File | null;
    if (resume && resume.size > 0) {
      if (resume.size > MAX_RESUME_BYTES) {
        setBusy(false);
        setError('That file is larger than 10MB. Please attach a smaller file.');
        return;
      }
      const safe = resume.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      // A random segment means a stored resume cannot be guessed at from outside,
      // on top of the bucket being private.
      const path = `applications/${Date.now()}-${crypto.randomUUID().slice(0, 12)}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('tinash-resumes')
        .upload(path, resume, { upsert: false, contentType: resume.type || undefined });
      // An upload failure must not lose the application, but the applicant is told plainly.
      setResumeFailed(Boolean(upErr));
      if (!upErr) resumePath = path;
    }

    const { error: rpcErr } = await supabase.rpc('apply_general', {
      p: { name, email, phone, resume_url: resumePath, notes: experience, answers: { ...answers, attribution: getAttribution() } },
    });

    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.code === 'PT429'
        ? 'We have received several applications from you just now. Please wait a few minutes, or call us.'
        : `We could not send that. Please call us on ${site.phone}.`);
    } else {
      pingOffice({
        kind: 'application', name, email, phone,
        town: answers.area ?? null, availability: answers.availability ?? null,
        cpr: answers.cpr_first_aid ? 'yes' : null, drives: answers.driver_with_vehicle ? 'yes' : null,
        resume: resumePath ? 'yes' : 'no', experience,
        job: answers.role ? `General application (${answers.role})` : null,
      });
      setDone(true);
      form.reset();
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-teal-300 bg-teal-50 p-6">
        <CheckCircle2 className="mb-3 h-7 w-7 text-teal-700" />
        <h3 className="font-display text-lg font-bold text-plum-950">Application received.</h3>
        <p className="mt-2 text-sm leading-relaxed text-plum-900">
          Thank you. Our hiring team will call you to talk roles, schedules, and next steps. Questions in
          the meantime? Call or text <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a>.
        </p>
        {resumeFailed && (
          <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm leading-relaxed text-plum-900 ring-1 ring-amber-300">
            <strong>Your resume did not attach.</strong> Everything else came through. Please email the file to{' '}
            <a href={`mailto:${site.email}`} className="font-semibold text-plum-700 underline">{site.email}</a>.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={label}>Full name *</label>
          <input id="c-name" name="name" required autoComplete="name" maxLength={200} className={field} />
        </div>
        <div>
          <label htmlFor="c-phone" className={label}>Phone</label>
          <input id="c-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={field} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-email" className={label}>Email</label>
          <input id="c-email" name="email" type="email" autoComplete="email" maxLength={200} className={field} />
        </div>
        <div>
          <label htmlFor="c-area" className={label}>Town or county you can work in</label>
          <input id="c-area" name="area" maxLength={120} placeholder="e.g. Newark, Essex County" className={field} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-role" className={label}>Role you&apos;re interested in</label>
          <select id="c-role" name="role" className={field}>
            <option value="">Select…</option>
            <option>CHHA (Certified Home Health Aide)</option>
            <option>DSP (Direct Support Professional)</option>
            <option>Companion</option>
            <option>Nurse</option>
            <option>New to caregiving, ready to train</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-availability" className={label}>Availability</label>
          <select id="c-availability" name="availability" className={field}>
            <option value="">Select…</option>
            <option>Weekday days</option>
            <option>Weekday evenings</option>
            <option>Weekends</option>
            <option>Overnights</option>
            <option>Live-in</option>
            <option>Flexible</option>
          </select>
        </div>
      </div>
      <fieldset className="space-y-2.5">
        <legend className={label}>Tick anything that applies</legend>
        {[
          ['certified', 'I hold a current CHHA or CNA certification'],
          ['cpr', 'I am CPR and First Aid certified'],
          ['driver', 'I drive and have my own vehicle'],
        ].map(([n, text]) => (
          <label key={n} className="flex items-center gap-3">
            <input type="checkbox" name={n} className="h-5 w-5 rounded border-plum-200 accent-plum-600" />
            <span className="text-sm text-plum-900">{text}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="c-exp" className={label}>Tell us about your caregiving experience</label>
        <textarea id="c-exp" name="experience" rows={3} maxLength={1500} className={field} />
      </div>
      {supabaseConfigured && (
        <div>
          <span className={label}>Resume (optional)</span>
          <label htmlFor="c-resume" className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-plum-200 px-4 py-3.5 hover:border-teal-500">
            <Upload className="h-5 w-5 shrink-0 text-teal-700" />
            <span className="truncate text-sm text-plum-800">{fileName ?? 'Attach a PDF or Word file (max 10MB)'}</span>
          </label>
          <input id="c-resume" name="resume" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} className="sr-only" />
        </div>
      )}

      <FormPrivacyNote />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      <button type="submit" disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60">
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {busy ? 'Sending…' : 'Submit application'}
      </button>
    </form>
  );
}
