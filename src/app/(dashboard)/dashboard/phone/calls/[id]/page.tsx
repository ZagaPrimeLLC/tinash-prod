import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, AlertTriangle, ClipboardList, MessagesSquare, Info, Inbox, Phone, FileText,
} from 'lucide-react';
import { Card, CardHead, Empty, Notice, Pill, ago } from '@/components/crm/ui';
import { OutcomePill, TestPill, callerLabel, PhoneLoadError } from '@/components/crm/PhoneParts';
import { getSession } from '@/lib/crm/session';
import { INQUIRY_TONE, inquiryStageLabel } from '@/lib/pipeline';
import {
  callerTypeLabel, callTime, duration, usd, inquiryHref, outcomeMeta, TZ,
  type PhoneCall, type TranscriptLine,
} from '@/lib/crm/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phone call' };

// The intake form's fields, in the order the office reads them (receptionist/receptionist/intake.py).
const INTAKE_LABELS: [string, string][] = [
  ['caller_type', 'Caller'],
  ['caller_name', 'Name'],
  ['callback_number', 'Callback number'],
  ['caller_id', 'Caller ID'],
  ['phone_confirmed_by_caller', 'Number read back and confirmed'],
  ['care_recipient', 'Who needs care'],
  ['relationship', 'Relationship to caller'],
  ['service_needed', 'Service needed (their words)'],
  ['service_category', 'Service'],
  ['job_role', 'Role wanted'],
  ['town', 'Town'],
  ['county', 'County'],
  ['payment_type', 'Payment'],
  ['urgency', 'Urgency'],
  ['best_callback_time', 'Best time to call back'],
  ['questions_or_notes', 'Notes'],
];
const SKIP = new Set(['emergency_flagged', 'phone_from_caller_id']);

function show(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v == null) return '';
  return typeof v === 'string' ? v.trim() : JSON.stringify(v);
}

