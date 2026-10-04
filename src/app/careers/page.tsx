import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Caregiver Jobs in New Jersey",
  description:
    "Join Tinash Homecare Services — flexible schedules, real training, and clients matched to you. Apply in two minutes.",
};

const perks = [
  "Flexible schedules — choose cases that fit your life",
  "Paid training and real supervision, not sink-or-swim",
  "Clients matched to your skills and personality",
  "Growth into senior caregiver and coordinator roles",
  "A team that answers when you call",
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        kicker="Careers"
        title="Caregiving is a calling. We treat it like one."
        sub="CHHAs, DSPs, companions, and compassionate people ready to train — Tinash is hiring across New Jersey."
        image="/media/caregiver.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold text-pine-950">
              Why caregivers stay at Tinash
            </h2>
            <ul className="mt-6 grid gap-3">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-3 text-pine-900">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-gold-500"
                    aria-hidden
                  />
                  {p}
                </li>
              ))}
            </ul>
            <Image
              src="/media/companion.webp"
              alt="A caregiver sharing tea and a laugh with a client"
              width={900}
              height={675}
              className="mt-10 rounded-3xl object-cover shadow-xl shadow-pine-950/10"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="glass sticky top-24 rounded-3xl p-8">
              <h2 className="font-display text-2xl font-semibold text-pine-950">
                Apply in two minutes
              </h2>
              <p className="mb-6 mt-2 text-sm leading-6 text-pine-700">
                Tell us about yourself — we&apos;ll call you to talk roles,
                schedules, and next steps. Have a resume? You can share it when
                we reply.
              </p>
              <InquiryForm kind="careers" compact />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
