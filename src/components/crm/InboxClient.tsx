'use client';

import { useState, useTransition } from 'react';
import {
  Mail, Phone, Loader2, ArrowRightCircle, User, CheckCircle2, MousePointerClick,
} from 'lucide-react';
import { Card, CardHead, Empty, Pill, ago } from '@/components/crm/ui';
import type { Board } from '@/lib/crm/board';
import { INQUIRY_STAGES, INQUIRY_TONE as STATUS_TONE, CLOSED_INQUIRY_STAGES, inquiryStageLabel } from '@/lib/pipeline';
import {
  setInquiryStatus, claimInquiry, setBookingStatus, inquiryToTask,
} from '@/app/(dashboard)/dashboard/inbox/actions';

const BOOKING_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'];

type Inquiry = {
  id: string; name: string; email: string | null; phone: string | null;
  service_interested: string | null; message: string | null; source_page: string | null;
  cta: string | null; status: string; owner_id: string | null; created_at: string;
  source: string | null;
  linked_task: boolean;
};

type Booking = {
  id: string; name: string; email: string | null; phone: string | null;
  requested_slot: string | null; notes: string | null; status: string; cta: string | null;
};

export default function InboxClient({
  inquiries, bookings, boards, canWrite, userId,
}: {
  inquiries: Inquiry[]; bookings: Booking[]; boards: Board[];
  canWrite: boolean; userId: string | null;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [board, setBoard] = useState(boards[0]?.id ?? '');
  const [filter, setFilter] = useState<string>('open');

  function run(id: string, fn: () => Promise<{ ok: true; note?: string } | { ok: false; error: string }>) {
    setBusy(id); setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { text: r.note ?? 'Done.' } : { text: r.error, bad: true });
      setBusy(null);
    });
  }

  const shown = inquiries.filter((i) =>
    filter === 'all' ? true
    : filter === 'mine' ? i.owner_id === userId
    : !CLOSED_INQUIRY_STAGES.includes(i.status)
  );

  return (
    <div className="space-y-6 p-5 sm:p-8">
      {msg && (
        <p
          role={msg.bad ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ring-1 ${
            msg.bad ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {[['open', 'Still open'], ['mine', 'Mine'], ['all', 'Everything']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === k ? 'bg-plum-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
            {canWrite && boards.length > 0 && (
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                Send cards to
                <select
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                >
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <Card>
            <CardHead title="Inquiries and applications" sub={`${shown.length} showing`} icon={Mail} />
            {shown.length === 0 ? (
              <div className="p-5"><Empty>Nothing here. Everything has been worked.</Empty></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {shown.map((i) => (
                  <li key={i.id} id={`inq-${i.id}`} className="scroll-mt-6 p-5 target:bg-teal-50/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-plum-950">
                          {i.name}
                          <Pill tone={STATUS_TONE[i.status] ?? ''}>{inquiryStageLabel(i.status)}</Pill>
                          {i.owner_id === userId && (
                            <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-plum-700">mine</span>
                          )}
                          {i.linked_task && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> on a board
                            </span>
                          )}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          {i.phone && (
                            <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 font-medium hover:text-plum-700">
                              <Phone className="h-3 w-3" />{i.phone}
                            </a>
                          )}
                          {i.email && (
                            <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-plum-700">
                              <Mail className="h-3 w-3" />{i.email}
                            </a>
                          )}
                          <Pill>{i.service_interested ?? 'general'}</Pill>
                          {i.cta && (
                            <span className="inline-flex items-center gap-1 text-slate-400">
                              <MousePointerClick className="h-3 w-3" />{i.cta}
                            </span>
                          )}
                          {i.source_page && <span className="text-slate-400">{i.source_page}</span>}
                          {i.source && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-800 ring-1 ring-sky-200">via {i.source}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{ago(i.created_at)}</span>
                    </div>

                    {i.message && (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                        {i.message}
                      </p>
                    )}

                    {canWrite && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select
                          value={i.status}
                          disabled={busy === i.id}
                          onChange={(e) => run(i.id, () => setInquiryStatus(i.id, e.target.value))}
                          aria-label={`Status for ${i.name}`}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                        >
                          {INQUIRY_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>

                        <button
                          onClick={() => run(i.id, () => claimInquiry(i.id, i.owner_id !== userId))}
                          disabled={busy === i.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <User className="h-3.5 w-3.5" />
                          {i.owner_id === userId ? 'Release' : 'Take it'}
                        </button>

                        <button
                          onClick={() => run(i.id, () => inquiryToTask(i.id, board))}
                          disabled={busy === i.id || !board}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-plum-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-plum-800 disabled:opacity-60"
                        >
                          {busy === i.id && pending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ArrowRightCircle className="h-3.5 w-3.5" />}
                          Make it a card
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHead title="Appointment requests" sub="Requested, not confirmed until you say so" icon={Phone} />
          {bookings.length === 0 ? (
            <div className="p-5"><Empty>No appointment requests.</Empty></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <li key={b.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-plum-950">{b.name}</p>
                    <Pill>{b.status}</Pill>
                  </div>
                  <p className="mt-1 text-xs font-medium text-teal-700">
                    {b.requested_slot
                      ? new Date(b.requested_slot).toLocaleString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })
                      : 'no slot given'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{b.phone ?? b.email}</p>
                  {b.notes && <p className="mt-1.5 text-xs text-slate-600">{b.notes}</p>}
                  {canWrite && (
                    <select
                      value={b.status}
                      disabled={busy === b.id}
                      onChange={(e) => run(b.id, () => setBookingStatus(b.id, e.target.value))}
                      aria-label={`Status for ${b.name}`}
                      className="mt-2.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
