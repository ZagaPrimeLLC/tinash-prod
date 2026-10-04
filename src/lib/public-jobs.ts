import { anonClient } from '@/lib/supabase/anon';
import { JOB_COLUMNS, type Job } from '@/lib/jobs';

/**
 * Jobs as a member of the public sees them. Deliberately an anonymous client
 * with no cookies: a signed-in team member browsing /careers gets exactly the
 * public view (never a draft), and the pages can be cached, then refreshed the
 * moment a job is published or closed in the CRM.
 */

export async function getOpenJobs(): Promise<Job[]> {
  const db = anonClient();
  if (!db) return []; // not connected yet: the careers page shows its empty state
  const { data, error } = await db
    .from('job_posts')
    .select(JOB_COLUMNS)
    .eq('published', true)
    .eq('status', 'open')
    .order('posted_at', { ascending: false, nullsFirst: false });
  if (error) console.error('careers: could not load jobs', error.message);
  return (data ?? []) as Job[];
}

export async function getOpenJob(slug: string): Promise<Job | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const db = anonClient();
  if (!db) return null;
  const { data } = await db
    .from('job_posts')
    .select(JOB_COLUMNS)
    .eq('slug', slug)
    .eq('published', true)
    .eq('status', 'open')
    .maybeSingle();
  return (data as Job | null) ?? null;
}
