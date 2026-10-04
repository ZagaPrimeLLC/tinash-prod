"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { services, serviceLines } from "@/lib/services";

type Slide = { name: string; short: string; image: string; href: string; badge?: string };

const slides: Slide[] = [
  {
    name: "GUIDE Dementia Program",
    short:
      "Medicare-covered dementia support with PocketRN: a dedicated nurse, a 24/7 lifeline, and in-home respite.",
    image: "/media/hands.webp",
    href: "/guide-dementia-care",
    badge: "New · Medicare",
  },
  ...services.map((s) => ({
    name: s.name,
    short: s.short,
    image: s.image,
    href: `/services/${s.slug}`,
    badge: s.line === "ddd" ? `NJ DDD · ${s.dddProgram}` : serviceLines[s.line].label,
  })),
];

const AUTOPLAY_MS = 4500;

// Shortest signed distance from the active slide, so the ring wraps.
function offsetOf(i: number, active: number, n: number) {
  let d = i - active;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

export default function ServiceCarousel() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);
  const n = slides.length;

  const go = useCallback((d: number) => setActive((a) => (a + d + n) % n), [n]);

  useEffect(() => {
    if (reduce || paused) return;
    const t = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [reduce, paused, go]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Our services"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      {/* Arc ribbon behind the cards */}
      <svg
        aria-hidden
        viewBox="0 0 1000 420"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-[4%] bottom-[12%] top-[4%] h-auto w-[92%] [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
      >
        <defs>
          <linearGradient id="arc" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#29beb9" />
            <stop offset="0.5" stopColor="#583092" />
            <stop offset="1" stopColor="#29beb9" />
          </linearGradient>
        </defs>
        <path
          d="M 60 420 A 440 380 0 0 1 940 420"
          fill="none"
          stroke="url(#arc)"
          strokeWidth="30"
          strokeLinecap="round"
        />
      </svg>

      <div
        className="relative mx-auto h-[300px] [perspective:1400px] sm:h-[380px] lg:h-[420px]"
        onPointerDown={(e) => (dragStart.current = e.clientX)}
        onPointerUp={(e) => {
          if (dragStart.current === null) return;
          const dx = e.clientX - dragStart.current;
          dragStart.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
        style={{ touchAction: "pan-y" }}
      >
        {slides.map((s, i) => {
          const o = offsetOf(i, active, n);
          const abs = Math.abs(o);
          const isActive = o === 0;
          return (
            <motion.div
              key={s.href}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${s.name}`}
              aria-hidden={!isActive}
              className="absolute left-1/2 top-0 h-full w-[78%] max-w-[620px] sm:w-[58%] lg:w-[46%]"
              initial={false}
              animate={{
                x: `calc(-50% + ${o * 96}%)`,
                rotateY: o === 0 ? 0 : o < 0 ? 24 : -24,
                scale: isActive ? 1 : 0.8,
                opacity: abs > 2 ? 0 : abs === 2 ? 0.55 : 1,
                zIndex: 10 - abs,
              }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30 }}
              style={{ transformStyle: "preserve-3d", pointerEvents: abs > 1 ? "none" : "auto" }}
            >
              <div className="group relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl shadow-plum-950/25">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 46vw, 78vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  draggable={false}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-plum-900/85 via-plum-900/20 to-transparent transition-opacity duration-500 ${
                    isActive ? "opacity-100" : "opacity-40"
                  }`}
                />
                {isActive ? (
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                    {s.badge && (
                      <span className="mb-3 inline-block rounded-full bg-teal-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-plum-950">
                        {s.badge}
                      </span>
                    )}
                    <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">{s.name}</h3>
                    <p className="mt-2 hidden max-w-md text-sm leading-6 text-white/90 sm:block">{s.short}</p>
                    <Link
                      href={s.href}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-plum-800 transition-transform hover:scale-105"
                    >
                      Learn more <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setActive(i)}
                    className="absolute inset-0 flex items-end p-6 text-left"
                    aria-label={`Show ${s.name}`}
                  >
                    <span className="font-display text-lg font-bold text-white drop-shadow">{s.name}</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="relative z-20 mt-8 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => go(-1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-plum-200 bg-white text-plum-700 shadow-sm transition-colors hover:border-teal-500 hover:text-teal-700"
          aria-label="Previous service"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.href}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Go to ${s.name}`}
              aria-current={i === active}
              className={`h-2.5 rounded-full transition-all ${
                i === active ? "w-8 bg-plum-600" : "w-2.5 bg-plum-200 hover:bg-teal-500"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          className="grid h-11 w-11 place-items-center rounded-full border border-plum-200 bg-white text-plum-700 shadow-sm transition-colors hover:border-teal-500 hover:text-teal-700"
          aria-label="Next service"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {slides[active].name}
      </p>
    </div>
  );
}
