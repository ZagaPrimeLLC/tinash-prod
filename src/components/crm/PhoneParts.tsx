import Link from 'next/link';
import { AlertTriangle, ChevronRight, FlaskConical, Inbox, Wifi, WifiOff } from 'lucide-react';
import { Pill, Notice, ago } from '@/components/crm/ui';
import {
  outcomeMeta, callerTypeLabel, duration, callTime, deviceHealthy,
  type PhoneCall, type PhoneDevice,
} from '@/lib/crm/phone';

export type CallListItem = Pick<PhoneCall,
  'id' | 'started_at' | 'duration_secs' | 'caller_number' | 'outcome' | 'end_reason' | 'caller_type' |
  'caller_name' | 'callback_number' | 'service' | 'town' | 'emergency_flagged' | 'inquiry_id' |
  'test_mode' | 'cost_usd'>;

export function OutcomePill({ outcome }: { outcome: string }) {
  const o = outcomeMeta(outcome);
  return <Pill tone={o.tone}>{o.label}</Pill>;
}

export function TestPill() {
  return (
    <Pill tone="bg-violet-50 text-violet-800 ring-violet-200">
      <FlaskConical className="h-3 w-3" /> test
    </Pill>
  );
}

/** Who called, in the words the office would use. */
export function callerLabel(c: Pick<PhoneCall, 'caller_name' | 'callback_number' | 'caller_number'>): string {
  return c.caller_name || c.callback_number || c.caller_number || 'Unknown caller';
}

/** One call in a list: who, what, when, and how it ended. */
export function CallRow({ call }: { call: CallListItem }) {
  const what = [call.caller_type ? callerTypeLabel(call.caller_type) : null, call.service, call.town]
    .filter(Boolean).join(' · ');
  return (
    <li>
      <Link
        href={`/dashboard/phone/calls/${call.id}`}
        className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-plum-950">{callerLabel(call)}</span>
            <OutcomePill outcome={call.outcome} />
            {call.emergency_flagged && call.outcome !== 'emergency' && (
              <Pill tone="bg-red-100 text-red-800 ring-red-200"><AlertTriangle className="h-3 w-3" /> 911 told</Pill>
            )}
            {call.test_mode && <TestPill />}
            {call.inquiry_id && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <Inbox className="h-3 w-3" /> in the inbox
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-xs text-slate-500">
            {what || call.end_reason || 'No details captured'}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-slate-400">
          <span className="block">{callTime(call.started_at)}</span>
          <span className="block tabular-nums">{duration(call.duration_secs)}</span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
      </Link>
    </li>
  );
}

/** Healthy when the device checked in within the last three minutes. */
export function DeviceBadge({ device, now }: { device: PhoneDevice; now: number }) {
  if (device.revoked_at) return <Pill>revoked</Pill>;
  return deviceHealthy(device, now) ? (
    <Pill tone="bg-emerald-100 text-emerald-800 ring-emerald-200"><Wifi className="h-3 w-3" /> healthy</Pill>
  ) : (
    <Pill tone="bg-red-100 text-red-800 ring-red-200"><WifiOff className="h-3 w-3" /> offline</Pill>
  );
}

export function DeviceRow({ device, now }: { device: PhoneDevice; now: number }) {
  const s = (device.status ?? {}) as Record<string, unknown>;
  const facts = [
    typeof s.version === 'string' ? `v${s.version}` : null,
    typeof s.brain === 'string' ? s.brain : null,
    typeof s.voice === 'string' ? `voice ${s.voice}` : null,
    typeof s.active_calls === 'number' ? `${s.active_calls} on a call now` : null,
    typeof s.health === 'string' && s.health !== 'ok' ? `health: ${s.health}` : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-plum-950">{device.name}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Last seen {ago(device.last_seen_at)}{facts.length ? ` · ${facts.join(' · ')}` : ''}
        </span>
      </span>
      <DeviceBadge device={device} now={now} />
    </li>
  );
}

/** Shown when the migration has not been applied yet, or the database refused. */
export function PhoneLoadError({ message }: { message: string }) {
  const missing = /does not exist|schema cache|Could not find/i.test(message);
  return (
    <Notice tone="warn">
      {missing
        ? 'The Phone Assistant tables are not in the database yet. Apply the phone assistant migration (supabase/migrations/20261009000000_phone_assistant.sql), then reload.'
        : `Could not load the Phone Assistant: ${message}`}
    </Notice>
  );
}
