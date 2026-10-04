import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Stethoscope,
  PhoneCall,
  GraduationCap,
  Network,
  Home,
  Phone,
  MapPin,
} from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";
import { site } from "@/lib/site";

// Copy from the "Tinash GUIDE Program Page — Website Copy" doc.
// Compliance: Tinash is a partner of PocketRN (the CMS-selected GUIDE
// participant) — never describe Tinash as a GUIDE participant itself.
// Before publishing, PocketRN's partner manager should review this page.

export const metadata: Metadata = {
  title: { absolute: "GUIDE Medicare Dementia Care Program in NJ | Tinash Home Care" },
  description:
    "Tinash Home Care is a CMS-approved GUIDE partner with PocketRN. Medicare-covered dementia support in NJ: 24/7 nurse access, caregiver training, and in-home respite.",
  alternates: { canonical: "/guide-dementia-care" },
};

const benefits = [
  {
    icon: Stethoscope,
    title: "A dedicated nurse for life.",
    body: "One nurse who knows your loved one's story provides ongoing education, coaching, care navigation, and emotional support.",
  },
  {
    icon: PhoneCall,
    title: "A 24/7 nurse lifeline.",
    body: "Whether it's a medication concern, a behavior change, or just a gut feeling, a nurse is available around the clock — from home, with no travel or waiting rooms.",
  },
  {
    icon: GraduationCap,
    title: "Caregiver training and support.",
    body: "Family caregivers get practical training tailored to their loved one's needs, so they feel prepared instead of overwhelmed.",
  },
  {
    icon: Network,
    title: "Care coordination.",
    body: "Nurses work behind the scenes with doctors, VA providers, and care teams so everyone stays on the same page — you don't have to chase care down.",
  },
  {
    icon: Home,
    title: "In-home respite care.",
    body: "Qualifying families receive a respite benefit: trained Tinash caregivers come to the home so family caregivers can rest, work, or take a break, at no out-of-pocket cost.",
  },
];

const counties = ["Essex", "Bergen", "Passaic", "Morris", "Middlesex", "Union"];
const towns = [
  "Newark",
  "East Orange",
  "Montclair",
  "Hackensack",
  "Paterson",
  "Clifton",
  "Morristown",
  "Edison",
  "New Brunswick",
  "Woodbridge",
  "Elizabeth",
  "Plainfield",
];

export default function GuidePage() {
  return (
    <>
      <PageHero
        kicker="Medicare GUIDE Program"
        title="The GUIDE Program: Medicare Dementia Care Support for Families"
        sub="Tinash Home Care Services is proud to be a CMS-approved partner in the GUIDE Model, in partnership with PocketRN. If your loved one is living with dementia, you don't have to do this alone — and this support comes at no cost through Medicare."
        image="/media/hands.webp"
      />

      {/* What is GUIDE */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              What is GUIDE?
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-plum-950">
              A coordinated care team that stays with you.
            </h2>
            <p className="mt-5 text-lg leading-8 text-plum-800/85">
              GUIDE (Guiding an Improved Dementia Experience) is a program from
              the CMS Innovation Center — part of Medicare — designed to support
              people living with dementia and the family members who care for
              them. Instead of chasing down doctors, specialists, and answers on
              your own, GUIDE gives your family a coordinated care team that
              stays with you.
            </p>
            <p className="mt-4 text-lg leading-8 text-plum-800/85">
              Tinash Home Care Services delivers GUIDE services locally in
              partnership with PocketRN, a CMS-selected GUIDE participant whose
              nurse-led model gives every family a dedicated nurse.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <Image
              src="/media/companion.webp"
              alt="A caregiver sharing a warm moment with an older adult at home"
              width={960}
              height={640}
              className="rounded-3xl object-cover shadow-2xl shadow-plum-950/20"
            />
            <div className="glass absolute -bottom-6 left-6 rounded-2xl px-6 py-4">
              <p className="font-display text-lg font-bold text-plum-900">
                $0 to enroll
              </p>
              <p className="text-sm text-plum-700">Covered through Medicare</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-mist-100 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              What your family receives
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-plum-950">
              Support for your loved one — and for you.
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <div className="group h-full rounded-3xl border border-white bg-white/70 p-7 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-plum-950/10">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold text-plum-950">
                    {title}
                  </h3>
                  <p className="mt-2 leading-7 text-plum-800/85">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Cost + eligibility */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal className="h-full">
            <div className="h-full rounded-3xl bg-brand p-8 text-white sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
                What it costs
              </p>
              <p className="mt-4 font-display text-5xl font-bold text-teal-400">$0</p>
              <p className="mt-4 text-lg leading-8 text-mist-100/85">
                GUIDE services are covered through Medicare for eligible
                beneficiaries. There is no cost to enroll, and the respite
                benefit for qualifying families carries no out-of-pocket cost.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <div className="h-full rounded-3xl border border-plum-100 bg-white p-8 shadow-sm sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
                Who qualifies
              </p>
              <p className="mt-3 text-lg text-plum-900">
                Your loved one may be eligible for GUIDE if all three apply:
              </p>
              <ol className="mt-5 grid gap-4">
                {[
                  <>They have <strong>traditional Medicare</strong> (Original Medicare — not a Medicare Advantage plan)</>,
                  <>They have a <strong>dementia diagnosis</strong> (including Alzheimer&apos;s disease and related dementias)</>,
                  <>They are <strong>not currently enrolled in hospice</strong></>,
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-4 text-plum-900">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-plum-600 font-display text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-1 leading-7">{item}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 leading-7 text-plum-800/85">
                Not sure? Call us — we&apos;ll help you check eligibility in
                minutes, and a dementia evaluation can be arranged if your loved
                one hasn&apos;t been formally diagnosed.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Where we serve */}
      <section className="bg-mist-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-teal-700">
              <MapPin className="h-4 w-4" aria-hidden /> Where we serve
            </p>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-plum-800/85">
              Tinash provides GUIDE services across northern and central New
              Jersey, including {counties.slice(0, -1).join(", ")}, and{" "}
              {counties.at(-1)} counties — communities like:
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {towns.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-plum-200 bg-white px-4 py-1.5 text-sm font-medium text-plum-800"
                >
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Get started */}
      <section id="get-started" className="relative overflow-hidden bg-brand py-20 sm:py-28">
        <div aria-hidden className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-6 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
              How to get started
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              See If Your Loved One Qualifies
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-mist-100/85">
              Getting started takes one phone call. We&apos;ll answer your
              questions, check eligibility, and connect you with the PocketRN
              care team to schedule a welcome call — usually within days.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={site.guidePhoneHref}
                className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-xl transition-transform hover:scale-105"
              >
                <Phone className="h-5 w-5" aria-hidden /> Call {site.guidePhone}
              </a>
              <Link
                href="#guide-inquiry"
                className="inline-flex items-center rounded-full border border-white/30 px-7 py-3.5 font-semibold text-white transition-colors hover:border-teal-300"
              >
                Send an Inquiry
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-sm leading-6 text-mist-100/70">
              There is no obligation — we&apos;re happy to simply explain the
              program and help you figure out whether it&apos;s right for your
              family.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-3xl bg-mist-50 p-8 shadow-2xl">
            <div id="guide-inquiry" className="scroll-mt-28">
              <InquiryForm kind="care" defaultService="GUIDE Program" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
