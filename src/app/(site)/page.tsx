import Link from "next/link";
import Image from "next/image";
import VideoHero from "@/components/VideoHero";
import TrustBar from "@/components/TrustBar";
import GuideAnnouncement from "@/components/GuideAnnouncement";
import ServiceCarousel from "@/components/ServiceCarousel";
import Pillars from "@/components/Pillars";
import { servicesByLine } from "@/lib/services";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import InquiryForm from "@/components/InquiryForm";
import Reveal from "@/components/Reveal";
import { site } from "@/lib/site";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <>
      <VideoHero />
      <TrustBar />
      <Pillars />
      <GuideAnnouncement />

      {/* Intro */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow text-plum-700">
              Who we are
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-plum-950 sm:text-5xl">
              There&apos;s more to caring for people than providing assistance.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-plum-800/80">
              Tinash Homecare Services is a New Jersey in-home care agency built
              on one belief: great care is a relationship, not a task list. Our
              caregivers are trained, supervised employees — matched to your
              family for skill and personality, and backed by a team
              that&apos;s available around the clock.
            </p>
            <p className="mt-4 max-w-xl text-lg leading-8 text-plum-800/80">
              Caring for someone with dementia? Through our partnership with
              PocketRN, eligible families can now get Medicare&apos;s{" "}
              <Link href="/guide-dementia-care" className="font-semibold text-plum-600 underline decoration-teal-500 decoration-2 underline-offset-4 hover:text-teal-700">
                GUIDE program
              </Link>{" "}
              — a dedicated nurse, 24/7 support, and in-home respite at no cost.
            </p>
            <Link
              href="/about"
              className="mt-7 inline-flex items-center gap-2 font-semibold text-plum-700 hover:text-teal-700"
            >
              Our story <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={0.15} className="relative">
            <Image
              src="/media/hands.webp"
              alt="A caregiver gently holding an elderly client's hands"
              width={960}
              height={540}
              className="rounded-3xl object-cover shadow-2xl shadow-plum-950/20"
            />
            <div className="glass absolute -bottom-6 left-6 hidden rounded-2xl px-6 py-4 sm:block">
              <p className="font-display text-lg font-semibold text-plum-900">
                Dignity-first care
              </p>
              <p className="text-sm text-plum-700">At home, where life happens.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section className="overflow-hidden bg-mist-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow text-plum-700">
              Our services
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-plum-950 sm:text-5xl">
              Care built around <span className="text-teal-600">your</span> family.
            </h2>
            <p className="mt-4 text-lg leading-8 text-plum-800/80">
              Every service has a clear scope, a written care plan, and a team
              behind it.
            </p>
          </Reveal>
          <ServiceCarousel />
          <Reveal className="mt-14">
            <div className="divide-y divide-plum-100 rounded-3xl border border-white bg-white/80 shadow-sm backdrop-blur">
              {[
                { title: "Home Care", sub: "Seniors & adults · private pay", href: "/services#home-care", items: servicesByLine("home-care") },
                { title: "DDD Services", sub: "Adults 21+ · paid from DDD budget", href: "/ddd-services", items: servicesByLine("ddd") },
              ].map((row) => (
                <div key={row.title} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-7">
                  <Link href={row.href} className="group shrink-0 sm:w-56">
                    <p className="font-display text-lg font-bold text-plum-950 group-hover:text-teal-700">{row.title}</p>
                    <p className="text-sm text-plum-600">{row.sub}</p>
                  </Link>
                  <ul className="flex flex-wrap gap-2.5">
                    {row.items.map((sv) => (
                      <li key={sv.slug}>
                        <Link href={`/services/${sv.slug}`} className="inline-block rounded-full border border-plum-200 bg-white px-4 py-2 text-sm font-medium text-plum-800 transition-colors hover:border-plum-600 hover:bg-plum-600 hover:text-white">
                          {sv.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-7">
                <Link href="/guide-dementia-care" className="group shrink-0 sm:w-56">
                  <p className="font-display text-lg font-bold text-plum-950 group-hover:text-teal-700">Medicare Program</p>
                  <p className="text-sm text-plum-600">Traditional Medicare · dementia</p>
                </Link>
                <Link href="/guide-dementia-care" className="inline-block self-start rounded-full bg-teal-500/15 px-4 py-2 text-sm font-semibold text-plum-800 ring-1 ring-teal-500/50 transition-colors hover:bg-teal-500 hover:text-plum-950 sm:self-auto">
                  GUIDE Dementia Program
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* DDD band with video */}
      <section className="relative overflow-hidden bg-plum-700 py-24 sm:py-32">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/media/community.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-plum-800/90 via-plum-700/55 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6">
          <Reveal className="max-w-2xl">
            <p className="eyebrow text-teal-300">
              <Sparkles className="h-4 w-4" aria-hidden /> NJ DDD families
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Your DDD budget, finally explained in plain language.
            </h2>
            <p className="mt-5 text-lg leading-8 text-mist-100/85">
              We help Division of Developmental Disabilities participants and
              their guardians understand their supports — then deliver them:
              individual supports, community inclusion, and respite from staff
              who show up with joy.
            </p>
            <Link
              href="/ddd-services"
              className="mt-8 inline-block rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-xl transition-transform hover:scale-105"
            >
              Explore DDD services
            </Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <Reveal className="mb-14 text-center">
          <p className="eyebrow text-plum-700">
            How care starts
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-plum-950 sm:text-5xl">
            Three steps. No pressure.
          </h2>
        </Reveal>
        <HowItWorks />
      </section>

      {/* Testimonials */}
      <section className="bg-mist-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 text-center">
            <p className="eyebrow text-plum-700">
              Families on Tinash
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-plum-950 sm:text-5xl">
              The reviews we work for.
            </h2>
          </Reveal>
          <Testimonials />
        </div>
      </section>

      {/* Careers + consulting strip */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <Reveal className="group relative overflow-hidden rounded-3xl bg-plum-700 p-10">
          <Image
            src="/media/caregiver.webp"
            alt=""
            fill
            className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
            aria-hidden
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-plum-800/85 via-plum-700/50 to-transparent" />
          <div className="relative">
            <h3 className="font-display text-3xl font-semibold text-white">
              Love caregiving? Join our team.
            </h3>
            <p className="mt-3 max-w-md leading-7 text-mist-100/85">
              Flexible schedules, real training, and clients matched to you.
              Caregivers are the heart of Tinash — we treat them that way.
            </p>
            <Link
              href="/careers"
              className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-plum-950 transition-transform hover:scale-105"
            >
              See open roles
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="group relative overflow-hidden rounded-3xl bg-mist-200 p-10">
          <Image
            src="/media/consulting.webp"
            alt=""
            fill
            className="object-cover opacity-30 transition-transform duration-700 group-hover:scale-105"
            aria-hidden
          />
          <div className="relative">
            <h3 className="font-display text-3xl font-semibold text-plum-950">
              Want to launch your own homecare agency?
            </h3>
            <p className="mt-3 max-w-md leading-7 text-plum-800/85">
              We&apos;ve done it — licensing, policies, staffing, systems. Tinash
              Consulting helps founders go from idea to first client.
            </p>
            <Link
              href="/consulting"
              className="mt-6 inline-block rounded-full bg-plum-600 px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
            >
              Explore consulting
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section id="assessment" className="bg-brand py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-6 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Start with a free care assessment.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-mist-100/85">
              Tell us a little about your family, and a care coordinator will
              call you back — usually the same day. Serving{" "}
              {site.serviceArea.slice(0, 4).join(", ")} and surrounding New
              Jersey communities.
            </p>
            <a
              href={site.phoneHref}
              className="mt-8 inline-block font-display text-3xl font-semibold text-teal-400 hover:text-teal-300"
            >
              {site.phone}
            </a>
            <p className="mt-2 text-sm text-mist-100/60">
              Office hours Mon–Fri 9–7, Sat–Sun 10–2 · Care available around the clock.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-3xl bg-mist-50 p-8 shadow-2xl">
            <InquiryForm kind="care" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