/** 74.2 seconds into a call started at 3:05:10 PM -> "3:06:24 PM". */
function clock(startedAt: string, t: number | undefined): string {
  if (t == null) return '';
  return new Date(new Date(startedAt).getTime() + t * 1000).toLocaleTimeString('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

export default async function PhoneCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const { supabase } = await getSession();
  const { data, error } = await supabase.from('phone_calls').select('*').eq('id', id).maybeSingle();
  if (error) return <div className="p-5 sm:p-8"><PhoneLoadError message={error.message} /></div>;
  if (!data) notFound(); // RLS makes calls a role cannot see indistinguishable from missing ones.
  const call = data as PhoneCall;

  const { data: inquiry } = call.inquiry_id
    ? await supabase.from('inquiries').select('id, name, status, handled_at, created_at').eq('id', call.inquiry_id).maybeSingle()
    : { data: null };

  const intake = (call.intake ?? {}) as Record<string, unknown>;
  const known = INTAKE_LABELS
    .map(([k, label]) => [label, k === 'caller_type' ? callerTypeLabel(String(intake[k] ?? call.caller_type)) : show(intake[k])] as const)
    .filter(([, v]) => v);
  const extra = Object.entries(intake)
    .filter(([k]) => !INTAKE_LABELS.some(([key]) => key === k) && !SKIP.has(k))
    .map(([k, v]) => [k.replace(/_/g, ' '), show(v)] as const)
    .filter(([, v]) => v);

  const transcript = (Array.isArray(call.transcript) ? call.transcript : []) as TranscriptLine[];
  const latency = (call.latency ?? {}) as Record<string, unknown>;
  const firstWords = Array.isArray(latency.first_word_secs) ? (latency.first_word_secs as number[]) : [];
  const avgFirst = firstWords.length ? firstWords.reduce((a, b) => a + Number(b), 0) / firstWords.length : null;
  const reach = call.callback_number || call.caller_number;

  const facts: [string, React.ReactNode][] = [
    ['Started', callTime(call.started_at)],
    ['Length', duration(call.duration_secs)],
    ['Outcome', <span key="o">{outcomeMeta(call.outcome).label} <span className="text-slate-400">· {outcomeMeta(call.outcome).hint}</span></span>],
    ['How it ended', call.end_reason || '–'],
    ['Caller ID', call.caller_number || 'withheld'],
    ['Carrier', call.carrier ? `${call.carrier}${call.carrier_call_id ? ` · ${call.carrier_call_id.slice(0, 18)}…` : ''}` : '–'],
    ['Brain', call.brain || '–'],
    ['AI cost', usd(call.cost_usd, 4)],
    ['First words (avg)', avgFirst == null ? '–' : `${avgFirst.toFixed(1)}s over ${firstWords.length} replies`],
    ['Mode', call.test_mode ? 'Test (not sent to the inbox)' : 'Live'],
  ];

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <Link href="/dashboard/phone/calls" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-plum-700">
        <ArrowLeft className="h-3 w-3" /> All calls
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-plum-950">
            {callerLabel(call)}
            <OutcomePill outcome={call.outcome} />
            {call.test_mode && <TestPill />}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {callerTypeLabel(call.caller_type)} · {callTime(call.started_at)} · {duration(call.duration_secs)}
          </p>
        </div>
        {reach && (
          <a href={`tel:${reach.replace(/[^\d+]/g, '')}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-plum-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-plum-800">
            <Phone className="h-4 w-4" /> Call {reach}
          </a>
        )}
      </div>

      {call.emergency_flagged && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-900">
            The caller mentioned a possible emergency and was told to hang up and call 911.
            Check on them when you call back.
          </p>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHead title="Summary" sub="What the office needs for the callback" icon={FileText} />
            <div className="p-5">
              {call.summary
                ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{call.summary}</p>
                : <Empty>No summary was written for this call.</Empty>}
            </div>
          </Card>

          <Card>
            <CardHead title="Details taken" sub="Everything the assistant recorded" icon={ClipboardList} />
            {known.length + extra.length === 0 ? (
              <div className="p-5"><Empty>Nothing was captured.</Empty></div>
            ) : (
              <dl className="divide-y divide-slate-100 text-sm">
                {[...known, ...extra].map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-5 py-2.5 sm:grid-cols-3 sm:gap-3">
                    <dt className="text-slate-500 first-letter:uppercase">{k}</dt>
                    <dd className="font-medium text-plum-950 sm:col-span-2">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <Card>
            <CardHead
              title="Transcript"
              sub="As the assistant heard it. Speech recognition can mishear names and numbers."
              icon={MessagesSquare}
            />
            {transcript.length === 0 ? (
              <div className="p-5">
                <Empty>
                  {call.transcript === null
                    ? 'No transcript. It is removed after the retention period set in Settings.'
                    : 'Nothing was said.'}
                </Empty>
              </div>
            ) : (
              <ol className="space-y-3 p-5">
                {transcript.map((m, i) => {
                  const caller = m.role === 'user';
                  return (
                    <li key={i} className={`flex ${caller ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] sm:max-w-[75%]`}>
                        <p className={`mb-1 text-[11px] font-semibold ${caller ? 'text-slate-500' : 'text-right text-teal-700'}`}>
                          {caller ? 'Caller' : 'Assistant'}
                          {m.t != null && <span className="font-normal text-slate-400"> · {clock(call.started_at, m.t)}</span>}
                        </p>
                        <p className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          caller
                            ? 'rounded-tl-sm bg-slate-100 text-slate-800'
                            : 'rounded-tr-sm bg-plum-700 text-white'
                        }`}>
                          {m.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHead title="Inbox lead" sub="Where the office follows this call up" icon={Inbox} />
            <div className="p-5">
              {inquiry ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-plum-950">
                    {inquiry.name}
                    <Pill tone={INQUIRY_TONE[inquiry.status] ?? ''}>{inquiryStageLabel(inquiry.status)}</Pill>
                  </p>
                  <p className="text-xs text-slate-500">
                    Created {ago(inquiry.created_at)}
                    {inquiry.handled_at ? ` · first handled ${ago(inquiry.handled_at)}` : ' · not handled yet'}
                  </p>
                  <Link href={inquiryHref(inquiry.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-plum-700">
                    Open it in the inbox →
                  </Link>
                </div>
              ) : call.inquiry_id ? (
                <Notice>This call has a lead, but your role cannot open it.</Notice>
              ) : (
                <p className="text-sm text-slate-600">
                  {call.test_mode
                    ? 'None: the assistant was in test mode, so this call was only logged here.'
                    : 'None: the call did not give a name and a number for a family or job seeker.'}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Call facts" icon={Info} />
            <dl className="divide-y divide-slate-100 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 px-5 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-plum-950">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </section>
    </div>
  );
}
