import { notFound } from 'next/navigation';
import Shell from '@/components/crm/Shell';
import PageHeader from '@/components/crm/PageHeader';
import BoardClient from '@/components/crm/BoardClient';
import BoardSwitcher, { BoardNote } from '@/components/crm/BoardSwitcher';
import InquiryBoard from '@/components/crm/InquiryBoard';
import Board from '@/components/crm/Board';
import { Notice } from '@/components/crm/ui';
import { sampleWork, sampleBoards } from '@/lib/sample-crm';
import { sampleBoard, sampleInquiries } from '@/lib/sample-board';

export const metadata = { title: 'CRM design preview', robots: { index: false, follow: false } };

// Design review only. Renders the CRM shell, the work board and both pipelines
// from static sample data, so the layout can be reviewed before Supabase is
// connected and without a login. Never available in production.
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Shell who="design.preview@tinash" profile={{ display_name: 'Design Preview', avatar_url: null, job_title: 'Operations' }} role="ops">
      <div className="px-5 pt-5 sm:px-8">
        <Notice>Design preview. Static sample data, not connected to the database. Buttons that change data are disabled.</Notice>
      </div>
      <PageHeader title="Care inquiries" lead="Families who reached out, from first contact to a started client." />
      <InquiryBoard cards={sampleInquiries} />
      <PageHeader title="Applicants" lead="The caregiver pipeline, from application to hired." />
      <Board cards={sampleBoard} />
      <PageHeader
        title="Operations"
        lead="The day to day board. Recruitment, coordination, compliance and everything the office is carrying."
        actions={<BoardNote board={sampleBoards[0]} />}
      />
      <BoardSwitcher boards={sampleBoards} current="operations" />
      <BoardClient items={sampleWork} canWrite={false} userId="me" boards={sampleBoards} board={sampleBoards[0]} />
    </Shell>
  );
}
