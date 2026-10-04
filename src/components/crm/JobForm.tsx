'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle, ArrowLeft, Bold, CheckCircle2, ExternalLink, Eye, Heading2, List, Pencil, Plus, X,
} from 'lucide-react';
import { saveJob } from '@/app/(dashboard)/dashboard/jobs/actions';
import { JobDescription } from '@/lib/job-format';
import {
  BENEFIT_PRESETS, EMPLOYMENT_LABEL, EXPERIENCE_OPTIONS, MAX_CUSTOM_BENEFITS, STATUS_LABEL, STATUS_TONE,
  WORK_MODE_LABEL, isPublic, suggestionsFor, type Job,
} from '@/lib/jobs';

type Draft = Pick<
  Job,
  'title' | 'location' | 'summary' | 'description' | 'requisition_id' | 'employment_type' | 'experience' |
  'work_mode' | 'benefits' | 'pay_min' | 'pay_max' | 'pay_interval' | 'apply_url' | 'careerplug_job_id'
>;

const input =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-plum-700 focus:outline-none focus:ring-1 focus:ring-plum-700';
const label = 'block text-sm font-semibold text-slate-800';

export default function JobForm({
  job, initial, canWrite,
}: {
  job: Job | null;          // editing an existing job
  initial: Draft | null;    // starting a new one, optionally copied from another
  canWrite: boolean;
}) {
  const router = useRouter();
  const start = job ?? initial;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Controlled only where something else on the page reacts to it.
  const [title, setTitle] = useState(start?.title ?? '');
  const [summary, setSummary] = useState(start?.summary ?? '');
  const [description, setDescription] = useState(start?.description ?? '');
  const [location, setLocation] = useState(start?.location ?? '');
  const [payMin, setPayMin] = useState(start?.pay_min?.toString() ?? '');
  const [payMax, setPayMax] = useState(start?.pay_max?.toString() ?? '');
  const [benefits, setBenefits] = useState<string[]>(start?.benefits ?? []);
  const [customInput, setCustomInput] = useState('');
  const [preview, setPreview] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const custom = benefits.filter((b) => !BENEFIT_PRESETS.includes(b));
  const suggestions = suggestionsFor({ title, description, summary, benefits, pay_min: payMin, pay_max: payMax, location });
  const done = suggestions.filter((s) => s.ok).length;
  const live = job ? isPublic(job) : false;

  function toggleBenefit(b: string) {
    setBenefits((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  }

  function addCustom() {
    const v = customInput.trim().slice(0, 60);
    if (!v || benefits.includes(v) || custom.length >= MAX_CUSTOM_BENEFITS) return;
    setBenefits((cur) => [...cur, v]);
    setCustomInput('');
  }

  /** Wraps the selection, or prefixes each selected line, keeping the cursor sensible. */
  function format(kind: 'bold' | 'bullet' | 'heading') {
    const el = descRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let next: string;
    let cursor: number;
    if (kind === 'bold') {
      const sel = value.slice(s, e) || 'bold text';
      next = `${value.slice(0, s)}**${sel}**${value.slice(e)}`;
      cursor = s + sel.length + 4;
    } else {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const prefix = kind === 'bullet' ? '- ' : '## ';
      const block = value.slice(lineStart, e).split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
      next = value.slice(0, lineStart) + block + value.slice(e);
      cursor = lineStart + block.length;
    }
    setDescription(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget);
    fd.set('intent', submitter?.value ?? 'save');
    setError(null);
    setNote(null);
    startTransition(async () => {
      const res = await saveJob(job?.id ?? null, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote(res.note);
      if (!job) router.push(`/dashboard/jobs/${res.id}?saved=1`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="pb-16">
      {/* sticky action bar, like CareerPlug's "Next Section" strip */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard/jobs" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-plum-700" aria-label="Back to jobs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-plum-950">{job ? job.title : 'Create new job'}</h1>
              {job && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONE[job.status]}`}>
                  {STATUS_LABEL[job.status]}{live ? ' · live on the website' : ''}
                </span>
              )}
            </div>
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              {live && (
                <a href={`/careers/${job!.slug}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-slate-200 hover:bg-slate-50">
                  View live <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button type="submit" name="intent" value="save" disabled={pending}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60">
                {job ? 'Save changes' : 'Save draft'}
              </button>
              {!live && (
                <button type="submit" name="intent" value="publish" disabled={pending}
                  className="rounded-lg bg-plum-700 px-4 py-2 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60">
                  {pending ? 'Saving…' : 'Publish to website'}
                </button>
              )}
            </div>
          )}
        </div>
        {(error || note) && (
          <p role={error ? 'alert' : 'status'}
            className={`px-5 pb-3 text-sm font-medium sm:px-8 ${error ? 'text-red-700' : 'text-emerald-700'}`}>
            {error ?? note}
          </p>
        )}
      </div>

      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={!canWrite || pending} className="min-w-0 space-y-6">
          <Section title="Location">
            <div>
              <label htmlFor="j-location" className={label}>Where is the work? *</label>
              <input id="j-location" name="location" value={location} onChange={(e) => setLocation(e.target.value)}
                maxLength={120} placeholder="e.g. Jersey City, NJ 07305 or Hudson County" className={input} />
            </div>
            <div>
              <span className={label}>Will this job be remote?</span>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                {(Object.keys(WORK_MODE_LABEL) as (keyof typeof WORK_MODE_LABEL)[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="radio" name="work_mode" value={m} defaultChecked={(start?.work_mode ?? 'onsite') === m}
                      className="h-4 w-4 border-slate-300 text-plum-700" />
                    {WORK_MODE_LABEL[m]}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Job posting">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div>
                <label htmlFor="j-title" className={label}>Job title *</label>
                <input id="j-title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)}
                  maxLength={70} placeholder="Certified Home Health Aide (CHHA) - Part Time" className={input} />
                <p className="mt-1 text-xs text-slate-500">{title.length}/70 characters</p>
              </div>
              <div>
                <label htmlFor="j-req" className={label}>Requisition ID</label>
                <input id="j-req" name="requisition_id" defaultValue={start?.requisition_id ?? ''} maxLength={60} className={input} />
              </div>
            </div>

            <div>
              <label htmlFor="j-summary" className={label}>Summary</label>
              <textarea id="j-summary" name="summary" rows={2} maxLength={300} value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One or two sentences shown in the job list on the Careers page."
                className={input} />
              <p className="mt-1 text-xs text-slate-500">{summary.length}/300</p>
            </div>

            <div>
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="j-desc" className={label}>Description *</label>
                <button type="button" onClick={() => setPreview((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline">
                  {preview ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><Eye className="h-3.5 w-3.5" /> Preview</>}
                </button>
              </div>
              <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-300 focus-within:border-plum-700 focus-within:ring-1 focus-within:ring-plum-700">
                {!preview && (
                  <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                    <ToolButton label="Bold" onClick={() => format('bold')}><Bold className="h-4 w-4" /></ToolButton>
                    <ToolButton label="Heading" onClick={() => format('heading')}><Heading2 className="h-4 w-4" /></ToolButton>
                    <ToolButton label="Bullet list" onClick={() => format('bullet')}><List className="h-4 w-4" /></ToolButton>
                    <span className="ml-auto text-[11px] text-slate-500">
                      Pasting from CareerPlug or Word keeps bullets and headings
                    </span>
                  </div>
                )}
                {preview ? (
                  <div className="max-h-[32rem] min-h-[16rem] overflow-y-auto bg-white p-4">
                    {description.trim() ? <JobDescription text={description} compact /> : <p className="text-sm text-slate-400">Nothing to preview yet.</p>}
                  </div>
                ) : null}
                <textarea id="j-desc" ref={descRef} name="description" value={description}
                  onChange={(e) => setDescription(e.target.value)} rows={16} maxLength={20000}
                  className={`block w-full resize-y border-0 px-3 py-3 font-mono text-[13px] leading-relaxed text-slate-900 focus:outline-none ${preview ? 'hidden' : ''}`}
                  placeholder={'## About the role\nWrite a few paragraphs about the work.\n\n## Duties\n- Assist with daily living skills\n- Support community activities'} />
              </div>
              <p className={`mt-1 text-xs ${description.length > 4000 ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                {description.length.toLocaleString()} characters{description.length > 4000 ? ', over the 4,000 suggested' : ''}
              </p>
            </div>
          </Section>

          <Section title="Benefits" lead="Select what this job offers. They are listed on the job page.">
            <div className="flex flex-wrap gap-2">
              {BENEFIT_PRESETS.map((b) => {
                const on = benefits.includes(b);
                return (
                  <button key={b} type="button" aria-pressed={on} onClick={() => toggleBenefit(b)}
                    className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                      on ? 'bg-plum-700 text-white ring-1 ring-plum-700' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
                    }`}>
                    {on && <CheckCircle2 className="-ml-0.5 mr-1 inline h-3.5 w-3.5" />}{b}
                  </button>
                );
              })}
              {custom.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 rounded-full bg-plum-700 py-1.5 pl-3.5 pr-2 text-sm text-white">
                  {b}
                  <button type="button" onClick={() => toggleBenefit(b)} aria-label={`Remove ${b}`} className="rounded-full p-0.5 hover:bg-white/20">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {benefits.filter((b) => BENEFIT_PRESETS.includes(b)).map((b) => <input key={b} type="hidden" name="benefit" value={b} />)}
            {custom.map((b) => <input key={b} type="hidden" name="custom_benefit" value={b} />)}
            <div className="flex max-w-md gap-2">
              <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                maxLength={60} placeholder={`Add a custom benefit (${MAX_CUSTOM_BENEFITS} max)`} aria-label="Custom benefit"
                className={`${input} mt-0`} />
              <button type="button" onClick={addCustom} disabled={custom.length >= MAX_CUSTOM_BENEFITS}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </Section>

          <Section title="Job details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="j-type" className={label}>Employment type</label>
                <select id="j-type" name="employment_type" defaultValue={start?.employment_type ?? 'part_time'} className={input}>
                  {Object.entries(EMPLOYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="j-exp" className={label}>Desired experience</label>
                <select id="j-exp" name="experience" defaultValue={start?.experience ?? ''} className={input}>
                  <option value="">Not specified</option>
                  {EXPERIENCE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Pay" lead="Shown on the website. Leave both empty to hide pay.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="j-min" className={label}>Min ($)</label>
                <input id="j-min" name="pay_min" inputMode="decimal" value={payMin} onChange={(e) => setPayMin(e.target.value)} placeholder="18.00" className={input} />
              </div>
              <div>
                <label htmlFor="j-max" className={label}>Max ($)</label>
                <input id="j-max" name="pay_max" inputMode="decimal" value={payMax} onChange={(e) => setPayMax(e.target.value)} placeholder="22.00" className={input} />
              </div>
              <div>
                <label htmlFor="j-int" className={label}>Per</label>
                <select id="j-int" name="pay_interval" defaultValue={start?.pay_interval ?? 'hour'} className={input}>
                  <option value="hour">Hour</option>
                  <option value="week">Week</option>
                  <option value="year">Year</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Job board links" lead="Optional. Used to match applicants imported from CareerPlug to this job.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="j-cpid" className={label}>CareerPlug job ID</label>
                <input id="j-cpid" name="careerplug_job_id" defaultValue={start?.careerplug_job_id ?? ''} maxLength={60} className={input} />
              </div>
              <div>
                <label htmlFor="j-apply" className={label}>External apply link</label>
                <input id="j-apply" name="apply_url" type="url" defaultValue={start?.apply_url ?? ''} maxLength={500}
                  placeholder="https://…careerplug.com/…" className={input} />
                <p className="mt-1 text-xs text-slate-500">If set, the job page also offers &ldquo;Apply on CareerPlug&rdquo;.</p>
              </div>
            </div>
          </Section>
        </fieldset>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-plum-950">Suggestions</h2>
            <p className="mt-1 text-xs text-slate-500">Apply these to get more and better applicants.</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / suggestions.length) * 100}%` }} />
            </div>
            <ul className="mt-4 space-y-2.5">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {s.ok
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                  <span className={s.ok ? 'text-slate-500' : 'text-slate-800'}>
                    {s.text}
                    {!s.ok && s.why && <span className="mt-0.5 block text-xs text-slate-500">{s.why}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
            Publishing puts the job on <strong>/careers</strong> with its own page and apply form. People who apply there
            appear on the Applicants board under this job. Pause or close it from the Jobs list to take it down.
          </p>
        </aside>
      </div>
    </form>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="border-b-2 border-plum-700 pb-1 text-base font-bold text-plum-950 sm:inline-block">{title}</h2>
      {lead && <p className="mt-2 text-sm text-slate-600">{lead}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ToolButton({ label: l, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={l} aria-label={l}
      className="rounded p-1.5 text-plum-700 hover:bg-white hover:shadow-sm">
      {children}
    </button>
  );
}
