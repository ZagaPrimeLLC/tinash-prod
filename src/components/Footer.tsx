import Link from "next/link";
import Image from "next/image";
import { site } from "@/lib/site";
import NewsletterSignup from "@/components/site/NewsletterSignup";

const legal = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "HIPAA Notice of Privacy Practices", href: "/legal/hipaa-notice" },
  { label: "Nondiscrimination Notice", href: "/legal/nondiscrimination" },
  { label: "Accessibility", href: "/legal/accessibility" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-brand text-mist-100">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <Image
            src="/brand/logo-full-white.png"
            alt={site.name}
            width={1200}
            height={455}
            className="h-auto w-60"
          />
          <p className="mt-3 text-sm leading-6 text-mist-100/70">
            Skilled, compassionate in-home care for New Jersey families.
          </p>
          <div className="mt-6">
            <NewsletterSignup />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">
            Visit
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ...site.nav,
              { label: "GUIDE Program", href: "/guide-dementia-care" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-teal-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">
            Legal &amp; Compliance
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-teal-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-400">
            Talk to us
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={site.phoneHref} className="hover:text-teal-300">
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-teal-300">
                {site.email}
              </a>
            </li>
            <li>
              <a href={site.whatsappHref} className="hover:text-teal-300" target="_blank" rel="noopener noreferrer">
                WhatsApp us
              </a>
            </li>
            <li className="pt-2 text-mist-100/80">
              <span className="font-semibold text-white">Office hours</span>
              {site.hours.map((h) => (
                <span key={h.days} className="block">
                  {h.days}: {h.time}
                </span>
              ))}
            </li>
            <li className="flex flex-wrap gap-2 pt-2">
              {site.social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold transition-colors hover:border-teal-300 hover:text-teal-300"
                >
                  {s.label}
                </a>
              ))}
            </li>
            <li className="pt-2 text-mist-100/70">
              Serving {site.serviceArea.slice(0, 3).join(", ")} and surrounding
              NJ communities. Care available around the clock.
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <p className="max-w-4xl text-xs leading-5 text-mist-100/60">
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
            Tinash Homecare Services provides skilled nursing, in-home care, and
            NJ DDD supports. Content on this site is informational and is not
            medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
