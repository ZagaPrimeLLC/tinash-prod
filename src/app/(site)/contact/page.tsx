import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ContactForm from "@/components/site/ContactForm";
import BookingFlow from "@/components/site/BookingFlow";
import { site } from "@/lib/site";
import { Phone, Mail, Clock, MapPin } from "lucide-react";

export const metadata: Metadata = pageMetadata("/contact", {
  title: "Contact Us — Free Care Assessment",
  description:
    "Call Tinash Homecare Services or request a free in-home care assessment anywhere in our New Jersey service area.",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        kicker="Contact"
        title="Let's talk about the care your family needs."
        sub="Call, text, or WhatsApp us — or send the form and we'll call you back, usually the same day."
        image="/media/hero-poster.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="space-y-6">
            <a href={site.phoneHref} className="glass flex items-center gap-4 rounded-2xl p-6">
              <Phone className="h-6 w-6 text-teal-600" aria-hidden />
              <div>
                <p className="text-sm font-medium text-plum-600">Call, text, or WhatsApp</p>
                <p className="font-display text-xl font-semibold text-plum-950">
                  {site.phone}
                </p>
              </div>
            </a>
            <a href={`mailto:${site.email}`} className="glass flex items-center gap-4 rounded-2xl p-6">
              <Mail className="h-6 w-6 text-teal-600" aria-hidden />
              <div>
                <p className="text-sm font-medium text-plum-600">Email</p>
                <p className="font-display text-xl font-semibold text-plum-950">
                  {site.email}
                </p>
              </div>
            </a>
            <div className="glass flex items-center gap-4 rounded-2xl p-6">
              <Clock className="h-6 w-6 text-teal-600" aria-hidden />
              <div>
                <p className="text-sm font-medium text-plum-600">Office hours</p>
                {site.hours.map((h) => (
                  <p key={h.days} className="font-display text-lg font-semibold text-plum-950">
                    {h.days}: {h.time}
                  </p>
                ))}
              </div>
            </div>
            <div className="glass flex items-center gap-4 rounded-2xl p-6">
              <MapPin className="h-6 w-6 text-teal-600" aria-hidden />
              <div>
                <p className="text-sm font-medium text-plum-600">Service area</p>
                <p className="font-display text-lg font-semibold leading-snug text-plum-950">
                  {site.serviceArea.join(" · ")}
                </p>
              </div>
            </div>
          </Reveal>
          <div className="space-y-10">
            <Reveal delay={0.1} className="rounded-3xl bg-white p-8 shadow-2xl shadow-plum-950/10">
              <div id="book" className="scroll-mt-28">
                <p className="eyebrow text-teal-700">Free consultation</p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-plum-950">
                  Book a free consultation call
                </h2>
                <p className="mt-2 text-sm leading-6 text-plum-700">
                  Pick a time and we&apos;ll call you to talk through your family&apos;s needs and
                  arrange your free care assessment.
                </p>
                <div className="mt-6">
                  <BookingFlow />
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.15} className="rounded-3xl bg-white p-8 shadow-2xl shadow-plum-950/10">
              <div id="send-a-message" className="scroll-mt-28">
                <h2 className="font-display text-2xl font-semibold text-plum-950">
                  Or send us a message
                </h2>
                <p className="mt-2 text-sm leading-6 text-plum-700">
                  Prefer to write? Tell us what you need and we&apos;ll call you back, usually the same day.
                </p>
                <div className="mt-6">
                  <ContactForm />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
