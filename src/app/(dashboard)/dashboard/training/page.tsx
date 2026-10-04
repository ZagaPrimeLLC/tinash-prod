import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, Pill, Stat, dateLabel } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { GraduationCap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Training' };

const STATUS: Record<string, string> = {
  assigned:    'bg-slate-100 text-slate-700 ring-slate-200',
  in_progress: 'bg-sky-100 text-sky-800 ring-sky-200',
  complete:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
  expired:     'bg-red-100 text-red-800 ring-red-200',
};

const DAY = 864e5;

export default async function TrainingPage() {
  const { supabase } = await getSession();

  const { data } = await supabase
    .from('trainings')
    .select('*, employees(full_name, job_title)')
    .order('expires_on', { nullsFirst: false });

  const rows = data ?? [];
  // Server component, rendered per request: one clock reading keeps every comparison on the page consistent.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const complete = rows.filter((r) => r.status === 'complete');
  const outstanding = rows.filter((r) => r.status === 'assigned' || r.status === 'in_progress');
  const expiring = complete.filter(
    (r) => r.expires_on && new Date(r.expires_on).getTime() < now + 60 * DAY
  );
  const expired = rows.filter(
    (r) => r.status === 'expired' || (r.expires_on && new Date(r.expires_on).getTime() < now)
  );

  return (
    <>
      <PageHeader
        title="Training"
        lead="What every employee has completed and what is coming up for renewal. Record the training and whether it is done, never a medical result."
      />

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={CheckCircle2}  label="Complete"        value={complete.length}    tone="good" />
          <Stat icon={Clock}         label="Outstanding"     value={outstanding.length} sub="assigned or in progress" />
          <Stat icon={GraduationCap} label="Expiring soon"   value={expiring.length}    sub="within 60 days" />
          <Stat icon={AlertTriangle} label="Expired"         value={expired.length}     tone="alert" />
        </section>

        <Card>
          <CardHead title="All training records" sub={`${rows.length} records`} icon={GraduationCap} />
          {rows.length === 0 ? (
            <div className="p-5"><Empty>No training records yet.</Empty></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Employee</th>
                    <th className="px-5 py-2.5 font-semibold">Training</th>
                    <th className="px-5 py-2.5 font-semibold">Provider</th>
                    <th className="px-5 py-2.5 font-semibold">Completed</th>
                    <th className="px-5 py-2.5 font-semibold">Expires</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const soon = r.expires_on && new Date(r.expires_on).getTime() < now + 60 * DAY;
                    const gone = r.expires_on && new Date(r.expires_on).getTime() < now;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-plum-950">
                          
                          {r.employees?.full_name ?? 'Unassigned'}
                        </td>
                        <td className="px-5 py-3 text-slate-700">{r.name}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{r.provider ?? 'not recorded'}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{dateLabel(r.completed_on) || 'not yet'}</td>
                        <td className={`px-5 py-3 text-xs ${gone ? 'font-bold text-red-600' : soon ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                          {dateLabel(r.expires_on) || 'no expiry'}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={STATUS[r.status] ?? ''}>{r.status.replace('_', ' ')}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
