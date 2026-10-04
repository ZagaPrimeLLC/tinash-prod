import Link from "next/link";
import Image from "next/image";
import VideoHero from "@/components/VideoHero";
import TrustBar from "@/components/TrustBar";
import ServiceCards from "@/components/ServiceCards";
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

      {/* Intro */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-500">
              Who we are
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-pine-950 sm:text-5xl">
              There&apos;s more to caring for people than providing assistance.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-pine-800/80">
              Tinash Homecare Services is a New Jersey in-home care agency built
              on one belief: great care is a relationship, not a task list. Our
              caregivers are trained, supervised employees — matched to your
              family for skill and personality, and backed by a team that
              answers the phone 24/7.
            </p>
            <Link
              href="/about"
              className="mt-7 inline-flex items-center gap-2 font-semibold text-pine-700 hover:text-gold-500"
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
              className="rounded-3xl object-cover shadow-2xl shadow-pine-950/20"
            />
            <div className="glass absolute -bottom-6 left-6 hidden rounded-2xl px-6 py-4 sm:block">
              <p className="font-display text-lg font-semibold text-pine-900">
                Dignity-first care
              </p>
              <p className="text-sm text-pine-700">At home, where life happens.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section className="bg-cream-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-500">
              Our services
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-pine-950 sm:text-5xl">
              Named programs, not vague promises.
            </h2>
            <p className="mt-4 text-lg leading-8 text-pine-800/80">
              Every service has a clear scope, a written care plan, and a team
              behind it.
            </p>
          </Reveal>
          <ServiceCards />
        </div>
      </section>

      {/* DDD band with video */}
      <section className="relative overflow-hidden bg-pine-950 py-24 sm:py-32">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          src="/media/community.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-pine-950 via-pine-950/80 to-pine-950/40" />
        <div className="relative mx-auto max-w-7xl px-6">
          <Reveal className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gold-400">
              <Sparkles className="h-4 w-4" aria-hidden /> NJ DDD families
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Your DDD budget, finally explained in plain language.
            </h2>
            <p className="mt-5 text-lg leading-8 text-cream-100/85">
              We help Division of Developmental Disabilities participants and
              their guardians understand their supports — then deliver them:
              individual supports, community inclusion, and respite from staff
              who show up with joy.
            </p>
            <Link
              href="/services/ddd-services"
              className="mt-8 inline-block rounded-full bg-gold-500 px-7 py-3.5 font-semibold text-pine-950 shadow-xl transition-transform hover:scale-105"
            >
              Explore DDD services
            </Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-28">
        <Reveal className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-500">
            How care starts
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-pine-950 sm:text-5xl">
            Three steps. No pressure.
          </h2>
        </Reveal>
        <HowItWorks />
      </section>

      {/* Testimonials */}
      <section className="bg-cream-100 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-500">
              Families on Tinash
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-pine-950 sm:text-5xl">
              The reviews we work for.
            </h2>
          </Reveal>
          <Testimonials />
        </div>
      </section>

      {/* Careers + consulting strip */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <Reveal className="group relative overflow-hidden rounded-3xl bg-pine-950 p-10">
          <Image
            src="/media/caregiver.webp"
            alt=""
            fill
            className="object-cover opacity-25 transition-transform duration-700 group-hover:scale-105"
            aria-hidden
          />
          <div className="relative">
            <h3 className="font-display text-3xl font-semibold text-white">
              Love caregiving? Join our team.
            </h3>
            <p className="mt-3 max-w-md leading-7 text-cream-100/85">
              Flexible schedules, real training, and clients matched to you.
              Caregivers are the heart of Tinash — we treat them that way.
            </p>
            <Link
              href="/careers"
              className="mt-6 inline-block rounded-full bg-white px-6 py-3 font-semibold text-pine-950 transition-transform hover:scale-105"
            >
              See open roles
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="group relative overflow-hidden rounded-3xl bg-cream-200 p-10">
          <Image
            src="/media/consulting.webp"
            alt=""
            fill
            className="object-cover opacity-20 transition-transform duration-700 group-hover:scale-105"
            aria-hidden
          />
          <div className="relative">
            <h3 className="font-display text-3xl font-semibold text-pine-950">
              Want to launch your own homecare agency?
            </h3>
            <p className="mt-3 max-w-md leading-7 text-pine-800/85">
              We&apos;ve done it — licensing, policies, staffing, systems. Tinash
              Consulting helps founders go from idea to first client.
            </p>
            <Link
              href="/consulting"
              className="mt-6 inline-block rounded-full bg-pine-950 px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
            >
              Explore consulting
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section id="assessment" className="bg-pine-950 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-6 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Start with a free care assessment.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-cream-100/85">
              Tell us a little about your family, and a care coordinator will
              call you back — usually the same day. Serving{" "}
              {site.serviceArea.slice(0, 4).join(", ")} and surrounding New
              Jersey communities.
            </p>
            <a
              href={site.phoneHref}
              className="mt-8 inline-block font-display text-3xl font-semibold text-gold-400 hover:text-gold-300"
            >
              {site.phone}
            </a>
            <p className="mt-2 text-sm text-cream-100/60">
              Lines answered 24/7, including weekends and holidays.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-3xl bg-cream-50 p-8 shadow-2xl">
            <InquiryForm kind="care" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
