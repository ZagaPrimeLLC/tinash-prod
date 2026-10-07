"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Phone, Menu, X, ChevronDown, Mail, ArrowRight } from "lucide-react";
import { site } from "@/lib/site";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // Desktop dropdown is state-driven (not :hover/:focus-within) so it closes
  // when a link is clicked — focus stays on the link after client navigation.
  const [submenu, setSubmenu] = useState(false);
  const pathname = usePathname();

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSubmenu(false);
    setOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Over the dark hero the menu reads as light-on-dark; once scrolled, the
  // glass bar is light, so switch to the full-color logo and dark text.
  const light = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        light
          ? "border-b border-white/60 bg-white/85 shadow-lg shadow-plum-950/5 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      {/* Announcement + utility bar; collapses once the page scrolls */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ${
          scrolled ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-plum-700 text-white">
            <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 sm:text-sm">
              <Link
                href="/guide-dementia-care"
                className="group flex min-w-0 items-center gap-2 font-medium"
              >
                <span className="shrink-0 rounded-full bg-teal-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-plum-950">
                  New
                </span>
                <span className="truncate">
                  Medicare GUIDE dementia care with PocketRN — at no cost for eligible families
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-teal-300 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <div className="hidden shrink-0 items-center gap-5 text-white/85 lg:flex">
                <a href={site.phoneHref} className="flex items-center gap-1.5 hover:text-teal-300">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {site.phone}
                </a>
                <a href={`mailto:${site.email}`} className="flex items-center gap-1.5 hover:text-teal-300">
                  <Mail className="h-3.5 w-3.5" aria-hidden /> {site.email}
                </a>
                {site.social.slice(0, 3).map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-teal-300">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="relative block h-10 w-[131px] shrink-0 sm:h-12 sm:w-[157px]"
          onClick={() => setOpen(false)}
          aria-label={`${site.name} — home`}
        >
          {/* Pre-sized WebP served as-is: /_next/image is a passthrough on
              Cloudflare, so the 800px PNGs would ship at full weight. */}
          <Image
            src="/brand/logo.webp"
            alt={site.name}
            fill
            priority
            unoptimized
            sizes="160px"
            className={`object-contain transition-opacity duration-300 ${
              light ? "opacity-100" : "opacity-0"
            }`}
          />
          <Image
            src="/brand/logo-white.webp"
            alt=""
            aria-hidden
            fill
            priority
            unoptimized
            sizes="160px"
            className={`object-contain drop-shadow-[0_1px_10px_rgba(28,15,54,0.6)] transition-opacity duration-300 ${
              light ? "opacity-0" : "opacity-100"
            }`}
          />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Main">
          {site.nav.map((item) =>
            "groups" in item ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setSubmenu(true)}
                onMouseLeave={() => setSubmenu(false)}
                onFocus={() => setSubmenu(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setSubmenu(false);
                }}
                onKeyDown={(e) => e.key === "Escape" && setSubmenu(false)}
              >
                <Link
                  href={item.href}
                  aria-expanded={submenu}
                  aria-haspopup="true"
                  onClick={() => setSubmenu(false)}
                  className={`flex items-center gap-1 text-sm font-semibold transition-colors ${
                    light
                      ? "text-plum-800 hover:text-teal-700"
                      : "text-white/90 hover:text-teal-300"
                  }`}
                >
                  {item.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${submenu ? "rotate-180" : ""}`} aria-hidden />
                </Link>
                <div
                  className={`absolute left-0 top-full w-[min(760px,calc(100vw-2rem))] -translate-x-1/4 pt-4 transition-all duration-200 ${
                    submenu ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-2 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-3 shadow-xl shadow-plum-950/10 backdrop-blur-xl">
                    {item.groups.map((g) => (
                      <div key={g.title} className="rounded-xl p-2">
                        <Link
                          href={g.href}
                          onClick={(e) => {
                            setSubmenu(false);
                            e.currentTarget.blur();
                          }}
                          className="eyebrow mb-1 px-2 py-1 text-[11px] text-plum-600 hover:text-teal-700"
                        >
                          {g.title}
                        </Link>
                        <ul>
                          {g.links.map((c) => (
                            <li key={c.href + c.label}>
                              <Link
                                href={c.href}
                                onClick={(e) => {
                                  setSubmenu(false);
                                  e.currentTarget.blur();
                                }}
                                className="block rounded-lg px-2 py-2 text-sm font-medium text-plum-900 transition-colors hover:bg-plum-50 hover:text-plum-600"
                              >
                                {c.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`text-sm font-semibold transition-colors ${
                  light
                    ? "text-plum-800 hover:text-teal-700"
                    : "text-white/90 hover:text-teal-300"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={site.phoneHref}
            className={`hidden items-center gap-2 text-sm font-semibold xl:flex ${
              light ? "text-plum-900" : "text-white"
            }`}
          >
            <Phone className={`h-4 w-4 ${light ? "text-teal-600" : "text-teal-400"}`} aria-hidden />
            {site.phone}
          </a>
          <Link
            href="/contact"
            className="whitespace-nowrap rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-plum-950 shadow-md transition-transform hover:scale-105 sm:px-4 sm:py-2 sm:text-sm"
          >
            <span className="sm:hidden">Free Assessment</span>
            <span className="hidden sm:inline">Free Care Assessment</span>
          </Link>
          <button
            className={`lg:hidden ${light ? "text-plum-900" : "text-white"}`}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100svh-72px)] overflow-y-auto border-t border-white/40 px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {site.nav.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className="block py-2 text-base font-semibold text-plum-900"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
                {"groups" in item &&
                  item.groups.map((g) => (
                    <div key={g.title} className="mb-2 ml-3 border-l border-plum-200 pl-3">
                      <p className="pt-1 text-xs font-bold uppercase tracking-wider text-teal-700">{g.title}</p>
                      <div className="flex flex-col">
                        {g.links.map((c) => (
                          <Link
                            key={c.href + c.label}
                            href={c.href}
                            className="py-1.5 text-sm font-medium text-plum-700"
                            onClick={() => setOpen(false)}
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ))}
            <a
              href={site.phoneHref}
              className="mt-2 flex items-center gap-2 py-1 font-semibold text-plum-900"
            >
              <Phone className="h-4 w-4 text-teal-600" aria-hidden /> {site.phone}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
