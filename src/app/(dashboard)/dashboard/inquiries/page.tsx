import Link from 'next/link';
import { Inbox } from 'lucide-react';
import PageHeader from '@/components/crm/PageHeader';
import InquiryBoard from '@/components/crm/InquiryBoard';
import { Notice } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import type { InquiryCard } from '@/lib/crm-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Care inquiries' };

// Careers applications and chat leads also arrive in `inquiries`; the family
// pipeline shows everything except caregiver job applications.
const NOT_FAMILY = ['caregiver-application', 'consulting'];

export default async function InquiriesPage() {
  const { supabase, user, role } = await getSession();
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, name, email, phone, service_interested, status, owner_id, created_at, handled_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const cards: InquiryCard[] = (data ?? [])
    .filter((r) => !NOT_FAMILY.includes(r.service_interested ?? ''))
    .map((r) => ({
      id: r.id, stage: r.status, name: r.name, phone: r.phone, email: r.email,
      service: r.service_interested, createdAt: r.created_at, handledAt: r.handled_at,
      mine: !!user && r.owner_id === user.id,
    }));

  return (
    <>
      <PageHeader
        title="Care inquiries"
        lead="Families who reached out, from first contact to a started client. Use the arrows on a card to move it along; open the Inbox to read messages, take ownership or make a follow-up card."
        actions={
          <Link href="/dashboard/inbox" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-plum-700 ring-1 ring-slate-300 hover:bg-slate-50">
            <Inbox className="h-4 w-4" /> Open the inbox
          </Link>
        }
      />
      {error && <div className="px-5 pt-5 sm:px-8"><Notice tone="warn">Could not load inquiries: {error.message}</Notice></div>}
      <InquiryBoard cards={cards} canWrite={canWrite(role)} />
      <p className="px-5 pb-8 text-xs text-slate-500 sm:px-8">
        Contact details and the service asked about only. Diagnoses, medications and care notes never belong in this system.
      </p>
    </>
  );
}
