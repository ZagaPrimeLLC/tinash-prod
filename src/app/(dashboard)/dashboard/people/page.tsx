import Link from 'next/link';
import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, Pill, Stat, dateLabel } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { Users, UserPlus, Mail, Phone, BadgeCheck, Route } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Employees' };

const EMPLOYMENT: Record<string, string> = {
  applicant:  'bg-slate-100 text-slate-700 ring-slate-200',
  offer:      'bg-sky-100 text-sky-800 ring-sky-200',
  onboarding: 'bg-amber-100 text-amber-900 ring-amber-200',
  active:     'bg-emerald-100 text-emerald-800 ring-emerald-200',
  inactive:   'bg-slate-100 text-slate-500 ring-slate-200',
};

export default async function PeoplePage() {
  const { supabase, role } = await getSession();
  const writes = canWrite(role);

  const { data } = await supabase
    .from('employees')
    .select('*, trainings(id, status, expires_on), assignments(id, status)')
    .order('full_name');

  const people = data ?? [];
  const active = people.filter((p) => p.employment === 'active');
  const onboarding = people.filter((p) => p.employment === 'onboarding' || p.employment === 'offer');

  return (
    <>
      <PageHeader
        title="Employees"
        lead="Everyone on the team and where they are in the process. Employment details only, never anything clinical."
        actions={
          writes ? (
            <Link
              href="/dashboard/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-plum-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-plum-800"
            >
              <UserPlus className="h-4 w-4" /> Start onboarding
            </Link>
          ) : null
        }
      />

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Users}      label="On the team"   value={active.length}     sub="active employees" />
          <Stat icon={Route}      label="Onboarding"    value={onboarding.length} sub="offer or in progress" />
          <Stat icon={BadgeCheck} label="Total records" value={people.length} />
        </section>

        <Card>
          <CardHead title="Everyone" sub={`${people.length} records`} icon={Users} />
          {people.length === 0 ? (
            <div className="p-5">
              <Empty>No employee records yet.</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-5 py-2.5 font-semibold">Role</th>
                    <th className="px-5 py-2.5 font-semibold">Contact</th>
                    <th className="px-5 py-2.5 font-semibold">Started</th>
                    <th className="px-5 py-2.5 font-semibold">Training</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.map((p) => {
                    const trainings = (p.trainings ?? []) as { status: string }[];
                    const complete = trainings.filter((t) => t.status === 'complete').length;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-plum-950">{p.full_name}</td>
                        <td className="px-5 py-3 text-slate-600">{p.job_title}</td>
                        <td className="px-5 py-3">
                          <span className="flex flex-col gap-0.5 text-xs text-slate-600">
                            {p.email && (
                              <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-plum-700">
                                <Mail className="h-3 w-3" />{p.email}
                              </a>
                            )}
                            {p.phone && (
                              <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:text-plum-700">
                                <Phone className="h-3 w-3" />{p.phone}
                              </a>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{dateLabel(p.start_date)}</td>
                        <td className="px-5 py-3 text-xs tabular-nums text-slate-600">
                          {trainings.length === 0 ? 'none yet' : `${complete} of ${trainings.length}`}
                        </td>
                        <td className="px-5 py-3">
                          <Pill tone={EMPLOYMENT[p.employment] ?? ''}>{p.employment}</Pill>
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
