import Link from "next/link";
import Image from "next/image";
import { ArrowRight, HeartPulse } from "lucide-react";
import Reveal from "@/components/Reveal";

// Homepage announcement for the GUIDE program. Copy from the
// "Tinash GUIDE Program Page — Website Copy" doc; keep the PocketRN framing.
export default function GuideAnnouncement() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 sm:pt-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-plum-500 via-plum-600 to-plum-700 p-8 shadow-2xl shadow-plum-950/25 sm:p-12">
          <Image
            src="/media/hands.webp"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-40 mix-blend-luminosity [mask-image:linear-gradient(to_left,black,transparent_70%)]"
          />
          <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-500/25 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-300/40 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-300 backdrop-blur">
                <HeartPulse className="h-4 w-4" aria-hidden /> New Medicare Program
              </p>
              <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                Dementia Care Support at No Cost Through Medicare
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-mist-100/85">
                Tinash Home Care Services is now a CMS-approved partner in
                Medicare&apos;s GUIDE dementia care program, in partnership with
                PocketRN. Families caring for a loved one with dementia can get a
                dedicated nurse, 24/7 support, caregiver training, and in-home
                respite care — covered by Medicare.
              </p>
            </div>
            <div className="glass-dark rounded-3xl p-6 sm:p-8">
              <ul className="grid gap-3 text-sm font-medium text-white">
                {[
                  "A dedicated nurse for your family",
                  "24/7 nurse lifeline",
                  "Caregiver training & support",
                  "In-home respite care",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-teal-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/guide-dementia-care"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-500 px-6 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-[1.02]"
              >
                Learn About the GUIDE Program <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
