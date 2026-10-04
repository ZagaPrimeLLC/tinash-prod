import Link from 'next/link';
import { Briefcase, ChevronDown, ExternalLink, FilePlus2, Copy, MapPin, Users } from 'lucide-react';
import PageHeader from '@/components/crm/PageHeader';
import { Card, Empty, Notice, Pill, ago, dateLabel } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import {
  EMPLOYMENT_LABEL, JOB_COLUMNS, STATUS_LABEL, STATUS_TONE, WORK_MODE_LABEL,
  isPublic, payLabel, type Job, type JobStatus,
} from '@/lib/jobs';
import { setJobStatus } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jobs' };

const TABS: { key: 'all' | JobStatus; label: string }[] = [
  { key: 'open', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'paused', label: 'Paused' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: wanted } = await searchParams;
  const tab = TABS.some((t) => t.key === wanted) ? (wanted as 'all' | JobStatus) : 'open';

  const { supabase, role } = await getSession();
  const writes = canWrite(role);

  const [jobsRes, appsRes] = await Promise.all([
    supabase.from('job_posts').select(JOB_COLUMNS).order('updated_at', { ascending: false }),
    supabase.from('applications').select('job_post_id, stage'),
  ]);

  const jobs = (jobsRes.data ?? []) as Job[];
  const counts = new Map<string, { total: number; fresh: number }>();
  for (const a of appsRes.data ?? []) {
    if (!a.job_post_id) continue;
    const c = counts.get(a.job_post_id) ?? { total: 0, fresh: 0 };
    c.total += 1;
    if (a.stage === 'new') c.fresh += 1;
    counts.set(a.job_post_id, c);
  }

  const shown = tab === 'all' ? jobs : jobs.filter((j) => j.status === tab);
  const tally = (k: 'all' | JobStatus) => (k === 'all' ? jobs.length : jobs.filter((j) => j.status === k).length);

  return (
    <>
      <PageHeader
        title="Jobs"
        lead="Create a job here and publish it: it appears on the website Careers page with its own apply form, and applicants land on the Applicants board."
        actions={writes ? <NewJobMenu jobs={jobs} /> : undefined}
      />

      <div className="space-y-5 p-5 sm:p-8">
        {jobsRes.error && <Notice tone="warn">Could not load jobs: {jobsRes.error.message}</Notice>}

        <nav aria-label="Filter jobs by status" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === 'open' ? '/dashboard/jobs' : `/dashboard/jobs?tab=${t.key}`}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tab === t.key ? 'bg-plum-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-plum-700'
              }`}
            >
              {t.label} <span className="ml-1 tabular-nums opacity-70">{tally(t.key)}</span>
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <Empty>
            {tab === 'open'
              ? 'No active jobs. Create one with New job, or publish a draft.'
              : `No ${STATUS_LABEL[tab as JobStatus]?.toLowerCase() ?? ''} jobs.`}
          </Empty>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_7rem_6.5rem_8rem_minmax(0,1.4fr)] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 lg:grid">
              <span>Job title</span>
              <span>Location</span>
              <span>Posted</span>
              <span>Applicants</span>
              <span>Last modified</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {shown.map((j) => {
                const c = counts.get(j.id) ?? { total: 0, fresh: 0 };
                const pay = payLabel(j);
                return (
                  <li
                    key={j.id}
                    className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_7rem_6.5rem_8rem_minmax(0,1.4fr)] lg:items-start lg:gap-4"
                  >
                    <div className="min-w-0">
                      <Link href={`/dashboard/jobs/${j.id}`} className="font-semibold text-plum-950 underline-offset-2 hover:underline">
                        {j.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Pill tone={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Pill>
                        <Pill>{EMPLOYMENT_LABEL[j.employment_type]}</Pill>
                        {pay && <Pill>{pay}</Pill>}
                        {j.requisition_id && <span className="text-[11px] text-slate-500">Req {j.requisition_id}</span>}
                      </div>
                      {c.fresh > 0 && (
                        <Link href="/dashboard/recruitment" className="mt-2 inline-block text-xs font-semibold text-teal-700 hover:underline">
                          Review {c.fresh} new {c.fresh === 1 ? 'applicant' : 'applicants'} →
                        </Link>
                      )}
                    </div>

                    <p className="flex items-start gap-1.5 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>
                        {j.location ?? <span className="text-slate-400">No location</span>}
                        <span className="block text-xs text-slate-400">{WORK_MODE_LABEL[j.work_mode]}</span>
                      </span>
                    </p>

                    <p className="text-sm text-slate-600">
                      <span className="text-xs font-semibold text-slate-400 lg:hidden">Posted </span>
                      {j.posted_at ? dateLabel(j.posted_at) : <span className="text-slate-400">Not yet</span>}
                    </p>

                    <p className="flex items-center gap-1.5 text-sm tabular-nums text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> {c.total}
                    </p>

                    <p className="text-sm text-slate-600">
                      <span className="text-xs font-semibold text-slate-400 lg:hidden">Modified </span>
                      {ago(j.updated_at)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {isPublic(j) && (
                        <a
                          href={`/careers/${j.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          View live <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {writes && <StatusButtons job={j} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function StatusButtons({ job }: { job: Job }) {
  const ready = Boolean(job.description && job.location && (job.pay_min != null || job.pay_max != null));
  const btn = 'rounded-md px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset';
  const actions: { to: JobStatus; label: string; cls: string; disabled?: boolean; title?: string }[] = [];

  if (job.status !== 'open') {
    actions.push({
      to: 'open',
      label: job.status === 'draft' ? 'Publish' : 'Reopen',
      cls: 'bg-plum-700 text-white ring-plum-700 hover:bg-plum-800',
      disabled: !ready,
      title: ready ? undefined : 'Add a location, description and pay first',
    });
  }
  if (job.status === 'open') actions.push({ to: 'paused', label: 'Pause', cls: 'bg-white text-amber-800 ring-amber-200 hover:bg-amber-50' });
  if (job.status !== 'closed' && job.status !== 'draft') {
    actions.push({ to: 'closed', label: 'Close', cls: 'bg-white text-red-700 ring-red-200 hover:bg-red-50' });
  }

  return (
    <>
      {actions.map((a) => (
        <form key={a.to} action={setJobStatus.bind(null, job.id, a.to)}>
          <button type="submit" disabled={a.disabled} title={a.title} className={`${btn} ${a.cls} disabled:cursor-not-allowed disabled:opacity-50`}>
            {a.label}
          </button>
        </form>
      ))}
    </>
  );
}

function NewJobMenu({ jobs }: { jobs: Job[] }) {
  const templates = jobs.slice(0, 8);
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-plum-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-plum-800 [&::-webkit-details-marker]:hidden">
        <Briefcase className="h-4 w-4" /> New job <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
        <Link href="/dashboard/jobs/new" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
          <FilePlus2 className="h-4 w-4 text-teal-700" /> Start from scratch
        </Link>
        {templates.length > 0 && (
          <>
            <p className="mt-1 border-t border-slate-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Copy an existing job
            </p>
            {templates.map((j) => (
              <Link key={j.id} href={`/dashboard/jobs/new?from=${j.id}`} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{j.title}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
