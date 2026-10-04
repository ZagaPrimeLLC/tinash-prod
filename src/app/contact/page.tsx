import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";
import { site } from "@/lib/site";
import { Phone, Mail, Clock, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us — Free Care Assessment",
  description:
    "Call Tinash Homecare Services or request a free in-home care assessment anywhere in our New Jersey service area.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        kicker="Contact"
        title="Let's talk about the care your family needs."
        sub="Call anytime — lines are answered 24/7 — or send the form and we'll call you back, usually the same day."
        image="/media/hero-poster.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="space-y-6">
            <a href={site.phoneHref} className="glass flex items-center gap-4 rounded-2xl p-6">
              <Phone className="h-6 w-6 text-gold-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-pine-600">Call or text</p>
                <p className="font-display text-xl font-semibold text-pine-950">
                  {site.phone}
                </p>
              </div>
            </a>
            <a href={`mailto:${site.email}`} className="glass flex items-center gap-4 rounded-2xl p-6">
              <Mail className="h-6 w-6 text-gold-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-pine-600">Email</p>
                <p className="font-display text-xl font-semibold text-pine-950">
                  {site.email}
                </p>
              </div>
            </a>
            <div className="glass flex items-center gap-4 rounded-2xl p-6">
              <Clock className="h-6 w-6 text-gold-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-pine-600">Hours</p>
                <p className="font-display text-xl font-semibold text-pine-950">
                  24/7 — every day of the year
                </p>
              </div>
            </div>
            <div className="glass flex items-center gap-4 rounded-2xl p-6">
              <MapPin className="h-6 w-6 text-gold-500" aria-hidden />
              <div>
                <p className="text-sm font-medium text-pine-600">Service area</p>
                <p className="font-display text-lg font-semibold leading-snug text-pine-950">
                  {site.serviceArea.join(" · ")}
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="rounded-3xl bg-white p-8 shadow-2xl shadow-pine-950/10">
            <h2 className="font-display text-2xl font-semibold text-pine-950">
              Request your free care assessment
            </h2>
            <div className="mt-6">
              <InquiryForm kind="care" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
