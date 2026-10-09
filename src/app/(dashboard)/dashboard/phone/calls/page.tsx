import Link from 'next/link';
import { PhoneCall, PhoneMissed, PhoneForwarded, Search } from 'lucide-react';
import { Card, CardHead, Empty } from '@/components/crm/ui';
import { CallRow, PhoneLoadError, type CallListItem } from '@/components/crm/PhoneParts';
import { getSession } from '@/lib/crm/session';
import {
  CALL_LIST_COLUMNS, OUTCOMES, OUTCOME_KEYS, CALLER_TYPES, MISSED_OUTCOMES, CALLBACK_OUTCOMES, njDay,
} from '@/lib/crm/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phone calls' };

const PAGE = 50;

type Query = { view?: string; outcome?: string; type?: string; from?: string; to?: string; q?: string; p?: string };

const VIEWS = [
  { key: 'all',      label: 'All calls',      icon: PhoneCall,      sub: 'Every call the assistant answered, newest first' },
  { key: 'missed',   label: 'Missed',         icon: PhoneMissed,    sub: 'Abandoned or failed: the caller hung up early or the assistant hit an error' },
  { key: 'callback', label: 'Needs callback', icon: PhoneForwarded, sub: 'Calls whose inbox lead is still marked New' },
] as const;

export default async function PhoneCallsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.key === sp.view) ?? VIEWS[0];
  const outcome = OUTCOME_KEYS.includes(sp.outcome ?? '') ? sp.outcome! : '';
  const type = CALLER_TYPES.some((t) => t.key === sp.type) ? sp.type! : '';
  const from = sp.from && njDay(sp.from) != null ? sp.from : '';
  const to = sp.to && njDay(sp.to) != null ? sp.to : '';
  const q = (sp.q ?? '').trim().slice(0, 60);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.p ?? '1', 10) || 1));

  const { supabase } = await getSession();

  // "Needs callback" joins the linked inbox lead and keeps only the ones still New.
  let query = view.key === 'callback'
    ? supabase.from('phone_calls').select(`${CALL_LIST_COLUMNS}, inquiries!inner(status)`, { count: 'exact' })
        .in('outcome', CALLBACK_OUTCOMES as string[]).eq('inquiries.status', 'new')
    : supabase.from('phone_calls').select(CALL_LIST_COLUMNS, { count: 'exact' });

  if (view.key === 'missed') query = query.in('outcome', MISSED_OUTCOMES as string[]);
  if (outcome) query = query.eq('outcome', outcome);
  if (type) query = query.eq('caller_type', type);
  if (from) query = query.gte('started_at', new Date(njDay(from)!).toISOString());
  if (to) query = query.lt('started_at', new Date(njDay(to)! + 864e5).toISOString());
  if (q) {
    // Names by text, numbers by their digits in order: "973 555" finds "(973) 555-0142".
    const digits = q.replace(/\D/g, '');
    const words = q.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().replace(/\s+/g, ' ');
    const ors: string[] = [];
    if (words) ors.push(`caller_name.ilike."*${words}*"`);
    if (digits.length >= 3) {
      const pattern = `*${digits.split('').join('*')}*`;
      ors.push(`caller_number.ilike.${pattern}`, `callback_number.ilike.${pattern}`);
    }
    if (ors.length) query = query.or(ors.join(','));
  }

  const { data, count, error } = await query
    .order('started_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);

  if (error) return <div className="p-5 sm:p-8"><PhoneLoadError message={error.message} /></div>;

  const calls = (data ?? []) as unknown as CallListItem[];
  const total = count ?? 0;

  const href = (next: Partial<Query>) => {
    const v = { view: view.key as string, outcome, type, from, to, q, p: String(page), ...next };
    const s = new URLSearchParams();
    if (v.view && v.view !== 'all') s.set('view', v.view);
    for (const k of ['outcome', 'type', 'from', 'to', 'q'] as const) if (v[k]) s.set(k, v[k]!);
    if (v.p && v.p !== '1') s.set('p', v.p);
    const str = s.toString();
    return str ? `/dashboard/phone/calls?${str}` : '/dashboard/phone/calls';
  };

  const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm';
  const label = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  const btn = 'rounded-md px-2.5 py-1 font-semibold ring-1 ring-slate-200 hover:bg-white';
  const off = 'rounded-md px-2.5 py-1 text-slate-300 ring-1 ring-slate-100';

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ view: v.key, p: '1' })}
            aria-current={v.key === view.key ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              v.key === view.key ? 'bg-plum-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <v.icon className="h-3.5 w-3.5" /> {v.label}
          </Link>
        ))}
      </div>

      <form method="get" action="/dashboard/phone/calls" className="rounded-xl border border-slate-200 bg-white p-4">
        {view.key !== 'all' && <input type="hidden" name="view" value={view.key} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="pc-q" className={label}>Name or number</label>
            <input id="pc-q" name="q" defaultValue={q} placeholder="Maria, or 973 555" className={field} />
          </div>
          <div>
            <label htmlFor="pc-outcome" className={label}>Outcome</label>
            <select id="pc-outcome" name="outcome" defaultValue={outcome} className={field}>
              <option value="">Any</option>
              {OUTCOMES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pc-type" className={label}>Caller</label>
            <select id="pc-type" name="type" defaultValue={type} className={field}>
              <option value="">Anyone</option>
              {CALLER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pc-from" className={label}>From</label>
            <input id="pc-from" name="from" type="date" defaultValue={from} className={field} />
          </div>
          <div>
            <label htmlFor="pc-to" className={label}>To</label>
            <input id="pc-to" name="to" type="date" defaultValue={to} className={field} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-plum-700 px-4 py-2 text-xs font-bold text-white hover:bg-plum-800"
          >
            <Search className="h-3.5 w-3.5" /> Filter
          </button>
          {(outcome || type || from || to || q) && (
            <Link href={href({ outcome: '', type: '', from: '', to: '', q: '', p: '1' })}
              className="text-xs font-semibold text-slate-500 underline hover:text-plum-700">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <Card>
        <CardHead
          title={view.label}
          sub={`${view.sub}. ${total === 0 ? 'None' : `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} of ${total}`}.`}
          icon={view.icon}
        />
        {calls.length === 0 ? (
          <div className="p-5">
            <Empty>
              {view.key === 'callback' ? 'Nobody is waiting on a callback.' : 'No calls match.'}
            </Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {calls.map((c) => <CallRow key={c.id} call={c} />)}
          </ul>
        )}
        {total > PAGE && (
          <nav aria-label="Call pages" className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
            {page > 1 ? <Link className={btn} href={href({ p: String(page - 1) })}>← Newer</Link> : <span className={off}>← Newer</span>}
            {page * PAGE < total ? <Link className={btn} href={href({ p: String(page + 1) })}>Older →</Link> : <span className={off}>Older →</span>}
          </nav>
        )}
      </Card>
    </div>
  );
}
