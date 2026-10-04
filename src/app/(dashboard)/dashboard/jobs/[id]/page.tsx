import { notFound } from 'next/navigation';
import JobForm from '@/components/crm/JobForm';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { JOB_COLUMNS, type Job } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit job' };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase, role } = await getSession();
  const { data } = await supabase.from('job_posts').select(JOB_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();

  return <JobForm key={(data as Job).updated_at} job={data as Job} initial={null} canWrite={canWrite(role)} />;
}
