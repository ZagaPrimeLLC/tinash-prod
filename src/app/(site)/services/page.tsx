import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HeartPulse } from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ServiceCards from "@/components/ServiceCards";
import CTABanner from "@/components/site/CTABanner";
import { serviceLines, servicesByLine, type ServiceLine } from "@/lib/services";

export const metadata: Metadata = {
  title: "Home Care & NJ DDD Services",
  description:
    "Two service lines: home care (skilled nursing, daily senior care, companion, live-in and respite care) and NJ DDD services (Individual Supports, Community-Based Supports, DDD respite) — plus the Medicare GUIDE dementia program.",
};

function LineSection({ line, tinted }: { line: ServiceLine; tinted?: boolean }) {
  const l = serviceLines[line];
  return (
    <section id={line} className={`scroll-mt-28 py-20 ${tinted ? "bg-mist-100" : ""}`}>
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-10 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow text-plum-700">{l.label}</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-plum-950 sm:text-4xl">
              {l.tagline}
            </h2>
          </div>
          <dl className="grid gap-2 rounded-2xl border border-plum-100 bg-white p-5 text-[15px] leading-6 text-plum-800/90">
            <div><dt className="inline font-semibold text-plum-900">For: </dt><dd className="inline">{l.who}</dd></div>
            <div><dt className="inline font-semibold text-plum-900">Paid by: </dt><dd className="inline">{l.payment}</dd></div>
          </dl>
        </Reveal>
        <ServiceCards items={servicesByLine(line)} showProgram={line === "ddd"} />
        {line === "ddd" && (
          <Link
            href="/ddd-services"
            className="mt-8 inline-flex items-center gap-2 font-semibold text-plum-700 hover:text-teal-700"
          >
            How DDD services work — eligibility, programs, and how to start
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  );
}

export default function ServicesPage() {
  return (
    <>
      <PageHero
        kicker="Our services"
        title="Home care and DDD services, under one roof."
        sub="Tinash runs two service lines that New Jersey funds and regulates differently: home care for seniors and adults, and DDD-approved supports for adults with intellectual and developmental disabilities. Not sure which applies? We'll help you sort it out on one call."
        image="/media/hero-poster.webp"
      />

      {/* Quick chooser */}
      <section className="mx-auto max-w-7xl px-6 pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: "#home-care", title: "Home Care", body: "Nursing and personal care at home for seniors and adults. Private pay or insurance." },
            { href: "#ddd", title: "DDD Services", body: "For adults 21+ eligible for NJ DDD. Paid from the DDD budget — chosen with your support coordinator." },
            { href: "/guide-dementia-care", title: "Medicare GUIDE", body: "Dementia support at no cost for eligible people on traditional Medicare, with PocketRN." },
          ].map((c) => (
            <Link
              key={c.title}
              href={c.href}
              className="group rounded-3xl border border-plum-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-teal-500 hover:shadow-lg"
            >
              <p className="flex items-center gap-2 font-display text-xl font-bold text-plum-950">
                {c.title === "Medicare GUIDE" && <HeartPulse className="h-5 w-5 text-teal-600" aria-hidden />}
                {c.title}
              </p>
              <p className="mt-2 leading-7 text-plum-800/85">{c.body}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                See services <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <LineSection line="home-care" />
      <LineSection line="ddd" tinted />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <CTABanner
          cta="services"
          title="Not sure what level of care you need?"
          body="That's exactly what the free consultation is for. We'll listen, explain your options — home care, DDD, or GUIDE — and recommend only what actually helps."
        />
      </section>
    </>
  );
}
