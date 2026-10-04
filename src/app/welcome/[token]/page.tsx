import Image from 'next/image';
import { notFound } from 'next/navigation';
import { anonClient } from '@/lib/supabase/anon';
import { Phone, MessageCircle, Building2, User, CalendarDays, ShieldCheck, FileText } from 'lucide-react';
import { site } from '@/lib/site';

// No account, so nothing here may be cached or indexed.
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Your onboarding pack',
  robots: { index: false, follow: false, nocache: true },
};

type Doc = { title: string; description: string | null; path: string; mime: string | null; size: number | null };
type Step = { position: number; title: string; body: string | null; owner_side: string; documents: Doc[] };
type Pack = {
  workflow: { name: string; summary: string | null; kind: string };
  first_name: string;
  job_title: string | null;
  start_date: string | null;
  due_on: string | null;
  steps: Step[];
};

export default async function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A plain anonymous client. The token is the only credential, and the
  // function it calls is the only thing it can reach.
  const supabase = anonClient();
  if (!supabase || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) notFound();

  const { data } = await supabase.rpc('onboarding_pack', { p_token: token });
  const pack = data as Pack | null;

  // Expired, revoked, not sent yet, or simply wrong. All the same answer.
  if (!pack) notFound();

  const dateFmt = (d: string | null) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;

  return (
    <main className="min-h-dvh bg-mist-100">
      <header className="bg-brand">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="flex items-center gap-3">
            <Image src={site.logoWhite} alt="" width={800} height={245} className="h-10 w-auto" />
            <span className="leading-tight">
              <span className="block text-sm font-bold text-white sm:text-base">{site.legalName}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                {site.tagline}
              </span>
            </span>
          </div>

          <h1 className="mt-8 text-3xl font-display font-bold leading-tight text-white sm:text-4xl">
            Welcome, {pack.first_name}.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-gray-200 sm:text-lg">
            {pack.workflow.summary ??
              'Here is everything you need before your first day. Work through it at your own pace.'}
          </p>

          <dl className="mt-7 grid gap-3 sm:grid-cols-3">
            {pack.job_title && (
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">Your role</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">{pack.job_title}</dd>
              </div>
            )}
            {pack.start_date && (
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">You start</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">{dateFmt(pack.start_date)}</dd>
              </div>
            )}
            {pack.due_on && (
              <div className="rounded-lg bg-white/10 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal-300">Finish this by</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">{dateFmt(pack.due_on)}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-sky-700" />
          <p className="text-sm leading-relaxed text-sky-900">
            There is nothing to sign up for. Keep this link private, it is yours.
          </p>
        </div>

        <h2 className="mt-10 text-xl font-bold text-plum-950 sm:text-2xl">
          {pack.workflow.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {pack.steps.length} steps. Take them in order where you can.
        </p>

        <ol className="mt-6 space-y-4">
          {pack.steps.map((step) => (
            <li
              key={step.position}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-plum-700 text-sm font-bold text-white">
                  {step.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-plum-950 sm:text-lg">{step.title}</h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                        step.owner_side === 'office'
                          ? 'bg-violet-50 text-violet-800 ring-violet-200'
                          : 'bg-teal-500/20 text-plum-700 ring-teal-500/40'
                      }`}
                    >
                      {step.owner_side === 'office'
                        ? <><Building2 className="h-3 w-3" /> we do this</>
                        : <><User className="h-3 w-3" /> you do this</>}
                    </span>
                  </div>

                  {step.body && (
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {step.body}
                    </p>
                  )}

                  {step.documents.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {step.documents.map((d) => (
                        <li key={d.path} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <FileText className="h-4 w-4 shrink-0 text-plum-700" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-plum-950">{d.title}</span>
                            <span className="block text-xs text-slate-500">
                              {d.description ? `${d.description} · ` : ''}The office will send you this document.
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold text-plum-950">Stuck on anything?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Call the office and someone will walk you through it. Office hours:{' '}
            {site.hours.map((h) => `${h.days} ${h.time}`).join(' · ')}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={site.phoneHref}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-bold text-plum-950 hover:bg-teal-400"
            >
              <Phone className="h-4 w-4" /> {site.phone}
            </a>
            <a
              href={site.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4 text-teal-700" /> WhatsApp us
            </a>
          </div>
        </section>

        <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This page is only for you and it stops working once onboarding is finished. Please do not
          send health or medical information through it.
        </p>
      </div>
    </main>
  );
}
