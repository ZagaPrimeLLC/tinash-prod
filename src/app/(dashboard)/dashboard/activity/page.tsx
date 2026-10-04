import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, ago } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { History } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity' };

export default async function ActivityPage() {
  const { supabase } = await getSession();
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        lead="An append only record of what happened in the system. Nobody can edit or delete a line here, including an administrator."
      />
      <div className="p-5 sm:p-8">
        <Card>
          <CardHead title="Recent activity" sub={`${rows.length} entries`} icon={History} />
          {rows.length === 0 ? (
            <div className="p-5">
              <Empty>Nothing recorded yet. Entries appear here as the team works.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-plum-950">{r.verb}</span>
                    {r.entity_type && <span className="text-slate-500"> · {r.entity_type}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{ago(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
