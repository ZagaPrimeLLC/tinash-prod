'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RotateCcw, Upload, Zap } from 'lucide-react';
import { importApplicants, type ImportSummary } from '@/app/(dashboard)/dashboard/recruitment/import/actions';

type Target =
  | 'name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'job_title' | 'job_external_id'
  | 'location' | 'applied_at' | 'external_id' | 'resume_url' | 'notes' | '';

const TARGETS: { key: Exclude<Target, ''>; label: string; guess: RegExp }[] = [
  { key: 'name',            label: 'Full name',        guess: /^(full[ _]?)?name$|applicant[ _]?name|candidate[ _]?name/i },
  { key: 'first_name',      label: 'First name',       guess: /first/i },
  { key: 'last_name',       label: 'Last name',        guess: /last|surname/i },
  { key: 'email',           label: 'Email',            guess: /e-?mail/i },
  { key: 'phone',           label: 'Phone',            guess: /phone|mobile|cell|tel/i },
  { key: 'job_title',       label: 'Job title',        guess: /job[ _]?(title|name)?$|position|opening|^title$|role/i },
  { key: 'job_external_id', label: 'Job ID (CareerPlug)', guess: /job[ _]?id|requisition/i },
  { key: 'location',        label: 'Location',         guess: /location|city|town|county/i },
  { key: 'applied_at',      label: 'Applied date',     guess: /applied|apply[ _]?date|date|created|submitted/i },
  { key: 'external_id',     label: 'Applicant ID',     guess: /^(applicant|candidate|application)?[ _]?id$/i },
  { key: 'resume_url',      label: 'Resume link',      guess: /resume|cv/i },
  { key: 'notes',           label: 'Notes',            guess: /note|comment|message|cover/i },
];

const SOURCES = ['CareerPlug', 'Indeed', 'ZipRecruiter', 'Referral', 'Walk-in', 'Other'];

