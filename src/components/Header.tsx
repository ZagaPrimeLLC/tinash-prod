"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Phone, Menu, X } from "lucide-react";
import { site } from "@/lib/site";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-lg shadow-pine-950/5" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className={`font-display text-xl font-semibold tracking-tight ${
            scrolled ? "text-pine-900" : "text-white"
          }`}
          onClick={() => setOpen(false)}
        >
          Tinash<span className="text-gold-500"> Homecare</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors hover:text-gold-500 ${
                scrolled ? "text-pine-800" : "text-white/90"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={site.phoneHref}
            className={`hidden items-center gap-2 text-sm font-semibold sm:flex ${
              scrolled ? "text-pine-900" : "text-white"
            }`}
          >
            <Phone className="h-4 w-4 text-gold-500" aria-hidden />
            {site.phone}
          </a>
          <Link
            href="/contact"
            className="rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-pine-950 shadow-md transition-transform hover:scale-105"
          >
            Free Care Assessment
          </Link>
          <button
            className={`lg:hidden ${scrolled ? "text-pine-900" : "text-white"}`}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="glass border-t border-white/40 px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-1 text-base font-medium text-pine-900"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.phoneHref}
              className="flex items-center gap-2 py-1 font-semibold text-pine-900"
            >
              <Phone className="h-4 w-4 text-gold-500" aria-hidden /> {site.phone}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
