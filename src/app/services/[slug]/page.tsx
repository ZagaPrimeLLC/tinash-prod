import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { services, getService } from "@/lib/services";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";

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
  return {
    title: `${s.name} in New Jersey`,
    description: s.short,
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const s = getService((await params).slug);
  if (!s) notFound();

  return (
    <>
      <PageHero kicker={s.name} title={s.hero} sub={s.short} image={s.image} />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            {s.body.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="mb-5 max-w-2xl text-lg leading-8 text-pine-800/85"
              >
                {p}
              </p>
            ))}
            <ul className="mt-8 grid gap-3">
              {s.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-pine-900">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-gold-500"
                    aria-hidden
                  />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="rounded-full bg-pine-950 px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
              >
                Book a free assessment
              </Link>
              <Link
                href="/services"
                className="rounded-full border border-pine-300 px-6 py-3 font-semibold text-pine-800 transition-colors hover:border-gold-400"
              >
                All services
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="sticky top-24 overflow-hidden rounded-3xl shadow-xl shadow-pine-950/10">
              <Image
                src={s.image}
                alt={s.name}
                width={800}
                height={600}
                className="h-72 w-full object-cover"
              />
              <div className="bg-cream-100 p-7">
                <h2 className="font-display text-xl font-semibold text-pine-950">
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
