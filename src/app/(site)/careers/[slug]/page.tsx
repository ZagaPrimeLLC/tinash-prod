import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, Briefcase, Check, Clock, DollarSign, ExternalLink, GraduationCap, MapPin, Phone, Share2,
} from 'lucide-react';
import JobApplyForm from '@/components/site/JobApplyForm';
import { JobDescription } from '@/lib/job-format';
import { getOpenJob, getOpenJobs } from '@/lib/public-jobs';
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, payLabel, postedLabel, type Job } from '@/lib/jobs';
import { site } from '@/lib/site';

// What every Tinash caregiver can expect (from the careers page copy).
const whatToExpect = [
  'Paid training and real supervision',
  'Clients matched to your skills and personality',
  'Flexible schedules that fit your life',
  'A team that answers when you call',
];

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getOpenJobs()).map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getOpenJob(slug);
  if (!job) return { title: 'Position closed', robots: { index: false } };
  const description =
    job.summary ?? `${job.title} with ${site.name}${job.location ? ` in ${job.location}` : ''}. Apply online in a couple of minutes.`;
  return {
    title: `${job.title}${job.location ? ` · ${job.location}` : ''}`,
    description,
    alternates: { canonical: `/careers/${job.slug}` },
    openGraph: { title: job.title, description, type: 'website', url: `/careers/${job.slug}` },
  };
}

const EMPLOYMENT_SCHEMA: Record<Job['employment_type'], string> = {
  full_time: 'FULL_TIME', part_time: 'PART_TIME', per_diem: 'PER_DIEM', contract: 'CONTRACTOR',
};
const UNIT: Record<Job['pay_interval'], string> = { hour: 'HOUR', week: 'WEEK', year: 'YEAR' };

/** Google for Jobs reads this. Location is free text, so pull out what we can. */
function jobPostingLd(job: Job) {
  const m = job.location?.match(/^(.*?),?\s*(NJ|New Jersey)\b\s*(\d{5})?/i);
  const town = (m?.[1] || job.location || '').replace(/^.*-\s*/, '').trim();
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: (job.description ?? job.summary ?? job.title).replace(/\*\*/g, '').replace(/^#+\s*/gm, ''),
    datePosted: job.posted_at ?? job.created_at,
    employmentType: EMPLOYMENT_SCHEMA[job.employment_type],
    directApply: true,
    identifier: job.requisition_id ? { '@type': 'PropertyValue', name: site.legalName, value: job.requisition_id } : undefined,
    hiringOrganization: { '@type': 'Organization', name: site.legalName, sameAs: site.url, logo: `${site.url}${site.logo}` },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: town || undefined,
        addressRegion: 'NJ',
        postalCode: m?.[3],
        addressCountry: 'US',
      },
    },
    ...(job.work_mode === 'remote' ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'State', name: 'New Jersey' } } : {}),
  };
  if (job.pay_min != null || job.pay_max != null) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: {
        '@type': 'QuantitativeValue',
        ...(job.pay_min != null && job.pay_max != null && job.pay_min !== job.pay_max
          ? { minValue: job.pay_min, maxValue: job.pay_max }
          : { value: job.pay_min ?? job.pay_max }),
        unitText: UNIT[job.pay_interval],
      },
    };
  }
  // "<" escaped so text typed into a job post can never close this script tag.
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getOpenJob(slug);
  if (!job) notFound();

  const pay = payLabel(job);
  const facts = [
    job.location && { icon: MapPin, label: 'Location', value: `${job.location}${job.work_mode !== 'onsite' ? ` · ${WORK_MODE_LABEL[job.work_mode]}` : ''}` },
    { icon: Briefcase, label: 'Job type', value: EMPLOYMENT_LABEL[job.employment_type] },
    pay && { icon: DollarSign, label: 'Pay', value: pay },
    job.experience && { icon: GraduationCap, label: 'Experience', value: job.experience },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string }[];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobPostingLd(job) }} />

      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-7xl px-6 pb-14 pt-36">
          <Link href="/careers#openings" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-teal-300">
            <ArrowLeft className="h-4 w-4" /> All open positions
          </Link>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-5xl">{job.title}</h1>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-white/90">
            {facts.slice(0, 3).map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-2"><Icon className="h-5 w-5 text-teal-300" /><span className="sr-only">{label}: </span>{value}</li>
            ))}
            {job.posted_at && <li className="flex items-center gap-2"><Clock className="h-5 w-5 text-teal-300" />{postedLabel(job.posted_at)}</li>}
          </ul>
          <a href="#apply" className="mt-7 inline-flex rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-lg lg:hidden">
            Apply now
          </a>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <article className="min-w-0">
            {job.summary && <p className="text-lg leading-relaxed text-plum-900 sm:text-xl">{job.summary}</p>}

            <dl className="mt-8 grid gap-4 glass rounded-2xl p-5 sm:grid-cols-2">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-plum-700/70">{label}</dt>
                    <dd className="font-semibold text-plum-950">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {job.description && (
              <div className="mt-10">
                <h2 className="font-display text-2xl font-semibold text-plum-950">About the role</h2>
                <div className="mt-4"><JobDescription text={job.description} /></div>
              </div>
            )}

            {job.benefits.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-2xl font-semibold text-plum-950">Benefits</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {job.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2.5 rounded-lg bg-teal-500/10 px-4 py-3 text-plum-900">
                      <Check className="h-5 w-5 shrink-0 text-teal-700" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-10">
              <h2 className="font-display text-2xl font-semibold text-plum-950">Working at Tinash</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {whatToExpect.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-sm text-plum-900">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" /> {c}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-10 text-sm leading-relaxed text-plum-700/70">
              {site.legalName} is an equal opportunity employer. We do not discriminate on the basis of race, color,
              religion, sex, national origin, age, disability or any other protected characteristic.
            </p>
          </article>

          <aside id="apply" className="scroll-mt-24">
            <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-plum-950/10 lg:sticky lg:top-28">
              <h2 className="font-display text-xl font-semibold text-plum-950">Apply for this job</h2>
              <p className="mt-1 text-sm text-plum-800">Takes about two minutes. We will call you back.</p>
              <div className="mt-5">
                <JobApplyForm jobId={job.id} jobTitle={job.title} />
              </div>
              <div className="mt-6 space-y-2 border-t border-plum-100 pt-5 text-sm">
                {job.apply_url && (
                  <a href={job.apply_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 font-semibold text-teal-700 hover:underline">
                    <ExternalLink className="h-4 w-4" /> Apply on our job board instead
                  </a>
                )}
                <a href={site.phoneHref} className="flex items-center gap-2 font-semibold text-teal-700 hover:underline">
                  <Phone className="h-4 w-4" /> Questions? Call {site.phone}
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Job: ${job.title}`)}&body=${encodeURIComponent(`${site.url}/careers/${job.slug}`)}`}
                  className="flex items-center gap-2 font-semibold text-teal-700 hover:underline"
                >
                  <Share2 className="h-4 w-4" /> Send this job to a friend
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
