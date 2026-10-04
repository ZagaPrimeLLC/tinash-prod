'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  BENEFIT_PRESETS, MAX_CUSTOM_BENEFITS, makeSlug,
  type EmploymentType, type JobStatus, type PayInterval, type WorkMode,
} from '@/lib/jobs';

export type JobResult = { ok: true; id: string; note: string } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc('tinash_role');
  return { supabase, user, canWrite: role === 'admin' || role === 'ops' };
}

const EMPLOYMENT: EmploymentType[] = ['full_time', 'part_time', 'per_diem', 'contract'];
const MODES: WorkMode[] = ['onsite', 'remote', 'hybrid'];
const INTERVALS: PayInterval[] = ['hour', 'week', 'year'];

const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max);
const pick = <T extends string>(v: string, allowed: T[], fallback: T): T =>
  (allowed as string[]).includes(v) ? (v as T) : fallback;

function money(v: string): number | null {
  const n = Number(v.replace(/[$,\s]/g, ''));
  return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function refresh(slug?: string | null) {
  revalidatePath('/dashboard/jobs');
  revalidatePath('/careers');
  if (slug) revalidatePath(`/careers/${slug}`);
  revalidatePath('/sitemap.xml');
}

/** Fields that mean "this job is now live on the website". */
function goLive(postedAt: string | null) {
  return { status: 'open' as const, published: true, closed_at: null, posted_at: postedAt ?? new Date().toISOString() };
}

export async function saveJob(id: string | null, fd: FormData): Promise<JobResult> {
  const { supabase, user, canWrite } = await ctx();
  if (!canWrite) return { ok: false, error: 'Only the operations team can edit jobs.' };

  const title = text(fd, 'title', 70);
  if (!title) return { ok: false, error: 'Give the job a title.' };

  const description = text(fd, 'description', 20000);
  const summary = text(fd, 'summary', 300);
  const location = text(fd, 'location', 120);

  const custom = fd.getAll('custom_benefit').map((v) => String(v).trim().slice(0, 60)).filter(Boolean);
  if (custom.length > MAX_CUSTOM_BENEFITS) {
    return { ok: false, error: `Up to ${MAX_CUSTOM_BENEFITS} custom benefits.` };
  }
  const presets = fd.getAll('benefit').map(String).filter((b) => BENEFIT_PRESETS.includes(b));
  const benefits = Array.from(new Set([...presets, ...custom]));

  const pay_min = money(text(fd, 'pay_min', 20));
  const pay_max = money(text(fd, 'pay_max', 20));
  if (pay_min != null && pay_max != null && pay_min > pay_max) {
    return { ok: false, error: 'The minimum pay is higher than the maximum.' };
  }

  const applyUrl = text(fd, 'apply_url', 500);
  if (applyUrl && !/^https:\/\//i.test(applyUrl)) {
    return { ok: false, error: 'The external apply link must start with https://' };
  }

  const fields = {
    title,
    summary: summary || null,
    description: description || null,
    location: location || null,
    requisition_id: text(fd, 'requisition_id', 60) || null,
    employment_type: pick(text(fd, 'employment_type', 20), EMPLOYMENT, 'part_time'),
    work_mode: pick(text(fd, 'work_mode', 20), MODES, 'onsite'),
    experience: text(fd, 'experience', 60) || null,
    benefits,
    pay_min,
    pay_max,
    pay_interval: pick(text(fd, 'pay_interval', 10), INTERVALS, 'hour'),
    apply_url: applyUrl || null,
    careerplug_job_id: text(fd, 'careerplug_job_id', 60) || null,
  };

  const intent = String(fd.get('intent') ?? 'save');
  if (intent === 'publish' && (!description || !location)) {
    return { ok: false, error: 'A job needs a location and a description before it can go on the website.' };
  }
  // NJ pay transparency law (in force June 2025): public postings must state
  // the pay rate or range.
  if (intent === 'publish' && pay_min == null && pay_max == null) {
    return { ok: false, error: 'Add the pay rate or range before publishing. New Jersey requires it on job postings.' };
  }

  if (!id) {
    const slug = makeSlug(title);
    const live = intent === 'publish';
    const { data, error } = await supabase
      .from('job_posts')
      .insert({
        ...fields,
        slug,
        created_by: user?.id ?? null,
        ...(live ? goLive(null) : { status: 'draft', published: false }),
      })
      .select('id, slug')
      .single();
    if (error) return { ok: false, error: error.message };
    refresh(data.slug);
    return { ok: true, id: data.id, note: live ? 'Published. It is live on the Careers page.' : 'Saved as a draft.' };
  }

  const { data: before } = await supabase.from('job_posts').select('slug, posted_at').eq('id', id).single();
  const { error } = await supabase
    .from('job_posts')
    .update({ ...fields, ...(intent === 'publish' ? goLive(before?.posted_at ?? null) : {}) })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  refresh(before?.slug);
  return { ok: true, id, note: intent === 'publish' ? 'Published. It is live on the Careers page.' : 'Changes saved.' };
}

export async function setJobStatus(id: string, status: JobStatus): Promise<void> {
  const { supabase, canWrite } = await ctx();
  if (!canWrite) return;

  const { data: job } = await supabase
    .from('job_posts')
    .select('slug, posted_at, description, location, pay_min, pay_max')
    .eq('id', id)
    .single();
  if (!job) return;
  // Same rule as the form: nothing half-written goes on the website.
  if (status === 'open' && (!job.description || !job.location || (job.pay_min == null && job.pay_max == null))) return;

  const patch =
    status === 'open'
      ? goLive(job.posted_at)
      : status === 'closed'
        ? { status, published: false, closed_at: new Date().toISOString() }
        : { status, published: false };

  await supabase.from('job_posts').update(patch).eq('id', id);
  refresh(job.slug);
}
