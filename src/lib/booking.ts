import { site } from '@/lib/site';

// Free consultations are offered during the window configured in
// site.consultation (default weekdays 10am–4pm New York time — TODO(confirm)
// with the Tinash office). Slots are generated from that rule every time the
// page opens, always covering the next few weeks, so nothing needs updating
// when the month changes.
const C = site.consultation;
export const SLOT_MINUTES = C.slotMinutes;
export const CONSULT_DAYS: readonly number[] = C.days;
export const CONSULT_START = C.startMinutes; // minutes after midnight
export const CONSULT_END = C.endMinutes;     // the last consultation finishes by this time
export const WEEKS_AHEAD = C.weeksAhead;
export const MIN_NOTICE_HOURS = C.minNoticeHours;
export const OFFICE_TZ = C.timeZone;

/**
 * One-off closures, as YYYY-MM-DD (e.g. a staff training day). Public holidays
 * are worked out automatically below and do not need listing here.
 */
export const CLOSED_DATES: string[] = [];

export type Slot = { iso: string; time: string };
export type Day = { key: string; label: string; slots: Slot[] };

type Ymd = { y: number; m: number; d: number };

/** Public holidays the office is closed (TODO(confirm) Tinash's holiday list). */
function isHoliday({ y, m, d }: Ymd): boolean {
  if ((m === 1 && d === 1) || (m === 7 && d === 4) || (m === 12 && (d === 24 || d === 25 || d === 31))) return true;
  // Thanksgiving: fourth Thursday of November
  if (m === 11) {
    const firstDow = new Date(Date.UTC(y, 10, 1)).getUTCDay();
    const firstThu = 1 + ((4 - firstDow + 7) % 7);
    if (d === firstThu + 21) return true;
  }
  return false;
}

/** Today's calendar date in New York, whatever timezone the visitor is in. */
function officeToday(now: Date): Ymd {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: OFFICE_TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(now);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: n('year'), m: n('month'), d: n('day') };
}

/** The real instant of a New York wall-clock time (handles daylight saving). */
function officeInstant({ y, m, d }: Ymd, minutes: number): Date {
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  }).formatToParts(new Date(guess));
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asIfUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
  return new Date(guess - (asIfUtc - guess));
}

function ordinal(d: number): string {
  const s = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][d % 10] ?? 'th';
  return `${d}${s}`;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Tuesday 6th", with "This" / "Next" so nobody has to work out which week. */
export function dayLabel(date: Ymd, today: Ymd): string {
  const dow = new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
  const diff = Math.round((Date.UTC(date.y, date.m - 1, date.d) - Date.UTC(today.y, today.m - 1, today.d)) / 864e5);
  const todayDow = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();
  const base = `${WEEKDAY[dow]} ${ordinal(date.d)}`;
  if (diff === 1) return `Tomorrow, ${base}`;
  if (diff < 7 - todayDow) return `This ${base}`;
  if (diff < 14 - todayDow) return `Next ${base}`;
  return base;
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: OFFICE_TZ, hour: 'numeric', minute: '2-digit' });
}

export function availableDays(now: Date = new Date()): Day[] {
  const today = officeToday(now);
  const earliest = now.getTime() + MIN_NOTICE_HOURS * 3600_000;
  const days: Day[] = [];

  for (let i = 0; i < WEEKS_AHEAD * 7; i++) {
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const ymd = { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate() };
    const key = cal.toISOString().slice(0, 10);
    if (!CONSULT_DAYS.includes(cal.getUTCDay()) || isHoliday(ymd) || CLOSED_DATES.includes(key)) continue;

    const slots: Slot[] = [];
    for (let t = CONSULT_START; t + SLOT_MINUTES <= CONSULT_END; t += SLOT_MINUTES) {
      const at = officeInstant(ymd, t);
      if (at.getTime() < earliest) continue;
      slots.push({ iso: at.toISOString(), time: timeLabel(at.toISOString()) });
    }
    if (slots.length) days.push({ key, label: dayLabel(ymd, today), slots });
  }
  return days;
}
