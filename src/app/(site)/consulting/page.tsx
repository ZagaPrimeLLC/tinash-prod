import type { Metadata } from "next";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import InquiryForm from "@/components/InquiryForm";

export const metadata: Metadata = {
  title: "Homecare Agency Consulting",
  description:
    "Launch your own homecare agency with guidance from operators who've done it — entity setup, licensing, policies, staffing, and systems.",
};

const steps = [
  {
    title: "Foundation",
    body: "Entity formation, state registration and licensing pathway, insurance, and the compliance calendar you'll actually follow.",
  },
  {
    title: "Operations",
    body: "Policies & procedures, documentation templates, hiring and training systems, scheduling and billing workflows.",
  },
  {
    title: "Growth",
    body: "Branding, website, referral relationships, and the marketing playbook for your first clients and first hires.",
  },
];

export default function ConsultingPage() {
  return (
    <>
      <PageHero
        kicker="Tinash Consulting"
        title="Launch your homecare agency — with operators beside you."
        sub="From LLC to first client: licensing, policies, documentation, staffing, and systems from people who run an agency every day."
        image="/media/consulting.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="glass rounded-3xl p-8">
              <p className="font-display text-5xl font-semibold text-teal-500/60">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold text-plum-950">
                {s.title}
              </h2>
              <p className="mt-3 leading-7 text-plum-800/85">{s.body}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-16 grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <Image
              src="/media/consulting.webp"
              alt="A founder's desk with a laptop and notebook"
              width={960}
              height={540}
              className="rounded-3xl object-cover shadow-xl shadow-plum-950/10"
            />
            <p className="mt-6 max-w-xl leading-8 text-plum-800/85">
              Consulting engagements are practical and milestone-based. No
              guarantees of licensure are made — what we bring is the exact
              playbook, documents, and systems we use ourselves, adapted to your
              state and budget.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="glass rounded-3xl p-8">
            <h2 className="font-display text-2xl font-semibold text-plum-950">
              Tell us about your agency idea
            </h2>
            <div className="mt-5">
              <InquiryForm kind="consulting" compact />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
