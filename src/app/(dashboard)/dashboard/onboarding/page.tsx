import Link from 'next/link';
import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Empty, Pill, Stat, ago, dateLabel } from '@/components/crm/ui';
import StartOnboardingForm from '@/components/crm/StartOnboardingForm';
import { getSession } from '@/lib/crm/session';
import { Route, ListChecks, Send, Eye, ArrowRight, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Onboarding' };

const STATUS: Record<string, string> = {
  draft:       'bg-slate-100 text-slate-700 ring-slate-200',
  sent:        'bg-sky-100 text-sky-800 ring-sky-200',
  in_progress: 'bg-amber-100 text-amber-900 ring-amber-200',
  complete:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
  revoked:     'bg-red-100 text-red-800 ring-red-200',
};

export default async function OnboardingPage() {
  const { supabase } = await getSession();

  const [wf, asg] = await Promise.all([
    supabase.from('workflows').select('*, workflow_steps(id)').eq('active', true).order('name'),
    supabase
      .from('assignments')
      .select('id, status, due_on, sent_at, open_count, last_opened_at, created_at, employees(full_name, job_title, start_date), workflows(name, kind)')
      .order('created_at', { ascending: false }),
  ]);

  const workflows = wf.data ?? [];
  const assignments = asg.data ?? [];
  const live = assignments.filter((a) => a.status === 'sent' || a.status === 'in_progress');
  const opened = assignments.filter((a) => a.open_count > 0);

  return (
    <>
      <PageHeader
        title="Onboarding"
        lead="Give a new hire a step by step pack they can open from a link in an email or a text. No account, no password, nothing for them to set up."
      />

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Stat icon={Route}      label="Packs in flight" value={live.length}      sub="sent or in progress" />
          <Stat icon={Eye}        label="Opened"          value={opened.length}    sub="the new hire has looked" />
          <Stat icon={ListChecks} label="Workflows"       value={workflows.length} sub="templates you can assign" />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHead title="Onboarding packs" sub={`${assignments.length} in total`} icon={Route} />
              {assignments.length === 0 ? (
                <div className="p-5">
                  <Empty>No packs yet. Start one on the right and it appears here.</Empty>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {assignments.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/onboarding/${a.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-plum-950">
                              {/* @ts-expect-error supabase embeds a single row here */}
                              {a.employees?.full_name}
                            </span>
                            <Pill tone={STATUS[a.status] ?? ''}>{a.status.replace('_', ' ')}</Pill>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {/* @ts-expect-error supabase embeds a single row here */}
                            <span>{a.workflows?.name}</span>
                            {a.due_on && <><span>·</span><span>due {dateLabel(a.due_on)}</span></>}
                            {a.open_count > 0 && (
                              <><span>·</span><span>opened {a.open_count}x, last {ago(a.last_opened_at)}</span></>
                            )}
                            {a.status === 'draft' && (
                              <><span>·</span><span className="font-semibold text-amber-700">link not live yet</span></>
                            )}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHead title="Workflows" sub="The step by step templates you assign" icon={FileText} />
              {workflows.length === 0 ? (
                <div className="p-5"><Empty>No workflows set up yet.</Empty></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {workflows.map((w) => (
                    <li key={w.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <span className="min-w-0">
                        <span className="block font-semibold text-plum-950">{w.name}</span>
                        {w.summary && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{w.summary}</span>}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                        {(w.workflow_steps ?? []).length} steps
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="self-start">
            <CardHead title="Start onboarding" sub="Creates the record and the pack" icon={Send} />
            <div className="p-5">
              {workflows.length === 0 ? (
                <Empty>Add a workflow first.</Empty>
              ) : (
                <StartOnboardingForm
                  workflows={workflows.map((w) => ({ id: w.id, name: w.name }))}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
