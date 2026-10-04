'use client';

import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { setApplicationStage } from '@/app/(dashboard)/dashboard/recruitment/actions';
import { setInquiryStatus } from '@/app/(dashboard)/dashboard/inbox/actions';

type Stage = { key: string; label: string };

/** Previous / next column buttons for a pipeline card. Admin and ops only. */
export default function StageMover({
  kind, id, stage, stages, name,
}: { kind: 'application' | 'inquiry'; id: string; stage: string; stages: readonly Stage[]; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const i = stages.findIndex((s) => s.key === stage);

  function go(dir: -1 | 1) {
    const next = stages[i + dir];
    if (!next) return;
    setError(null);
    start(async () => {
      const r = kind === 'application' ? await setApplicationStage(id, next.key) : await setInquiryStatus(id, next.key);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => go(-1)} disabled={pending || i <= 0}
          aria-label={`Move ${name} back to ${stages[i - 1]?.label ?? 'previous stage'}`}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plum-700 disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => go(1)} disabled={pending || i < 0 || i >= stages.length - 1}
          aria-label={`Move ${name} on to ${stages[i + 1]?.label ?? 'next stage'}`}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plum-700 disabled:opacity-30">
          <ChevronRight className="h-4 w-4" />
        </button>
        {pending && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-teal-700" />}
        {i >= 0 && i < stages.length - 1 && (
          <span className="ml-auto text-[10px] text-slate-400">next: {stages[i + 1].label}</span>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
