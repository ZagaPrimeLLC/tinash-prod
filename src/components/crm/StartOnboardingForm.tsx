'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { startOnboarding } from '@/app/(dashboard)/dashboard/onboarding/actions';

export default function StartOnboardingForm({
  workflows,
}: { workflows: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const field = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm';
  const label = 'block text-xs font-semibold text-slate-700';

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const r = await startOnboarding(fd);
          if (r.ok && r.id) router.push(`/dashboard/onboarding/${r.id}`);
          else if (!r.ok) setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="o-name" className={label}>Full name</label>
        <input id="o-name" name="full_name" required className={field} />
      </div>

      <div>
        <label htmlFor="o-title" className={label}>Job title</label>
        <input
          id="o-title"
          name="job_title"
          defaultValue="Caregiver"
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="o-email" className={label}>Email</label>
          <input id="o-email" name="email" type="email" autoComplete="off" className={field} />
        </div>
        <div>
          <label htmlFor="o-phone" className={label}>Mobile</label>
          <input id="o-phone" name="phone" type="tel" autoComplete="off" className={field} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        One of the two is enough. It is how the link reaches them.
      </p>

      <div>
        <label htmlFor="o-workflow" className={label}>Workflow</label>
        <select id="o-workflow" name="workflow_id" required className={field}>
          {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="o-start" className={label}>Start date</label>
          <input id="o-start" name="start_date" type="date" className={field} />
        </div>
        <div>
          <label htmlFor="o-due" className={label}>Pack due by</label>
          <input id="o-due" name="due_on" type="date" className={field} />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-plum-700 px-4 py-3 text-sm font-bold text-white hover:bg-plum-800 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Create the pack
      </button>
      <p className="text-center text-xs text-slate-500">
        The link stays switched off until you send it on the next screen.
      </p>
    </form>
  );
}
