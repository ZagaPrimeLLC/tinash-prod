import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ServiceCards from "@/components/ServiceCards";
import Reveal from "@/components/Reveal";
import Link from "next/link";

export const metadata: Metadata = {
  title: "In-Home Care Services in New Jersey",
  description:
    "Companion care, live-in & 24/7 care, respite care, daily senior care, community support, and NJ DDD services — delivered across New Jersey.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        kicker="Our services"
        title="Care built around your family."
        sub="Six named programs, each with a clear scope and a written care plan. Not sure which fits? A free assessment answers that in one visit."
        image="/media/hero-poster.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <ServiceCards />
        <Reveal className="mt-16 rounded-3xl bg-pine-950 p-10 text-center">
          <h2 className="font-display text-3xl font-semibold text-white">
            Not sure what level of care you need?
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-cream-100/85">
            That&apos;s exactly what the free in-home assessment is for. We&apos;ll
            meet your loved one and recommend only what actually helps.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-full bg-gold-500 px-7 py-3.5 font-semibold text-pine-950 transition-transform hover:scale-105"
          >
            Book a free assessment
          </Link>
        </Reveal>
      </section>
    </>
  );
}
