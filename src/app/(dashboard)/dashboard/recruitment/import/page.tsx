import PageHeader from '@/components/crm/PageHeader';
import ImportClient from '@/components/crm/ImportClient';
import { Card } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import applicants' };

export default async function ImportPage() {
  const { role } = await getSession();

  return (
    <>
      <PageHeader
        title="Import applicants"
        lead="Bring applicants in from a CareerPlug, Indeed or ZipRecruiter export. People already on the board are recognised by their CareerPlug ID, email or phone, so importing the same file twice does not create duplicates."
      />
      <div className="p-5 sm:p-8">
        {canWrite(role) ? (
          <ImportClient />
        ) : (
          <Card className="p-6 text-sm text-slate-600">Importing is for the operations team.</Card>
        )}
      </div>
    </>
  );
}
