import JobForm from '@/components/crm/JobForm';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { JOB_COLUMNS, type Job } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New job' };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const { supabase, role } = await getSession();

  // "Copy an existing job": everything carries over except its identity and status.
  let initial: Job | null = null;
  if (from && /^[0-9a-f-]{36}$/i.test(from)) {
    const { data } = await supabase.from('job_posts').select(JOB_COLUMNS).eq('id', from).maybeSingle();
    initial = (data as Job | null) ?? null;
  }

  return <JobForm job={null} initial={initial} canWrite={canWrite(role)} />;
}
