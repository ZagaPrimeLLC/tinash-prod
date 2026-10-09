/**
 * The phone assistant (receptionist/ in this repo) as the CRM sees it.
 * Keep the outcome keys, voices and limits in sync with
 * supabase/migrations/20261009000000_phone_assistant.sql.
 */

export type PhoneCall = {
  id: string;
  carrier: string | null;
  carrier_call_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  caller_number: string | null;
  outcome: Outcome;
  end_reason: string | null;
  caller_type: 'family' | 'job_seeker' | 'other' | null;
  caller_name: string | null;
  callback_number: string | null;
  service: string | null;
  town: string | null;
  county: string | null;
  urgency: string | null;
  best_callback_time: string | null;
  emergency_flagged: boolean;
  summary: string | null;
  intake: Record<string, unknown> | null;
  transcript: TranscriptLine[] | null;
  inquiry_id: string | null;
  test_mode: boolean;
  brain: string | null;
  cost_usd: number | null;
  latency: Record<string, unknown> | null;
  created_at: string;
};

export type TranscriptLine = { role: 'user' | 'assistant'; text: string; t?: number };

export type PhoneSettings = {
  enabled: boolean;
  test_mode: boolean;
  voice_engine: 'kokoro' | 'piper';
  voice: string;
  voice_speed: number;
  greeting: string | null;
  farewell: string | null;
  custom_instructions: string | null;
  extra_facts: string | null;
  transcript_retention_days: number;
  updated_at: string;
  updated_by: string | null;
};

export type PhoneDevice = {
  id: string;
  name: string;
  last_seen_at: string | null;
  status: Record<string, unknown> | null;
  revoked_at: string | null;
  created_at: string;
};

/** Columns for lists (no transcript or intake, which can be large). */
export const CALL_LIST_COLUMNS =
  'id, started_at, duration_secs, caller_number, outcome, end_reason, caller_type, caller_name, ' +
  'callback_number, service, town, emergency_flagged, inquiry_id, test_mode, cost_usd';

export const DEVICE_COLUMNS = 'id, name, last_seen_at, status, revoked_at, created_at';

export const OUTCOMES = [
  { key: 'completed', label: 'Completed', hint: 'name, number and what they need',  tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  { key: 'partial',   label: 'Partial',   hint: 'some details, not all',            tone: 'bg-amber-100 text-amber-900 ring-amber-200' },
  { key: 'abandoned', label: 'Abandoned', hint: 'hung up with nothing useful',      tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { key: 'failed',    label: 'Failed',    hint: 'the assistant hit an error',       tone: 'bg-rose-100 text-rose-800 ring-rose-200' },
  { key: 'emergency', label: 'Emergency', hint: 'told to call 911',                 tone: 'bg-red-100 text-red-800 ring-red-200' },
] as const;

export type Outcome = (typeof OUTCOMES)[number]['key'];
export const OUTCOME_KEYS = OUTCOMES.map((o) => o.key) as readonly string[];
/** "Missed": the caller did not get through to a useful conversation. */
export const MISSED_OUTCOMES: readonly Outcome[] = ['abandoned', 'failed'];
/** Calls that should lead to a callback when their inbox lead is still new. */
export const CALLBACK_OUTCOMES: readonly Outcome[] = ['completed', 'partial', 'emergency'];

export function outcomeMeta(key: string) {
  return OUTCOMES.find((o) => o.key === key) ?? OUTCOMES[1];
}

export const CALLER_TYPES = [
  { key: 'family',     label: 'Family' },
  { key: 'job_seeker', label: 'Job seeker' },
  { key: 'other',      label: 'Other' },
] as const;

export function callerTypeLabel(key: string | null): string {
  return CALLER_TYPES.find((c) => c.key === key)?.label ?? 'Unknown';
}

/** The voices installed on the device, with a phone-quality sample in public/phone-voices. */
export const VOICES = [
  { engine: 'kokoro', key: 'af_sarah',   label: 'Sarah',   note: 'Natural voice. The default.',     sample: '/phone-voices/sarah.wav' },
  { engine: 'kokoro', key: 'af_heart',   label: 'Heart',   note: 'Natural voice.',                  sample: '/phone-voices/heart.wav' },
  { engine: 'kokoro', key: 'af_bella',   label: 'Bella',   note: 'Natural voice.',                  sample: '/phone-voices/bella.wav' },
  { engine: 'kokoro', key: 'af_nicole',  label: 'Nicole',  note: 'Natural voice.',                  sample: '/phone-voices/nicole.wav' },
  { engine: 'kokoro', key: 'am_michael', label: 'Michael', note: 'Natural voice, male.',            sample: '/phone-voices/michael.wav' },
  { engine: 'piper',  key: 'en_US-amy-medium',        label: 'Amy (light)',    note: 'Lighter on the Pi; answers faster.', sample: '/phone-voices/amy.wav' },
  { engine: 'piper',  key: 'en_US-lessac-high',       label: 'Lessac (light)', note: 'Lighter on the Pi; answers faster.', sample: '/phone-voices/lessac.wav' },
  { engine: 'piper',  key: 'en_US-hfc_female-medium', label: 'HFC (light)',    note: 'Lighter on the Pi; answers faster.', sample: '/phone-voices/hfc-female.wav' },
] as const;

export function voiceMeta(key: string) {
  return VOICES.find((v) => v.key === key);
}

export const LIMITS = {
  greeting: 400,
  farewell: 300,
  custom_instructions: 4000,
  extra_facts: 6000,
  speedMin: 0.8,
  speedMax: 1.2,
  retentionMin: 1,
  retentionMax: 365,
};

/** No heartbeat for this long and the device counts as offline. */
export const OFFLINE_AFTER_MS = 3 * 60 * 1000;

export function deviceHealthy(d: Pick<PhoneDevice, 'last_seen_at' | 'revoked_at'>, now: number): boolean {
  return !d.revoked_at && !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < OFFLINE_AFTER_MS;
}

/** 0:42, 3:05, 1:02:10 */
export function duration(secs: number | null | undefined): string {
  if (secs == null || !Number.isFinite(Number(secs))) return '–';
  const s = Math.round(Number(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function usd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  return `$${Number(n).toFixed(digits)}`;
}

export function callTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The office runs on New Jersey time; the worker runs on UTC. */
export const TZ = 'America/New_York';

/**
 * Midnight in New Jersey on the day (or the first of the month) containing
 * `now`, as a UTC timestamp. Good to the minute except across the 2 AM DST
 * switch, which no call log needs.
 */
export function njStart(now: number, unit: 'day' | 'month'): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = unit === 'month' ? 1 : Number(parts.day);
  const asUtc = Date.UTC(y, m - 1, d);
  return asUtc - offsetMs(asUtc);
}

/** New Jersey wall-clock time minus UTC at the given instant (negative: -4h or -5h). */
function offsetMs(at: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(at)).map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return wall - at;
}

/** A day picked in a date input (YYYY-MM-DD) as the UTC instant of New Jersey midnight. */
export function njDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return asUtc - offsetMs(asUtc);
}

/** Where a linked inquiry lives in the CRM. */
export function inquiryHref(id: string): string {
  return `/dashboard/inbox#inq-${id}`;
}
