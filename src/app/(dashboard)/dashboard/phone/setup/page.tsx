import { ArrowDown, Cable, Cpu, ExternalLink, PhoneForwarded } from 'lucide-react';
import { Card, CardHead, Empty, Notice } from '@/components/crm/ui';
import { DeviceRow, PhoneLoadError } from '@/components/crm/PhoneParts';
import { getSession } from '@/lib/crm/session';
import { DEVICE_COLUMNS, type PhoneDevice } from '@/lib/crm/phone';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Phone Assistant setup' };

const README = 'https://github.com/ZagaPrimeLLC/tinash-prod/blob/main/receptionist/README.md';

const PATH = [
  { title: 'Tinash office line', detail: '(973) 636-8328 rings the office phones as usual.' },
  { title: 'T-Mobile call forwarding', detail: 'When nobody answers, the line is busy, or the phone is off, T-Mobile forwards the call.' },
  { title: 'Telnyx number +1 (862) 278-8891', detail: 'Our phone carrier receives the forwarded call and hands it to the assistant over the internet.' },
  { title: 'Phone Assistant', detail: 'The Raspberry Pi in the office answers, takes the details, and logs the call here.' },
];

const CODES = [
  { code: '**61*18622788891#', what: 'Forward when nobody answers' },
  { code: '**67*18622788891#', what: 'Forward when the line is busy' },
  { code: '**62*18622788891#', what: 'Forward when the phone is off or has no signal' },
  { code: '*#61#',             what: 'Check where unanswered calls go now' },
  { code: '##61#',             what: 'Stop forwarding unanswered calls' },
  { code: '##67#',             what: 'Stop forwarding busy calls' },
  { code: '##62#',             what: 'Stop forwarding when unreachable' },
];

export default async function PhoneSetupPage() {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from('phone_devices').select(DEVICE_COLUMNS).order('created_at');
  // Server component, rendered per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const devices = (data ?? []) as unknown as PhoneDevice[];

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHead title="How a call reaches the assistant" sub="Nothing changes for callers: they dial the usual number" icon={Cable} />
          <ol className="p-5">
            {PATH.map((step, i) => (
              <li key={step.title}>
                <div className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-plum-700 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-plum-950">{step.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{step.detail}</span>
                  </span>
                </div>
                {i < PATH.length - 1 && <ArrowDown className="my-1.5 ml-1.5 h-4 w-4 text-teal-600" />}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHead title="T-Mobile forwarding codes" sub="Dial each one on the office phone (the T-Mobile line), like a phone number" icon={PhoneForwarded} />
          <ul className="divide-y divide-slate-100">
            {CODES.map((c) => (
              <li key={c.code} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-sm text-slate-700">{c.what}</span>
                <code className="rounded-md bg-slate-50 px-2 py-1 font-mono text-sm font-semibold text-plum-950 ring-1 ring-slate-200">
                  {c.code}
                </code>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-600">
            <p>
              Set up all three forwards so the assistant catches every call the office cannot take. The
              phone shows a confirmation after each code.
            </p>
            <p>
              Codes can differ by plan and by business account. If one is refused, or forwarding does not
              behave as expected, call T-Mobile on <strong>611</strong> from the office line and ask them to
              set &quot;conditional call forwarding&quot; to 1-862-278-8891.
            </p>
          </div>
        </Card>
      </section>

      <Card>
        <CardHead title="Devices" sub="Machines allowed to answer calls and log them here" icon={Cpu} />
        {error ? (
          <div className="p-5"><PhoneLoadError message={error.message} /></div>
        ) : devices.length === 0 ? (
          <div className="p-5"><Empty>No device registered yet. The README explains how to add one.</Empty></div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {devices.map((d) => <DeviceRow key={d.id} device={d} now={now} />)}
          </ul>
        )}
        <div className="border-t border-slate-100 px-5 py-4">
          <Notice>
            Each device has its own secret token. Only a fingerprint of it is kept in the database, so
            a lost token cannot be shown again: make a new one and update the device. To retire a
            device, an administrator sets its revoked date in the database and it stops working at once.
          </Notice>
        </div>
      </Card>

      <Card>
        <CardHead title="Installing and running the assistant" icon={ExternalLink} />
        <div className="space-y-2 p-5 text-sm text-slate-700">
          <p>
            The receptionist runs on a Raspberry Pi as a background service. The README covers the
            install, the Telnyx number, the internet tunnel, testing with the dashboard in test mode, and
            what to check when calls stop being answered.
          </p>
          <a href={README} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-plum-700">
            Open the receptionist README <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>
    </div>
  );
}
