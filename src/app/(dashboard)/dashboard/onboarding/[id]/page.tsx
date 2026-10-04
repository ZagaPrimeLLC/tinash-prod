import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Pill, Notice, ago, dateLabel } from '@/components/crm/ui';
import SharePanel from '@/components/crm/SharePanel';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { ArrowLeft, ListChecks, Eye, Building2, User } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Onboarding pack' };

const STATUS: Record<string, string> = {
  draft:       'bg-slate-100 text-slate-700 ring-slate-200',
  sent:        'bg-sky-100 text-sky-800 ring-sky-200',
  in_progress: 'bg-amber-100 text-amber-900 ring-amber-200',
  complete:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
  revoked:     'bg-red-100 text-red-800 ring-red-200',
};

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role } = await getSession();
  const writes = canWrite(role);

  const { data: a } = await supabase
    .from('assignments')
    .select('*, employees(full_name, email, phone, job_title, start_date), workflows(id, name, summary, kind)')
    .eq('id', id)
    .maybeSingle();

  if (!a) notFound();

  const employee = a.employees as { full_name: string; email: string | null; phone: string | null; job_title: string; start_date: string | null };
  const workflow = a.workflows as { id: string; name: string; summary: string | null; kind: string };

  const { data: steps } = await supabase
    .from('workflow_steps')
    .select('*, workflow_step_documents(documents(title, description))')
    .eq('workflow_id', workflow.id)
    .order('position');

  return (
    <>
      <PageHeader
        title={employee.full_name}
        lead={`${employee.job_title} · ${workflow.name}`}
        actions={
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> All packs
          </Link>
        }
      />

      <div className="grid gap-6 p-5 sm:p-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHead
              title="The steps they will see"
              sub={`${(steps ?? []).length} steps in ${workflow.name}`}
              icon={ListChecks}
            />
            <ol className="divide-y divide-slate-100">
              {(steps ?? []).map((s) => {
                const docs = ((s.workflow_step_documents ?? []) as { documents: { title: string; description: string | null } | null }[])
                  .map((d) => d.documents)
                  .filter(Boolean) as { title: string; description: string | null }[];
                return (
                  <li key={s.id} className="flex gap-4 px-5 py-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-plum-700 text-xs font-bold text-white">
                      {s.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-plum-950">{s.title}</p>
                        <Pill tone={s.owner_side === 'office' ? 'bg-violet-100 text-violet-800 ring-violet-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}>
                          {s.owner_side === 'office'
                            ? <><Building2 className="h-3 w-3" /> office does this</>
                            : <><User className="h-3 w-3" /> they do this</>}
                        </Pill>
                      </div>
                      {s.body && (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{s.body}</p>
                      )}
                      {docs.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {docs.map((d) => (
                            <li key={d.title} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                              {d.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHead title="Status" icon={Eye} />
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-slate-600">Pack</dt>
                <dd><Pill tone={STATUS[a.status] ?? ''}>{a.status.replace('_', ' ')}</Pill></dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-slate-600">Sent</dt>
                <dd className="text-xs text-slate-500">{a.sent_at ? ago(a.sent_at) : 'not yet'}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-slate-600">Opened</dt>
                <dd className="text-xs text-slate-500">
                  {a.open_count > 0 ? `${a.open_count}x, last ${ago(a.last_opened_at)}` : 'never'}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-slate-600">Starts</dt>
                <dd className="text-xs text-slate-500">{dateLabel(employee.start_date) || 'not set'}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-slate-600">Link expires</dt>
                <dd className="text-xs text-slate-500">{dateLabel(a.expires_at)}</dd>
              </div>
            </dl>
          </Card>

          {writes ? (
            <SharePanel
              assignmentId={a.id}
              token={a.token}
              status={a.status}
              firstName={employee.full_name.split(' ')[0]}
              email={employee.email}
              phone={employee.phone}
              workflowName={workflow.name}
            />
          ) : (
            <Notice>
              Only the operations team can send or change this pack.
            </Notice>
          )}
        </div>
      </div>
    </>
  );
}