/** RFC 4180-ish: quoted fields, doubled quotes, commas and newlines inside quotes, BOM, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function guessMapping(headers: string[]): Target[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const t = TARGETS.find((t) => !used.has(t.key) && t.guess.test(h.trim()));
    if (!t) return '';
    used.add(t.key);
    return t.key;
  });
}

function isoDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export default function ImportClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Target[]>([]);
  const [source, setSource] = useState('CareerPlug');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();

  const mapped = useMemo(() => new Set(mapping.filter(Boolean)), [mapping]);
  const hasName = mapped.has('name') || mapped.has('first_name') || mapped.has('last_name');
  const hasContact = mapped.has('email') || mapped.has('phone');

  function reset() {
    setFileName(null); setHeaders([]); setData([]); setMapping([]); setError(null); setSummary(null);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('That file is over 5MB. Export fewer applicants at a time.'); return; }
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setError('That file has no applicant rows. Is it a CSV export with a header row?'); return; }
    setFileName(file.name);
    setHeaders(rows[0]);
    setData(rows.slice(1));
    setMapping(guessMapping(rows[0]));
    if (/indeed/i.test(file.name)) setSource('Indeed');
    else if (/zip/i.test(file.name)) setSource('ZipRecruiter');
  }

  function runImport() {
    const rows = data.map((r) => {
      const o: Record<string, string> = {};
      mapping.forEach((t, i) => {
        if (!t) return;
        const v = (r[i] ?? '').trim();
        if (v) o[t] = t === 'applied_at' ? isoDate(v) : v;
      });
      return o;
    });
    setError(null);
    start(async () => {
      const res = await importApplicants(rows, source);
      if (res.ok) setSummary(res.summary);
      else setError(res.error);
    });
  }

  if (summary) {
    const ok = summary.errors.length === 0;
    return (
      <div className="max-w-3xl space-y-4">
        <div className={`rounded-xl border p-6 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {ok ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <AlertTriangle className="h-7 w-7 text-amber-600" />}
          <h2 className="mt-3 text-lg font-bold text-plum-950">Import finished</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['New on the board', summary.new_applications],
              ['New people', summary.new_people],
              ['Already there', summary.already_there],
              ['Could not import', summary.errors.length],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-2xl font-bold tabular-nums text-plum-950">{v}</dd>
              </div>
            ))}
          </dl>
          {summary.no_job_match > 0 && (
            <p className="mt-4 text-sm text-slate-700">
              {summary.no_job_match} {summary.no_job_match === 1 ? 'row' : 'rows'} did not match a job by title or CareerPlug
              job ID, so they are on the board without a position. Add the CareerPlug job ID to the job in{' '}
              <Link href="/dashboard/jobs" className="font-semibold text-teal-700 underline">Jobs</Link> to match next time.
            </p>
          )}
          {summary.errors.length > 0 && (
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-white p-3 text-xs text-slate-700 ring-1 ring-slate-200">
              {summary.errors.map((e) => <li key={e.row}>Row {e.row + 1}: {e.error}</li>)}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/recruitment" className="rounded-lg bg-plum-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-plum-800">
            Open the Applicants board
          </Link>
          <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> Import another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold text-plum-950">1. Choose the export</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div>
              <label htmlFor="imp-source" className="block text-sm font-semibold text-slate-800">Came from</label>
              <select id="imp-source" value={source} onChange={(e) => setSource(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <span className="block text-sm font-semibold text-slate-800">CSV file</span>
              <label htmlFor="imp-file"
                className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 hover:border-plum-700">
                {fileName ? <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> : <Upload className="h-5 w-5 text-teal-700" />}
                <span className="truncate text-sm text-slate-600">
                  {fileName ? `${fileName} · ${data.length} applicants` : 'Select a .csv export'}
                </span>
              </label>
              <input id="imp-file" type="file" accept=".csv,text/csv" className="sr-only"
                onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        </section>

        {headers.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="font-bold text-plum-950">2. Check the columns</h2>
            <p className="mt-1 text-sm text-slate-600">
              We matched what we could. Anything set to <em>Skip</em> is not imported.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Column in the file</th>
                    <th className="py-2 pr-3 font-semibold">Import as</th>
                    <th className="py-2 font-semibold">First row</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {headers.map((h, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{h || <em className="text-slate-400">no header</em>}</td>
                      <td className="py-2 pr-3">
                        <select aria-label={`Import ${h} as`} value={mapping[i]}
                          onChange={(e) => setMapping((m) => m.map((t, j) => (j === i ? (e.target.value as Target) : t)))}
                          className={`w-44 rounded-md border px-2 py-1.5 text-sm ${mapping[i] ? 'border-plum-700/40 bg-plum-700/5 text-plum-950' : 'border-slate-300 text-slate-500'}`}>
                          <option value="">Skip</option>
                          {TARGETS.map((t) => (
                            <option key={t.key} value={t.key} disabled={mapped.has(t.key) && mapping[i] !== t.key}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="max-w-[16rem] truncate py-2 text-slate-600">{data[0]?.[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!hasName && <p className="mt-4 text-sm font-medium text-amber-800">Choose which column holds the applicant&apos;s name.</p>}
            {hasName && !hasContact && <p className="mt-4 text-sm font-medium text-amber-800">Choose an email or phone column, so the team can reach them.</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <button type="button" onClick={runImport} disabled={!hasName || !hasContact || pending}
                className="rounded-lg bg-plum-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-50">
                {pending ? 'Importing…' : `Import ${data.length} ${data.length === 1 ? 'applicant' : 'applicants'} from ${source}`}
              </button>
              <button type="button" onClick={reset} className="text-sm font-semibold text-slate-500 hover:text-plum-700">Cancel</button>
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
          <h2 className="font-bold text-plum-950">Exporting from CareerPlug</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>Open <strong>Applicants</strong> in CareerPlug.</li>
            <li>Filter to the job or date range you want.</li>
            <li>Select them and choose <strong>Export</strong> to download a CSV.</li>
            <li>Upload that file here.</li>
          </ol>
          <p className="mt-3">Indeed and ZipRecruiter exports work the same way.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
          <h2 className="flex items-center gap-1.5 font-bold text-plum-950"><Zap className="h-4 w-4 text-teal-600" /> Automatic feed</h2>
          <p className="mt-2">
            To skip the export, an administrator can create a feed key in{' '}
            <Link href="/dashboard/settings#intake" className="font-semibold text-teal-700 underline">Settings</Link>.
            n8n or Zapier then sends each new applicant from the CareerPlug notification email straight onto the board.
          </p>
        </div>
      </aside>
    </div>
  );
}
