import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { services, getService, serviceLines, type Service } from "@/lib/services";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";
import { breadcrumbLd, ldIds, ldJson, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

/** Primary search phrase for a service, e.g. "DDD Individual Supports in New Jersey". */
const keyword = (s: Service) =>
  `${s.line === "ddd" && !s.name.startsWith("DDD") ? "DDD " : ""}${s.name} in New Jersey`;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const s = getService((await params).slug);
  if (!s) return {};
  return pageMetadata(`/services/${s.slug}`, { title: keyword(s), description: s.short });
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const s = getService((await params).slug);
  if (!s) notFound();

  const line = serviceLines[s.line];
  const path = `/services/${s.slug}`;
  const ld = [
    breadcrumbLd([
      s.line === "ddd" ? ["DDD Services", "/ddd-services"] : ["Services", "/services"],
      [s.name, path],
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.name,
      serviceType: s.name,
      category: line.label,
      description: s.short,
      url: `${site.url}${path}`,
      image: `${site.url}${s.image}`,
      provider: { "@id": ldIds.business },
      areaServed: site.serviceArea.map((county) => ({
        "@type": "AdministrativeArea",
        name: `${county}, NJ`,
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <PageHero
        kicker={keyword(s)}
        kickerAsH1
        title={s.hero}
        sub={s.short}
        image={s.image}
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            {s.body.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="mb-5 max-w-2xl text-lg leading-8 text-plum-800/85"
              >
                {p}
              </p>
            ))}
            <ul className="mt-8 grid gap-3">
              {s.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-plum-900">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-600"
                    aria-hidden
                  />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-10 rounded-2xl border border-plum-100 bg-mist-100 p-6">
              <p className="font-display text-lg font-bold text-plum-950">
                {serviceLines[s.line].label}
                {s.dddProgram && (
                  <span className="ml-2 align-middle text-sm font-semibold text-teal-700">
                    · {s.dddProgram}
                  </span>
                )}
              </p>
              <dl className="mt-3 grid gap-2 text-[15px] leading-7 text-plum-800/90">
                <div><dt className="inline font-semibold text-plum-900">Who it&apos;s for: </dt><dd className="inline">{serviceLines[s.line].who}</dd></div>
                <div><dt className="inline font-semibold text-plum-900">How it&apos;s paid: </dt><dd className="inline">{serviceLines[s.line].payment}</dd></div>
                <div><dt className="inline font-semibold text-plum-900">How to start: </dt><dd className="inline">{serviceLines[s.line].start}</dd></div>
              </dl>
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="rounded-full bg-plum-600 px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
              >
                Book a free assessment
              </Link>
              <Link
                href={s.line === "ddd" ? "/ddd-services" : "/services#home-care"}
                className="rounded-full border border-plum-300 px-6 py-3 font-semibold text-plum-800 transition-colors hover:border-teal-400"
              >
                {s.line === "ddd" ? "All DDD services" : "All home care services"}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="sticky top-24 overflow-hidden rounded-3xl shadow-xl shadow-plum-950/10">
              <Image
                src={s.image}
                alt={s.name}
                width={800}
                height={600}
                className="h-72 w-full object-cover"
              />
              <div className="bg-mist-100 p-7">
                <h2 className="font-display text-xl font-semibold text-plum-950">
                  Ask about {s.name.toLowerCase()}
                </h2>
                <div className="mt-4">
                  <InquiryForm kind="care" compact />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
