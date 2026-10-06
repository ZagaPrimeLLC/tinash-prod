'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getAttribution } from '@/lib/attribution';
import { site } from '@/lib/site';
import FormPrivacyNote from '@/components/site/FormPrivacyNote';

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const field =
  'mt-1.5 w-full rounded-xl border border-plum-200 bg-white px-4 py-3 text-base text-plum-950 outline-none transition-colors focus:border-teal-500';

/**
 * Applying for one specific job. Unlike the general interest form, this puts
 * the person straight onto the Applicants board under this job, through
 * proj_tinash.apply_to_job(), which refuses if the job has since closed.
 */
export default function JobApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeFailed, setResumeFailed] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Filled in only by bots, which see every field. People never see it.
    if (String(fd.get('website') ?? '')) {
      setDone(true);
      return;
    }

    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const phone = String(fd.get('phone') ?? '').trim();
    if (!email && !phone) {
      setError('Please give us an email address or a phone number so we can reach you.');
      return;
    }

    setBusy(true);
    setError(null);
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
      const path = `applications/${Date.now()}-${crypto.randomUUID().slice(0, 12)}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('tinash-resumes')
        .upload(path, resume, { upsert: false, contentType: resume.type || undefined });
      setResumeFailed(Boolean(upErr));
      if (!upErr) resumePath = path;
    }

    const { error: rpcErr } = await supabase.rpc('apply_to_job', {
      p_job: jobId,
      p: {
        name,
        email,
        phone,
        resume_url: resumePath,
        notes: String(fd.get('experience') ?? '').trim(),
        answers: {
          area: String(fd.get('area') ?? '').trim() || null,
          availability: String(fd.get('availability') ?? '') || null,
          cpr_first_aid: Boolean(fd.get('cpr')),
          driver_with_vehicle: Boolean(fd.get('driver')),
          applied_via: 'website job page',
          attribution: getAttribution(),
        },
      },
    });

    setBusy(false);
    if (rpcErr) {
      setError(
        /no longer taking/i.test(rpcErr.message)
          ? 'This position has just closed. Please look at our other openings, or call us.'
          : `We could not send that. Please call us on ${site.phone}.`
      );
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-teal-300 bg-teal-50 p-6">
        <CheckCircle2 className="mb-3 h-7 w-7 text-teal-700" />
        <h3 className="font-display text-lg font-bold text-plum-950">Application received.</h3>
        <p className="mt-2 text-sm leading-relaxed text-plum-900">
          Thank you for applying for <strong>{jobTitle}</strong>. Our hiring team will call you to go through the role
          and check availability. Questions in the meantime? Call or text{' '}
          <a href={site.phoneHref} className="font-semibold underline">{site.phone}</a>.
        </p>
        {resumeFailed && (
          <p role="alert" className="mt-4 rounded-lg bg-white p-3 text-sm leading-relaxed text-plum-900 ring-1 ring-amber-300">
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

      <div>
        <label htmlFor="a-name" className="block text-sm font-medium text-plum-900">Full name *</label>
        <input id="a-name" name="name" required autoComplete="name" maxLength={200} className={field} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <label htmlFor="a-phone" className="block text-sm font-medium text-plum-900">Phone</label>
          <input id="a-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} className={field} />
        </div>
        <div>
          <label htmlFor="a-email" className="block text-sm font-medium text-plum-900">Email</label>
          <input id="a-email" name="email" type="email" autoComplete="email" maxLength={200} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="a-area" className="block text-sm font-medium text-plum-900">Town you live in</label>
        <input id="a-area" name="area" maxLength={120} placeholder="e.g. Newark" className={field} />
      </div>
      <div>
        <label htmlFor="a-availability" className="block text-sm font-medium text-plum-900">Availability</label>
        <select id="a-availability" name="availability" className={`${field} bg-white`}>
          <option value="">Select…</option>
          <option>Weekday days</option>
          <option>Weekday evenings</option>
          <option>Weekends</option>
          <option>Overnights</option>
          <option>Flexible</option>
        </select>
      </div>
      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-plum-900">Tick anything that applies</legend>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="cpr" className="h-5 w-5 rounded border-plum-200" />
          <span className="text-sm text-plum-900">I am CPR and First Aid certified</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="driver" className="h-5 w-5 rounded border-plum-200" />
          <span className="text-sm text-plum-900">I drive and have my own vehicle</span>
        </label>
      </fieldset>
      <div>
        <label htmlFor="a-exp" className="block text-sm font-medium text-plum-900">Relevant experience</label>
        <textarea id="a-exp" name="experience" rows={3} maxLength={1500}
          placeholder="Caregiving, home health aide, DSP, or related work." className={field} />
      </div>
      <div>
        <span className="block text-sm font-medium text-plum-900">Resume (optional)</span>
        <label htmlFor="a-resume" className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-plum-200 px-4 py-3.5 hover:border-teal-500">
          <Upload className="h-5 w-5 shrink-0 text-teal-700" />
          <span className="truncate text-sm text-plum-800">{fileName ?? 'Attach a PDF or Word file (max 10MB)'}</span>
        </label>
        <input id="a-resume" name="resume" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} className="sr-only" />
      </div>

      <FormPrivacyNote />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}

      <button type="submit" disabled={busy}
        className="w-full rounded-full bg-teal-500 px-8 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-60">
        {busy ? 'Sending…' : 'Submit application'}
      </button>
    </form>
  );
}
