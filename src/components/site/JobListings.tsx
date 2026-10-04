'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, Clock, DollarSign, MapPin, Search, X } from 'lucide-react';
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, payLabel, postedLabel, type Job } from '@/lib/jobs';

export type PublicJob = Pick<
  Job,
  'id' | 'slug' | 'title' | 'location' | 'summary' | 'employment_type' | 'work_mode' | 'pay_min' | 'pay_max' | 'pay_interval' | 'posted_at'
>;

const field =
  'w-full rounded-xl border border-plum-200 bg-white px-4 py-3 text-plum-950 outline-none focus:border-teal-500';

export default function JobListings({ jobs }: { jobs: PublicJob[] }) {
  const [q, setQ] = useState('');
  const [where, setWhere] = useState('');
  const [type, setType] = useState('');

  const places = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean) as string[])).sort(),
    [jobs]
  );
  const types = useMemo(() => Array.from(new Set(jobs.map((j) => j.employment_type))), [jobs]);

  const shown = jobs.filter((j) => {
    const text = `${j.title} ${j.summary ?? ''} ${j.location ?? ''}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!where || j.location === where) && (!type || j.employment_type === type);
  });
  const filtering = Boolean(q || where || type);

  return (
    <div>
      {jobs.length > 3 && (
        <div className="grid gap-3 glass rounded-2xl p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] sm:p-5">
          <label className="relative block">
            <span className="sr-only">Search jobs</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-plum-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or town" className={`${field} pl-9`} />
          </label>
          <label className="block">
            <span className="sr-only">Location</span>
            <select value={where} onChange={(e) => setWhere(e.target.value)} className={field}>
              <option value="">All locations</option>
              {places.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Job type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
              <option value="">All job types</option>
              {types.map((t) => <option key={t} value={t}>{EMPLOYMENT_LABEL[t]}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-plum-800" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'open position' : 'open positions'}
          {filtering && ` of ${jobs.length}`}
        </p>
        {filtering && (
          <button type="button" onClick={() => { setQ(''); setWhere(''); setType(''); }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
            <X className="h-4 w-4" /> Clear filters
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-plum-200 p-8 text-center text-plum-800">
          No positions match. Try another town, or register your interest below and we will call you when a case opens nearby.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {shown.map((j) => {
            const pay = payLabel(j);
            return (
              <li key={j.id}>
                <Link
                  href={`/careers/${j.slug}`}
                  className="group flex flex-col gap-4 rounded-3xl border border-white bg-white/80 p-5 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-plum-950/10 sm:flex-row sm:items-center sm:p-6"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold text-plum-950 group-hover:underline sm:text-xl">{j.title}</h3>
                    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-plum-800">
                      {j.location && (
                        <li className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-teal-700" />{j.location}</li>
                      )}
                      <li className="flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4 text-teal-700" />
                        {EMPLOYMENT_LABEL[j.employment_type]}{j.work_mode !== 'onsite' && ` · ${WORK_MODE_LABEL[j.work_mode]}`}
                      </li>
                      {pay && <li className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-teal-700" />{pay}</li>}
                      {j.posted_at && <li className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-teal-700" />{postedLabel(j.posted_at)}</li>}
                    </ul>
                    {j.summary && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-plum-800/90">{j.summary}</p>}
                  </div>
                  <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-teal-500 px-5 py-3 font-semibold text-plum-950 transition group-hover:bg-teal-400">
                    View &amp; apply <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
