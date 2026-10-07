import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

// Branded 404 for unknown URLs and notFound() in the public pages. It renders
// under the root layout only, so it brings the site header and footer itself.
// No robots metadata here: Next adds the single noindex tag for 404s.
export const metadata: Metadata = { title: "Page not found" };

const links = [
  { label: "Home care services", href: "/services", body: "Skilled nursing, companion, live-in and respite care." },
  { label: "NJ DDD services", href: "/ddd-services", body: "Individual Supports, Community-Based Supports and respite." },
  { label: "Contact us", href: "/contact", body: "Book a free care assessment or ask us anything." },
];

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="bg-brand pb-16 pt-40 text-white">
          <div className="mx-auto max-w-7xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">404 · Page not found</p>
            <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
              We couldn&apos;t find that page.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-mist-100/85">
              It may have moved when we updated our website. These will get you where you need to go.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-6 py-16">
          <ul className="grid gap-4 md:grid-cols-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group flex h-full flex-col rounded-3xl border border-plum-100 bg-white p-7 shadow-lg shadow-plum-950/5 transition-colors hover:border-teal-400"
                >
                  <span className="flex items-center gap-2 font-display text-xl font-semibold text-plum-950">
                    {l.label}
                    <ArrowRight className="h-4 w-4 text-teal-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-2 text-plum-800/85">{l.body}</span>
                </Link>
              </li>
            ))}
          </ul>
          <a href={site.phoneHref} className="mt-10 inline-flex items-center gap-2 font-semibold text-plum-700 hover:text-teal-700">
            <Phone className="h-4 w-4 text-teal-600" aria-hidden /> Or call us on {site.phone}
          </a>
        </section>
      </main>
      <Footer />
    </>
  );
}
