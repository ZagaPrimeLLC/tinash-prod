import Link from 'next/link';
import {
  PhoneCall, CalendarDays, CalendarRange, AlertTriangle, PhoneMissed, CheckCircle2, CircleDashed,
  UserCheck, Timer, DollarSign, Activity, ArrowRight, PhoneForwarded, Power, FlaskConical,
} from 'lucide-react';
import { Card, CardHead, Stat, Pill, Empty, ago } from '@/components/crm/ui';
import { CallRow, DeviceRow, PhoneLoadError, type CallListItem } from '@/components/crm/PhoneParts';
import { getSession } from '@/lib/crm/session';
import {
  CALL_LIST_COLUMNS, DEVICE_COLUMNS, CALLBACK_OUTCOMES, MISSED_OUTCOMES,
  njStart, duration, usd, deviceHealthy, type PhoneDevice, type PhoneSettings,
} from '@/lib/crm/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phone Assistant' };

type Light = {
  started_at: string; outcome: string; caller_type: string | null;
  duration_secs: number | null; cost_usd: number | null; emergency_flagged: boolean;
};

export default async function PhoneOverviewPage() {
  const { supabase } = await getSession();

  // Server component, rendered per request: one clock reading for the whole page.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const today = njStart(now, 'day');
  const month = njStart(now, 'month');
  const since30 = now - 30 * 864e5;
  const since7 = now - 7 * 864e5;
  const from = new Date(Math.min(month, since30)).toISOString();

  const [settingsRes, devicesRes, statsRes, recentRes, callbackRes] = await Promise.all([
    supabase.from('phone_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('phone_devices').select(DEVICE_COLUMNS).is('revoked_at', null).order('created_at'),
    supabase.from('phone_calls')
      .select('started_at, outcome, caller_type, duration_secs, cost_usd, emergency_flagged')
      .gte('started_at', from).order('started_at', { ascending: false }).limit(5000),
    supabase.from('phone_calls').select(CALL_LIST_COLUMNS).order('started_at', { ascending: false }).limit(8),
    supabase.from('phone_calls').select('id, inquiries!inner(status)', { count: 'exact', head: true })
      .in('outcome', CALLBACK_OUTCOMES as string[]).eq('inquiries.status', 'new'),
  ]);

  const failed = settingsRes.error ?? statsRes.error;
  if (failed) {
    return <div className="p-5 sm:p-8"><PhoneLoadError message={failed.message} /></div>;
  }

  const settings = settingsRes.data as PhoneSettings | null;
  const devices = (devicesRes.data ?? []) as unknown as PhoneDevice[];
  const all = (statsRes.data ?? []) as Light[];
  const recent = (recentRes.data ?? []) as unknown as CallListItem[];

  const at = (c: Light) => new Date(c.started_at).getTime();
  const last30 = all.filter((c) => at(c) >= since30);
  const count = (pred: (c: Light) => boolean) => last30.filter(pred).length;
  const timed = last30.filter((c) => c.duration_secs != null);
  const avgSecs = timed.length ? timed.reduce((s, c) => s + Number(c.duration_secs), 0) / timed.length : null;
  const monthCost = all.filter((c) => at(c) >= month).reduce((s, c) => s + Number(c.cost_usd ?? 0), 0);
  const healthy = devices.some((d) => deviceHealthy(d, now));
  const lastSeen = devices.map((d) => d.last_seen_at).filter((v): v is string => !!v).sort().pop() ?? null;

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat icon={PhoneCall}     label="Calls today"    value={all.filter((c) => at(c) >= today).length} sub="since midnight, NJ time" href="/dashboard/phone/calls" />
        <Stat icon={CalendarDays}  label="Last 7 days"    value={all.filter((c) => at(c) >= since7).length} sub="every call answered" href="/dashboard/phone/calls" />
        <Stat icon={CalendarRange} label="Last 30 days"   value={last30.length} sub="every call answered" href="/dashboard/phone/calls" />
        <Stat icon={PhoneForwarded} label="Needs callback" value={callbackRes.count ?? 0} sub="lead still new in the inbox" tone="alert" href="/dashboard/phone/calls?view=callback" />
        <Stat icon={AlertTriangle} label="Emergencies"    value={count((c) => c.outcome === 'emergency' || c.emergency_flagged)} sub="told to call 911, last 30 days" tone="alert" href="/dashboard/phone/calls?outcome=emergency" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat icon={CheckCircle2} label="Completed"   value={count((c) => c.outcome === 'completed')} sub="last 30 days" href="/dashboard/phone/calls?outcome=completed" />
        <Stat icon={CircleDashed} label="Partial"     value={count((c) => c.outcome === 'partial')} sub="last 30 days" href="/dashboard/phone/calls?outcome=partial" />
        <Stat icon={PhoneMissed}  label="Missed"      value={count((c) => (MISSED_OUTCOMES as string[]).includes(c.outcome))} sub="abandoned or failed, 30 days" href="/dashboard/phone/calls?view=missed" />
        <Stat icon={UserCheck}    label="Job seekers" value={count((c) => c.caller_type === 'job_seeker')} sub="last 30 days" href="/dashboard/phone/calls?type=job_seeker" />
        <Stat icon={Timer}        label="Avg length"  value={duration(avgSecs)} sub="minutes:seconds, 30 days" />
        <Stat icon={DollarSign}   label="Cost this month" value={usd(monthCost)} sub="estimated AI usage" />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Recent calls"
            sub="The latest calls the assistant answered"
            icon={PhoneCall}
            action={
              <Link href="/dashboard/phone/calls" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-plum-700">
                All calls <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <div className="p-5"><Empty>No calls logged yet.</Empty></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((c) => <CallRow key={c.id} call={c} />)}
            </ul>
          )}
        </Card>

        <Card className="self-start">
          <CardHead
            title="Assistant status"
            sub={lastSeen ? `Last heard from ${ago(lastSeen)}` : 'No device has checked in yet'}
            icon={Activity}
            action={
              devices.length > 0 ? (
                healthy
                  ? <Pill tone="bg-emerald-100 text-emerald-800 ring-emerald-200">healthy</Pill>
                  : <Pill tone="bg-red-100 text-red-800 ring-red-200">offline</Pill>
              ) : undefined
            }
          />
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="flex items-center gap-2 text-slate-600"><Power className="h-4 w-4 text-teal-700" /> Answering calls</dt>
              <dd>
                {settings?.enabled
                  ? <Pill tone="bg-emerald-100 text-emerald-800 ring-emerald-200">on</Pill>
                  : <Pill tone="bg-amber-100 text-amber-900 ring-amber-200">off</Pill>}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <dt className="flex items-center gap-2 text-slate-600"><FlaskConical className="h-4 w-4 text-teal-700" /> Test mode</dt>
              <dd>
                {settings?.test_mode
                  ? <Pill tone="bg-violet-50 text-violet-800 ring-violet-200">on: calls are not sent to the inbox</Pill>
                  : <Pill tone="bg-emerald-100 text-emerald-800 ring-emerald-200">off: live</Pill>}
              </dd>
            </div>
          </dl>
          {devices.length === 0 ? (
            <div className="border-t border-slate-100 p-5">
              <Empty>No device is registered. See the Setup tab.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {devices.map((d) => <DeviceRow key={d.id} device={d} now={now} />)}
            </ul>
          )}
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            A device that has not checked in for three minutes shows as offline. While it is
            offline, forwarded calls are not answered by the assistant, so check the Pi (power,
            internet, the service) straight away.
          </p>
        </Card>
      </section>
    </div>
  );
}
