import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, Phone } from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CareersForm from "@/components/site/CareersForm";
import JobListings, { type PublicJob } from "@/components/site/JobListings";
import { getOpenJobs } from "@/lib/public-jobs";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Caregiver Jobs in New Jersey",
  description:
    "Join Tinash Homecare Services — flexible schedules, real training, and clients matched to you. See open caregiver positions and apply in two minutes.",
  alternates: { canonical: "/careers" },
};

// Publishing or closing a job in the CRM refreshes this page straight away;
// this is only the fallback.
// Live job data: published or closed jobs show up immediately.
export const dynamic = "force-dynamic";

const perks = [
  "Flexible schedules — choose cases that fit your life",
  "Paid training and real supervision, not sink-or-swim",
  "Clients matched to your skills and personality",
  "Growth into senior caregiver and coordinator roles",
  "A team that answers when you call",
];

export default async function CareersPage() {
  const jobs = await getOpenJobs();
  const listed: PublicJob[] = jobs.map((j) => ({
    id: j.id, slug: j.slug, title: j.title, location: j.location, summary: j.summary,
    employment_type: j.employment_type, work_mode: j.work_mode,
    pay_min: j.pay_min, pay_max: j.pay_max, pay_interval: j.pay_interval, posted_at: j.posted_at,
  }));

  return (
    <>
      <PageHero
        kicker="Careers"
        title="Caregiving is a calling. We treat it like one."
        sub="CHHAs, DSPs, companions, and compassionate people ready to train — Tinash is hiring across New Jersey."
        image="/media/caregiver.webp"
      />

      {/* Open positions */}
      <section id="openings" className="mx-auto max-w-5xl scroll-mt-28 px-6 pt-20">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-teal-700">We&apos;re hiring</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-plum-950 sm:text-4xl">
              Open positions
            </h2>
          </div>
          <a href="#apply" className="text-sm font-semibold text-teal-700 hover:underline">
            Don&apos;t see a fit? Send a general application →
          </a>
        </Reveal>

        {listed.length > 0 ? (
          <JobListings jobs={listed} />
        ) : (
          <Reveal className="glass rounded-3xl p-8 text-center">
            <h3 className="font-display text-xl font-semibold text-plum-950">
              No openings listed right now
            </h3>
            <p className="mx-auto mt-2 max-w-lg leading-7 text-plum-800/85">
              We hire caregivers across New Jersey all year. Send a general application below and
              we&apos;ll call you when a case opens near you.
            </p>
            <a
              href="#apply"
              className="mt-5 inline-block rounded-full bg-teal-500 px-6 py-3 font-semibold text-plum-950 shadow-md transition-transform hover:scale-105"
            >
              Send a general application
            </a>
          </Reveal>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold text-plum-950">
              Why caregivers stay at Tinash
            </h2>
            <ul className="mt-6 grid gap-3">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-3 text-plum-900">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-600"
                    aria-hidden
                  />
                  {p}
                </li>
              ))}
            </ul>
            <Image
              src="/media/companion.webp"
              alt="A caregiver sharing tea and a laugh with a client"
              width={900}
              height={675}
              className="mt-10 rounded-3xl object-cover shadow-xl shadow-plum-950/10"
            />
            <a
              href={site.phoneHref}
              className="mt-8 inline-flex items-center gap-2 font-semibold text-plum-800"
            >
              <Phone className="h-4 w-4 text-teal-600" aria-hidden /> Questions? Call or text {site.phone}
            </a>
          </Reveal>
          <Reveal delay={0.1}>
            <div id="apply" className="glass scroll-mt-28 rounded-3xl p-8">
              <h2 className="font-display text-2xl font-semibold text-plum-950">
                General application
              </h2>
              <p className="mb-6 mt-2 text-sm leading-6 text-plum-700">
                Tell us about yourself — we&apos;ll call you to talk roles,
                schedules, and next steps. It takes about two minutes.
              </p>
              <CareersForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
