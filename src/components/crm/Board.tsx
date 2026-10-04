import { STAGES, CLOSED_STAGES, isStale } from '@/lib/pipeline';
import type { BoardCard } from '@/lib/crm-types';
import ApplicantCard from './ApplicantCard';
import { Users, AlertTriangle, CalendarCheck, UserCheck } from 'lucide-react';

function Stat({ icon: Icon, value, label, tone }: {
  icon: typeof Users; value: number; label: string; tone?: 'alert';
}) {
  const alert = tone === 'alert' && value > 0;
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${alert ? 'text-red-600' : 'text-teal-700'}`} />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${alert ? 'text-red-700' : 'text-plum-950'}`}>{value}</p>
    </div>
  );
}

/** The caregiver applicant pipeline. */
export default function Board({ cards, canWrite = false }: { cards: BoardCard[]; canWrite?: boolean }) {
  const live = cards.filter((c) => !CLOSED_STAGES.includes(c.stage));
  const stale = live.filter((c) => isStale(c.lastContactAt, c.createdAt));
  const interviews = cards.filter((c) => c.stage === 'interview');
  const checks = cards.filter((c) => c.stage === 'checks');

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:px-8 lg:grid-cols-4">
        <Stat icon={Users} value={live.length} label="In pipeline" />
        <Stat icon={CalendarCheck} value={interviews.length} label="Interviews set" />
        <Stat icon={UserCheck} value={checks.length} label="In checks & paperwork" />
        <Stat icon={AlertTriangle} value={stale.length} label="Stale over 48h" tone="alert" />
      </div>

      <div className="flex gap-4 overflow-x-auto px-5 pb-8 sm:px-8">
        {STAGES.map((stage) => {
          const col = cards.filter((c) => c.stage === stage.key);
          return (
            <section key={stage.key} className="w-[85vw] shrink-0 sm:w-72">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-plum-950">{stage.label}</h2>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{col.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{stage.hint}</p>

              <div className="mt-3 space-y-3">
                {col.map((c) => <ApplicantCard key={c.id} card={c} canWrite={canWrite} />)}
                {col.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                    Nothing here
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
