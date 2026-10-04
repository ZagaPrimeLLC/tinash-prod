import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({
  title, sub, icon: Icon, action,
}: { title: string; sub?: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-bold text-plum-950">
          {Icon && <Icon className="h-4 w-4 text-teal-700" />}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label, value, sub, icon: Icon, tone = 'plain', href,
}: {
  label: string; value: number | string; sub?: string; icon: LucideIcon;
  tone?: 'plain' | 'alert' | 'good'; href?: string;
}) {
  const alert = tone === 'alert' && Number(value) > 0;
  const good = tone === 'good';
  const body = (
    <div
      className={`rounded-xl border px-5 py-4 transition ${
        alert
          ? 'border-red-200 bg-red-50'
          : good
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-white'
      } ${href ? 'hover:border-slate-300 hover:shadow-sm' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${alert ? 'text-red-600' : good ? 'text-emerald-600' : 'text-teal-700'}`} />
        <span className={`text-xs font-semibold ${alert ? 'text-red-900' : good ? 'text-emerald-900' : 'text-slate-600'}`}>
          {label}
        </span>
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${alert ? 'text-red-700' : good ? 'text-emerald-700' : 'text-plum-950'}`}>
        {value}
      </p>
      {sub && <p className={`mt-1 text-xs ${alert ? 'text-red-700' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Pill({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

export function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p
      role={tone === 'warn' ? 'alert' : undefined}
      className={`rounded-lg px-4 py-3 text-sm ${
        tone === 'warn' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'bg-sky-50 text-sky-900 ring-1 ring-sky-200'
      }`}
    >
      {children}
    </p>
  );
}

/** A relative time that reads the way people talk. */
export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dateLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
