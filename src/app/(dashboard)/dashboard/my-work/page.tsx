import PageHeader from '@/components/crm/PageHeader';
import Link from 'next/link';
import { Card, CardHead, Empty, Pill, dateLabel } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { typeMeta, priorityMeta, stageMeta, isOverdue, STAGES, type WorkItem } from '@/lib/crm/board';
import { CircleUser, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My work' };

export default async function MyWorkPage() {
  const { supabase, user, email } = await getSession();

  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('owner_id', user?.id ?? '')
    .order('due_at', { nullsFirst: false });

  const items = (data ?? []) as WorkItem[];
  const open = items.filter((i) => i.stage !== 'done');
  const late = open.filter(isOverdue);

  return (
    <>
      <PageHeader
        title="My work"
        lead={`Everything on the board assigned to ${email}, newest deadline first.`}
      />
      <div className="space-y-6 p-5 sm:p-8">
        {late.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-semibold text-red-900">
              {late.length} of your {open.length} open {open.length === 1 ? 'item is' : 'items are'} past the due date.
            </p>
          </div>
        )}

        {STAGES.filter((s) => s.key !== 'done').map((stage) => {
          const col = open.filter((i) => i.stage === stage.key);
          if (col.length === 0) return null;
          return (
            <Card key={stage.key}>
              <CardHead title={stage.label} sub={stage.hint} icon={stage.icon} />
              <ul className="divide-y divide-slate-100">
                {col.map((item) => {
                  const t = typeMeta(item.work_type);
                  const p = priorityMeta(item.priority);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded ring-1 ring-inset ${t.tone}`}>
                        <t.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/dashboard/board/${item.id}?from=my-work`} className="block text-sm font-medium text-plum-950 hover:underline">{item.title}</Link>
                        {item.notes && <span className="mt-0.5 block line-clamp-2 text-xs text-slate-500">{item.notes}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {item.priority !== 'normal' && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${p.tone}`}>{p.label}</span>
                        )}
                        {item.due_at && (
                          <span className={`text-[11px] ${isOverdue(item) ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                            {dateLabel(item.due_at)}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}

        {open.length === 0 && (
          <Card>
            <CardHead title="Nothing assigned" icon={CircleUser} />
            <div className="p-5">
              <Empty>Nothing on the board is assigned to you. Open the work board and take something.</Empty>
            </div>
          </Card>
        )}

        {items.some((i) => i.stage === 'done') && (
          <Card>
            <CardHead title="Finished" sub="Items you closed" icon={stageMeta('done').icon} />
            <ul className="divide-y divide-slate-100">
              {items.filter((i) => i.stage === 'done').slice(0, 10).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/dashboard/board/${item.id}?from=my-work`} className="min-w-0 truncate text-slate-500 line-through hover:text-plum-700">{item.title}</Link>
                  <Pill tone="bg-emerald-100 text-emerald-800 ring-emerald-200">done</Pill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
