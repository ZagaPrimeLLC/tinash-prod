import Link from 'next/link';
import {
  ListTodo, Timer, AlertTriangle, Eye, CheckCircle2, UserCheck, Ban,
  Inbox, CalendarCheck, GraduationCap, ArrowRight, Route,
} from 'lucide-react';
import PageHeader from '@/components/crm/PageHeader';
import { Card, CardHead, Stat, Pill, Empty, ago, dateLabel } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import { CLOSED_STAGES, CLOSED_INQUIRY_STAGES } from '@/lib/pipeline';
import { typeMeta, priorityMeta, stageMeta, isOverdue, type WorkItem } from '@/lib/crm/board';

export const dynamic = 'force-dynamic';

function WorkRow({ item }: { item: WorkItem }) {
  const t = typeMeta(item.work_type);
  const p = priorityMeta(item.priority);
  const late = isOverdue(item);
  return (
    <li className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded ring-1 ring-inset ${t.tone}`}>
        <t.icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-plum-950">{item.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className={`inline-flex items-center gap-1 font-semibold`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
            {p.label}
          </span>
          <span>·</span>
          <span>{stageMeta(item.stage).label}</span>
          {item.due_at && (
            <>
              <span>·</span>
              <span className={late ? 'font-semibold text-red-600' : ''}>
                {late ? 'overdue ' : 'due '}
                {dateLabel(item.due_at)}
              </span>
            </>
          )}
        </span>
      </span>
    </li>
  );
}

export default async function OverviewPage() {
  const { supabase, email, role } = await getSession();
  const writes = canWrite(role);
  const leadership = role === 'leadership';

  const [tasksRes, appsRes, inqRes, bookRes, trainRes, assignRes, openInqRes] = await Promise.all([
    supabase.from('tasks').select('*').order('position'),
    supabase.from('applications').select('id, stage, created_at, last_contact_at'),
    supabase.from('inquiries').select('id, created_at, name, service_interested').order('created_at', { ascending: false }).limit(5),
    supabase.from('bookings').select('id, requested_slot, status').order('requested_slot'),
    supabase.from('trainings').select('id, name, status, expires_on, employees(full_name)').order('expires_on'),
    supabase.from('assignments').select('id, status, due_on, employees(full_name), workflows(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('inquiries').select('id', { count: 'exact', head: true }).not('status', 'in', `(${CLOSED_INQUIRY_STAGES.join(',')})`),
  ]);

  const tasks = (tasksRes.data ?? []) as WorkItem[];
  const open = tasks.filter((t) => t.stage !== 'done');
  const wip = tasks.filter((t) => t.stage === 'in_progress');
  const review = tasks.filter((t) => t.stage === 'review');
  const blocked = tasks.filter((t) => t.stage === 'blocked');
  const issues = open.filter((t) => t.work_type === 'issue' || t.work_type === 'bug');
  const overdue = open.filter(isOverdue);
  // Server component, rendered per request: one clock reading keeps every comparison on the page consistent.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const doneWeek = tasks.filter(
    (t) => t.completed_at && now - new Date(t.completed_at).getTime() < 7 * 864e5
  );

  const apps = appsRes.data ?? [];
  const livePipeline = apps.filter((a) => !CLOSED_STAGES.includes(a.stage));

  const openInquiries = openInqRes.count ?? 0;

  const bookings = (bookRes.data ?? []).filter(
    (b) => b.requested_slot && new Date(b.requested_slot).getTime() > now
  );

  const trainings = trainRes.data ?? [];
  const expiringSoon = trainings.filter(
    (t) => t.expires_on && new Date(t.expires_on).getTime() < now + 60 * 864e5
  );

  const attention = [...overdue, ...issues]
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title={leadership ? 'Where things stand' : 'Overview'}
        lead={
          leadership
            ? 'Everything open across the agency, what is moving, and what is stuck.'
            : `Signed in as ${email}. This is the day to day picture of the agency.`
        }
      />

      <div className="space-y-6 p-5 sm:p-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat icon={ListTodo}      label="Open items"      value={open.length}     sub="everything not done" href="/dashboard/board" />
          <Stat icon={Timer}         label="In progress"     value={wip.length}      sub="someone is on it"    href="/dashboard/board" />
          <Stat icon={Eye}           label="Waiting on review" value={review.length} sub="needs a decision"    href="/dashboard/board" />
          <Stat icon={Ban}           label="Blocked"         value={blocked.length}  sub="stuck, needs unblocking" tone="alert" href="/dashboard/board" />
          <Stat icon={AlertTriangle} label="Overdue"         value={overdue.length}  sub="past the due date" tone="alert" href="/dashboard/board" />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHead
              title="Needs attention"
              sub="Overdue work and anything raised as an issue"
              icon={AlertTriangle}
              action={
                <Link href="/dashboard/board" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-plum-700">
                  Open the board <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {attention.length === 0 ? (
              <div className="p-5">
                <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-900">
                    Nothing is overdue and no issues are open.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attention.map((item) => <WorkRow key={item.id} item={item} />)}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHead title="Recruitment" sub="Caregiver applicant pipeline" icon={UserCheck} />
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">In pipeline</span>
                  <span className="text-2xl font-bold tabular-nums text-plum-950">{livePipeline.length}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Open care inquiries</span>
                  <span className="text-lg font-bold tabular-nums text-plum-950">{openInquiries}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">Consultations requested</span>
                  <span className="text-lg font-bold tabular-nums text-plum-950">{bookings.length}</span>
                </div>
                <Link href="/dashboard/recruitment" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-plum-700">
                  See the applicant board <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>

            <Card>
              <CardHead title="Training due" sub="Expiring in the next 60 days" icon={GraduationCap} />
              <div className="px-5 py-4">
                {expiringSoon.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing expires in the next 60 days.</p>
                ) : (
                  <ul className="space-y-2">
                    {expiringSoon.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-slate-700">
                          {/* @ts-expect-error supabase embeds a single row here */}
                          {t.employees?.full_name ?? 'Unassigned'}
                          <span className="text-slate-400"> · {t.name}</span>
                        </span>
                        <Pill tone="bg-amber-100 text-amber-900 ring-amber-200">
                          {dateLabel(t.expires_on)}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHead title="Latest from the website" sub="Contact and careers forms" icon={Inbox} />
            {(inqRes.data ?? []).length === 0 ? (
              <div className="p-5"><Empty>No enquiries yet.</Empty></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(inqRes.data ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-plum-950">{i.name}</span>
                      <span className="text-xs text-slate-500">{i.service_interested ?? 'general'}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{ago(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {writes ? (
            <Card>
              <CardHead title="Onboarding in flight" sub="New hires working through their pack" icon={Route} />
              {(assignRes.data ?? []).length === 0 ? (
                <div className="p-5"><Empty>No onboarding packs assigned yet.</Empty></div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(assignRes.data ?? []).map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        {/* @ts-expect-error supabase embeds a single row here */}
                        <span className="block truncate text-sm font-medium text-plum-950">{a.employees?.full_name}</span>
                        {/* @ts-expect-error supabase embeds a single row here */}
                        <span className="text-xs text-slate-500">{a.workflows?.name}</span>
                      </span>
                      <Pill>{a.status.replace('_', ' ')}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : (
            <Card>
              <CardHead title="Finished this week" sub="Closed in the last seven days" icon={CheckCircle2} />
              <div className="px-5 py-4">
                <p className="text-3xl font-bold tabular-nums text-emerald-700">{doneWeek.length}</p>
                <p className="mt-1 text-sm text-slate-500">items completed</p>
              </div>
            </Card>
          )}
        </section>

        {bookings.length > 0 && (
          <Card>
            <CardHead title="Upcoming consultations" sub="Requested from the website" icon={CalendarCheck} />
            <ul className="divide-y divide-slate-100">
              {bookings.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium text-plum-950">
                    {new Date(b.requested_slot).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                  <Pill>{b.status}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
