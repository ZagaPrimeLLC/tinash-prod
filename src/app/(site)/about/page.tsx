import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CTABanner from "@/components/site/CTABanner";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata("/about", {
  title: "About Us",
  description:
    "Tinash Homecare Services is a New Jersey in-home care agency delivering dignity-first companion, live-in, respite, and DDD care.",
});

const values = [
  {
    title: "Dignity first",
    body: "Every plan starts with who the person is — their routines, faith, food, and pride — not just what they need help with.",
  },
  {
    title: "Real employment, real training",
    body: "Our caregivers are trained and supervised employees, not gig workers. That's why families see the same faces, visit after visit.",
  },
  {
    title: "Plain language",
    body: "From DDD budgets to care plans and pricing, if we can't explain it simply, we rewrite it until we can.",
  },
  {
    title: "Show up, follow up",
    body: "Backup coverage means no missed shifts. Regular updates mean no surprises. Care is available around the clock.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        kicker="About Tinash"
        title="Care is a relationship, not a task list."
        sub="A New Jersey agency built by people who have run care operations for years — and believe families deserve better than the industry default."
        image="/media/hands.webp"
      />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold leading-tight text-plum-950">
              Our story
            </h2>
            <p className="mt-5 text-lg leading-8 text-plum-800/85">
              Tinash Homecare Services was founded on years of hands-on
              experience in New Jersey home care and community services —
              including supporting families navigating the NJ Division of
              Developmental Disabilities.
            </p>
            <p className="mt-4 text-lg leading-8 text-plum-800/85">
              We saw the same pattern everywhere: families handed jargon instead
              of answers, and caregivers treated as interchangeable. Tinash was
              built to be the opposite — a small, accountable team where
              caregivers are invested in and families always know who to call.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <Image
              src="/media/respite.webp"
              alt="A caregiver with a multigenerational family on a porch"
              width={900}
              height={675}
              className="rounded-3xl object-cover shadow-2xl shadow-plum-950/15"
            />
          </Reveal>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06} className="glass rounded-3xl p-8">
              <h3 className="font-display text-2xl font-semibold text-plum-950">
                {v.title}
              </h3>
              <p className="mt-3 leading-7 text-plum-800/85">{v.body}</p>
            </Reveal>
          ))}
        </div>

        <CTABanner
          className="mt-20"
          cta="about"
          title="Meet us in person — it's the best way to choose care."
          body={`Serving ${site.serviceArea.join(", ")} and surrounding communities.`}
        />
      </section>
    </>
  );
}
