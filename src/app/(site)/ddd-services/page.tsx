import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, UserCheck, Wallet } from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ServiceCards from "@/components/ServiceCards";
import CTABanner from "@/components/site/CTABanner";
import { serviceLines, servicesByLine } from "@/lib/services";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "NJ DDD Services — Individual Supports, Community-Based Supports & Respite",
  description:
    "Tinash is a NJ DDD provider of Individual Supports, Community-Based Supports, and respite for adults with intellectual and developmental disabilities. Paid from the DDD budget — ask your support coordinator.",
  alternates: { canonical: "/ddd-services" },
};

const line = serviceLines.ddd;

const steps = [
  {
    icon: UserCheck,
    title: "Confirm DDD eligibility",
    body: "DDD serves NJ residents 21 and older with an intellectual or developmental disability who are eligible for NJ FamilyCare (Medicaid). Still in school or not yet determined eligible? DDD's intake process comes first — we can point you to it.",
  },
  {
    icon: ClipboardList,
    title: "Talk to your support coordinator",
    body: "Every DDD participant has a support coordinator who builds the Individualized Service Plan (ISP) with you. Ask them to select Tinash as the provider for the services you want.",
  },
  {
    icon: Wallet,
    title: "Services start — paid from the DDD budget",
    body: "Approved services are paid from the participant's DDD budget through NJ FamilyCare. There's no bill to the family. We introduce your staff, agree on a schedule, and report progress to the planning team.",
  },
];

export default function DddServicesPage() {
  const ddd = servicesByLine("ddd");
  return (
    <>
      <PageHero
        kicker="NJ DDD services"
        title="DDD supports, explained in plain language."
        sub={line.tagline + " We help participants and families understand their options — then deliver the services with trained, supervised staff."}
        image="/media/ddd.webp"
      />

      {/* Home care vs DDD — the distinction families ask about */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="max-w-3xl">
          <p className="eyebrow text-plum-700">Is this DDD or home care?</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-plum-950 sm:text-4xl">
            Two different systems. Tinash provides both.
          </h2>
          <p className="mt-4 text-lg leading-8 text-plum-800/85">
            DDD services are New Jersey Medicaid waiver services for adults with
            developmental disabilities, chosen with a support coordinator and
            paid from a DDD budget. Home care is nursing and personal care for
            seniors and adults, arranged directly with us. Many agencies offer
            only one — we&apos;re set up for both, so families don&apos;t have to
            switch providers when needs change.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {(["ddd", "home-care"] as const).map((k) => {
            const l = serviceLines[k];
            const isDdd = k === "ddd";
            return (
              <Reveal key={k} delay={isDdd ? 0 : 0.08}>
                <div
                  className={`h-full rounded-3xl p-7 sm:p-8 ${
                    isDdd ? "bg-brand text-white" : "border border-plum-100 bg-white"
                  }`}
                >
                  <p className={`font-display text-2xl font-bold ${isDdd ? "text-white" : "text-plum-950"}`}>
                    {l.label}
                  </p>
                  <dl className={`mt-5 grid gap-4 text-[15px] leading-7 ${isDdd ? "text-mist-100/90" : "text-plum-800/90"}`}>
                    <div>
                      <dt className={`font-semibold ${isDdd ? "text-teal-300" : "text-teal-700"}`}>Who it&apos;s for</dt>
                      <dd>{l.who}</dd>
                    </div>
                    <div>
                      <dt className={`font-semibold ${isDdd ? "text-teal-300" : "text-teal-700"}`}>How it&apos;s paid</dt>
                      <dd>{l.payment}</dd>
                    </div>
                    <div>
                      <dt className={`font-semibold ${isDdd ? "text-teal-300" : "text-teal-700"}`}>How to start</dt>
                      <dd>{l.start}</dd>
                    </div>
                  </dl>
                  {!isDdd && (
                    <Link
                      href={l.href}
                      className="mt-6 inline-flex items-center gap-2 font-semibold text-plum-700 hover:text-teal-700"
                    >
                      See home care services <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* DDD services */}
      <section className="bg-mist-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-10 max-w-2xl">
            <p className="eyebrow text-plum-700">Our DDD services</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-plum-950 sm:text-4xl">
              One-to-one support, at home and in the community.
            </h2>
          </Reveal>
          <ServiceCards items={ddd} showProgram />
        </div>
      </section>

      {/* Programs */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="max-w-3xl">
          <p className="eyebrow text-plum-700">Supports Program or Community Care Program?</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-plum-950 sm:text-4xl">
            Which services you can choose depends on your DDD program.
          </h2>
          <p className="mt-4 text-lg leading-8 text-plum-800/85">
            DDD runs two Medicaid waiver programs for adults. Most services are
            available in both, but a few belong to one program only:
          </p>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            {
              name: "Supports Program",
              body: "For participants living in their own or their family's home. Includes Community-Based Supports and Respite.",
              items: ["Community-Based Supports", "DDD Respite"],
            },
            {
              name: "Community Care Program",
              body: "For participants who meet an institutional level of care. Includes Individual Supports and Respite.",
              items: ["Individual Supports", "DDD Respite"],
            },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <div className="h-full rounded-3xl border border-plum-100 bg-white p-7">
                <p className="font-display text-xl font-bold text-plum-950">{p.name}</p>
                <p className="mt-2 leading-7 text-plum-800/85">{p.body}</p>
                <ul className="mt-4 grid gap-2">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-center gap-2 text-plum-900">
                      <CheckCircle2 className="h-5 w-5 text-teal-600" aria-hidden /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-plum-700">
          Not sure which program you&apos;re in? Your support coordinator can tell
          you — or call us at{" "}
          <a href={site.phoneHref} className="font-semibold underline decoration-teal-500 underline-offset-2">
            {site.phone}
          </a>{" "}
          and we&apos;ll help you find out.
        </p>
      </section>

      {/* How to start */}
      <section className="bg-mist-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-10 max-w-2xl">
            <p className="eyebrow text-plum-700">How to start</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-plum-950 sm:text-4xl">
              Three steps to DDD services with Tinash.
            </h2>
          </Reveal>
          <ol className="grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.06}>
                <li className="h-full rounded-3xl bg-white p-7 shadow-sm">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-plum-600 text-white">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <p className="mt-5 text-sm font-semibold text-teal-700">Step {i + 1}</p>
                  <h3 className="mt-1 font-display text-lg font-bold text-plum-950">{title}</h3>
                  <p className="mt-2 leading-7 text-plum-800/85">{body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
          <p className="mt-8 leading-7 text-plum-800/85">
            <strong className="text-plum-950">Support coordinators:</strong> we
            welcome referrals. Call {site.phone} or email{" "}
            <a href={`mailto:${site.email}`} className="font-semibold underline decoration-teal-500 underline-offset-2">
              {site.email}
            </a>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <CTABanner
          cta="ddd-services"
          title="Questions about your DDD budget or services?"
          body="We'll walk you through it in plain language — no obligation."
        />
      </section>
    </>
  );
}
