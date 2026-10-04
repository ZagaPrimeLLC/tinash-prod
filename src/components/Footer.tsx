import Link from "next/link";
import { site } from "@/lib/site";

const legal = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "HIPAA Notice of Privacy Practices", href: "/legal/hipaa-notice" },
  { label: "Nondiscrimination Notice", href: "/legal/nondiscrimination" },
  { label: "Accessibility", href: "/legal/accessibility" },
];

export default function Footer() {
  return (
    <footer className="bg-pine-950 text-cream-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <p className="font-display text-2xl font-semibold">
            Tinash<span className="text-gold-400"> Homecare</span>
          </p>
          <p className="mt-3 text-sm leading-6 text-cream-100/70">
            Skilled, compassionate in-home care for New Jersey families —
            because there&apos;s more to caring for people than just providing
            assistance.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-400">
            Visit
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-gold-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-400">
            Legal &amp; Compliance
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-gold-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-400">
            Talk to us
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={site.phoneHref} className="hover:text-gold-300">
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-gold-300">
                {site.email}
              </a>
            </li>
            <li className="pt-2 text-cream-100/70">
              Serving {site.serviceArea.slice(0, 3).join(", ")} and surrounding
              NJ communities. Available 24/7.
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5">
        <p className="mx-auto max-w-7xl text-xs leading-5 text-cream-100/60">
          © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          Tinash Homecare Services provides non-medical in-home care and
          NJ DDD supports. Content on this site is informational and is not
          medical advice.
        </p>
      </div>
    </footer>
  );
}
