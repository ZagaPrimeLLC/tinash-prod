import Link from 'next/link';
import PageHeader from '@/components/crm/PageHeader';
import InboxClient from '@/components/crm/InboxClient';
import { Notice } from '@/components/crm/ui';
import { getSession } from '@/lib/crm/session';
import { canWrite } from '@/lib/crm/nav';
import type { Board } from '@/lib/crm/board';
import { sourceLabel, type Attribution } from '@/lib/attribution';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inbox' };

const INQ_PAGE = 50;
const BOOK_PAGE = 40;

const page = (v: string | undefined) => Math.max(1, Math.min(10_000, Number.parseInt(v ?? '1', 10) || 1));

export default async function InboxPage({
  searchParams,
}: { searchParams: Promise<{ ip?: string; bp?: string; bview?: string }> }) {
  const sp = await searchParams;
  const ip = page(sp.ip);
  const bp = page(sp.bp);
  const bview = sp.bview === 'past' ? 'past' : 'upcoming';

  const { supabase, user, role } = await getSession();
  const writes = canWrite(role);

  // Upcoming = from twelve hours ago onwards, soonest first. Past = the rest,
  // latest first. Every record stays reachable through the pager.
  // Server component, rendered per request.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = new Date(Date.now() - 12 * 36e5).toISOString();
  const bookingsQuery = supabase.from('bookings').select('*', { count: 'exact' });
  const bookingsPage = (bview === 'upcoming'
    ? bookingsQuery.gte('requested_slot', cutoff).order('requested_slot', { ascending: true })
    : bookingsQuery.lt('requested_slot', cutoff).order('requested_slot', { ascending: false })
  ).range((bp - 1) * BOOK_PAGE, bp * BOOK_PAGE - 1);

  const [inqRes, bookRes, boardRes, linkedRes] = await Promise.all([
    supabase.from('inquiries').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((ip - 1) * INQ_PAGE, ip * INQ_PAGE - 1),
    bookingsPage,
    supabase.from('boards').select('*').eq('archived', false).order('position'),
    supabase.from('tasks').select('linked_id').eq('linked_type', 'inquiry'),
  ]);

  const linked = new Set((linkedRes.data ?? []).map((t) => t.linked_id));

  const inquiries = (inqRes.data ?? []).map((i) => ({
    id: i.id, name: i.name, email: i.email, phone: i.phone,
    service_interested: i.service_interested, message: i.message,
    source_page: i.source_page, cta: i.cta, status: i.status,
    owner_id: i.owner_id, created_at: i.created_at,
    source: sourceLabel(i.attribution as Attribution | null),
    linked_task: linked.has(i.id),
  }));

  const bookings = (bookRes.data ?? []).map((b) => ({
    id: b.id, name: b.name, email: b.email, phone: b.phone,
    requested_slot: b.requested_slot, notes: b.notes, status: b.status, cta: b.cta,
  }));

  return (
    <>
      <PageHeader
        title="Inbox"
        lead="Everything the website sent us: contact forms, careers applications, chat assistant conversations and appointment requests. Work a lead here and it becomes a card someone owns."
      />
      {inqRes.error && (
        <div className="px-5 pt-5 sm:px-8">
          <Notice tone="warn">Could not load the inbox: {inqRes.error.message}</Notice>
        </div>
      )}
      <Pager
        ip={ip} bp={bp} bview={bview}
        inqTotal={inqRes.count ?? 0} bookTotal={bookRes.count ?? 0}
      />
      {!writes && (
        <div className="px-5 pt-5 sm:px-8">
          <Notice>This is a read only view. The operations team works the inbox.</Notice>
        </div>
      )}
      <InboxClient
        inquiries={inquiries}
        bookings={bookings}
        boards={(boardRes.data ?? []) as Board[]}
        canWrite={writes}
        userId={user?.id ?? null}
      />
    </>
  );
}

function Pager({
  ip, bp, bview, inqTotal, bookTotal,
}: { ip: number; bp: number; bview: 'upcoming' | 'past'; inqTotal: number; bookTotal: number }) {
  const href = (next: Partial<{ ip: number; bp: number; bview: string }>) => {
    const q = new URLSearchParams();
    const v = { ip, bp, bview, ...next };
    if (v.ip > 1) q.set('ip', String(v.ip));
    if (v.bp > 1) q.set('bp', String(v.bp));
    if (v.bview !== 'upcoming') q.set('bview', v.bview);
    const s = q.toString();
    return s ? `/dashboard/inbox?${s}` : '/dashboard/inbox';
  };
  const range = (p: number, size: number, total: number) =>
    total === 0 ? '0' : `${(p - 1) * size + 1}–${Math.min(p * size, total)} of ${total}`;
  const btn = 'rounded-md px-2.5 py-1 font-semibold ring-1 ring-slate-200 hover:bg-white';
  const off = 'rounded-md px-2.5 py-1 text-slate-300 ring-1 ring-slate-100';

  return (
    <nav aria-label="Inbox pages" className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 pt-5 text-xs text-slate-600 sm:px-8">
      <span className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">Enquiries {range(ip, INQ_PAGE, inqTotal)}</span>
        {ip > 1 ? <Link className={btn} href={href({ ip: ip - 1 })}>← Newer</Link> : <span className={off}>← Newer</span>}
        {ip * INQ_PAGE < inqTotal ? <Link className={btn} href={href({ ip: ip + 1 })}>Older →</Link> : <span className={off}>Older →</span>}
      </span>
      <span className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">Appointments</span>
        <Link className={bview === 'upcoming' ? `${btn} bg-plum-700 text-white ring-plum-700 hover:bg-plum-700` : btn} href={href({ bview: 'upcoming', bp: 1 })}>Upcoming</Link>
        <Link className={bview === 'past' ? `${btn} bg-plum-700 text-white ring-plum-700 hover:bg-plum-700` : btn} href={href({ bview: 'past', bp: 1 })}>Past</Link>
        <span>{range(bp, BOOK_PAGE, bookTotal)}</span>
        {bp > 1 && <Link className={btn} href={href({ bp: bp - 1 })}>←</Link>}
        {bp * BOOK_PAGE < bookTotal && <Link className={btn} href={href({ bp: bp + 1 })}>→</Link>}
      </span>
    </nav>
  );
}
