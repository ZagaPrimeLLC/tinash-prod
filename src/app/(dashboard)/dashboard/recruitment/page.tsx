import Link from 'next/link';
import { FileUp } from 'lucide-react';
import PageHeader from '@/components/crm/PageHeader';
import { canWrite } from '@/lib/crm/nav';
import Board from '@/components/crm/Board';
import { Notice } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import type { BoardCard } from '@/lib/crm-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applicants' };

type Row = {
  id: string; stage: string; qualified: boolean; ready: boolean; score: number | null;
  last_contact_at: string | null; created_at: string; contact_attempts: number; archive_reason: string | null;
  applicants: { name: string; phone: string | null; email: string | null; source: string | null } | null;
  job_posts: { title: string; location: string | null } | null;
};

export default async function RecruitmentPage() {
  const { supabase, role } = await getSession();

  const { data, error } = await supabase
    .from('applications')
    .select('id, stage, qualified, ready, score, last_contact_at, created_at, contact_attempts, archive_reason, applicants(name, phone, email, source), job_posts(title, location)')
    .order('created_at', { ascending: false });

  const cards: BoardCard[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    owner: null,
    qualified: r.qualified,
    ready: r.ready,
    score: r.score,
    lastContactAt: r.last_contact_at,
    createdAt: r.created_at,
    attempts: r.contact_attempts,
    archiveReason: r.archive_reason,
    applicant: r.applicants ?? { name: 'Unknown', phone: null, email: null, source: null },
    position: r.job_posts,
  }));

  return (
    <>
      <PageHeader
        title="Applicants"
        lead="The caregiver pipeline, from a website, job board or imported application through to hired. Use the arrows on a card to move it along."
        actions={canWrite(role) ? (
          <Link href="/dashboard/recruitment/import"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50">
            <FileUp className="h-4 w-4" /> Import applicants
          </Link>
        ) : undefined}
      />
      {error && (
        <div className="px-5 pt-5 sm:px-8">
          <Notice tone="warn">Could not load applicants: {error.message}</Notice>
        </div>
      )}
      <Board cards={cards} canWrite={canWrite(role)} />
    </>
  );
}
