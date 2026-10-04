import { Phone, Mail, Inbox, CalendarCheck, HeartHandshake, AlertTriangle } from 'lucide-react';
import { INQUIRY_STAGES, CLOSED_INQUIRY_STAGES, isStale, STALE_HOURS } from '@/lib/pipeline';
import type { InquiryCard } from '@/lib/crm-types';
import { ago } from '@/components/crm/ui';
import StageMover from './StageMover';

function Stat({ icon: Icon, value, label, alert = false }: { icon: typeof Inbox; value: number; label: string; alert?: boolean }) {
  const on = alert && value > 0;
  return (
    <div className={`rounded-xl border p-4 ${on ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${on ? 'text-red-600' : 'text-teal-700'}`} />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${on ? 'text-red-700' : 'text-plum-950'}`}>{value}</p>
    </div>
  );
}

/**
 * Family care inquiries as a pipeline. Contact details and the service they
 * asked about only: nothing clinical belongs on these cards.
 */
export default function InquiryBoard({ cards, canWrite = false }: { cards: InquiryCard[]; canWrite?: boolean }) {
  const open = cards.filter((c) => !CLOSED_INQUIRY_STAGES.includes(c.stage));
  const untouched = cards.filter((c) => c.stage === 'new' && isStale(null, c.createdAt));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:px-8 lg:grid-cols-4">
        <Stat icon={Inbox} value={open.length} label="Open inquiries" />
        <Stat icon={CalendarCheck} value={cards.filter((c) => c.stage === 'assessment_scheduled').length} label="Assessments scheduled" />
        <Stat icon={HeartHandshake} value={cards.filter((c) => c.stage === 'client_started').length} label="Clients started" />
        <Stat icon={AlertTriangle} value={untouched.length} label={`New, no contact in ${STALE_HOURS}h`} alert />
      </div>
      <div className="flex gap-4 overflow-x-auto px-5 pb-8 sm:px-8">
        {INQUIRY_STAGES.map((stage) => {
          const col = cards.filter((c) => c.stage === stage.key);
          return (
            <section key={stage.key} className="w-[85vw] shrink-0 sm:w-72">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-plum-950">{stage.label}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{col.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{stage.hint}</p>
              <div className="mt-3 space-y-3">
                {col.map((c) => (
                  <article key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight text-plum-950">{c.name}</h3>
                      <span className="shrink-0 text-[11px] text-slate-400">{ago(c.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-plum-50 px-1.5 py-0.5 font-medium text-plum-800">{c.service ?? 'Not sure yet'}</span>
                      {c.mine && <span className="rounded bg-teal-500/20 px-1.5 py-0.5 font-bold text-plum-800">mine</span>}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 rounded bg-plum-700 px-2.5 py-1.5 text-xs font-medium text-white">
                          <Phone className="h-3 w-3" /> Call
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                          <Mail className="h-3 w-3" /> Email
                        </a>
                      )}
                    </div>
                    {canWrite && <StageMover kind="inquiry" id={c.id} stage={c.stage} stages={INQUIRY_STAGES} name={c.name} />}
                  </article>
                ))}
                {col.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Nothing here</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
