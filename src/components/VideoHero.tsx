"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Phone, Pause, Play, ArrowRight, HeartPulse, Users, Moon, Coffee, Sparkles, Stethoscope } from "lucide-react";
import { site } from "@/lib/site";

const chips = [
  { icon: HeartPulse, label: "GUIDE dementia care", href: "/guide-dementia-care" },
  { icon: Stethoscope, label: "Skilled nursing", href: "/services/skilled-nursing" },
  { icon: Coffee, label: "Companion care", href: "/services/companion-care" },
  { icon: Moon, label: "Live-in & 24/7", href: "/services/live-in-care" },
  { icon: Users, label: "Respite", href: "/services/respite-care" },
  { icon: Sparkles, label: "NJ DDD services", href: "/ddd-services" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.21, 0.6, 0.35, 1] as const },
  },
};

export default function VideoHero() {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [hasVideo, setHasVideo] = useState(true);

  useEffect(() => {
    if (reduce && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [reduce]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <section className="relative flex min-h-[92svh] items-end overflow-hidden bg-plum-700 [clip-path:ellipse(130%_100%_at_50%_0%)] sm:[clip-path:ellipse(95%_100%_at_50%_0%)]">
      {/* Background video with poster + Ken Burns fallback */}
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover brightness-110 saturate-110"
            src="/media/hero.mp4"
            poster="/media/hero-poster.webp"
            autoPlay={!reduce}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setHasVideo(false)}
            aria-hidden
          />
        ) : (
          <img
            src="/media/hero-poster.webp"
            alt=""
            className="kenburns h-full w-full object-cover"
            aria-hidden
          />
        )}
        {/* Light scrim: darkest only behind the text block (left/bottom) */}
        <div className="absolute inset-0 bg-gradient-to-r from-plum-900/60 via-plum-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-plum-900/55 to-transparent" />
      </div>

      <motion.div
        className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-48 sm:pb-32"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <motion.div variants={item} className="mb-4">
          <Link
            href="/guide-dementia-care"
            className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 py-1 pl-1 pr-4 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
          >
            <span className="rounded-full bg-teal-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-plum-950">
              New
            </span>
            Medicare GUIDE dementia care — now available
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </motion.div>
        <motion.h1
          variants={item}
          className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(28,15,54,0.55)] sm:text-6xl lg:text-7xl"
        >
          Care that lets your loved one{" "}
          <span className="text-teal-400">stay home.</span>
        </motion.h1>
        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-lg leading-8 text-mist-100/90"
        >
          Skilled nursing, companion care, live-in &amp; 24/7 support, respite,
          NJ DDD services, and Medicare GUIDE dementia support — delivered by trained, supervised caregivers who treat your
          family like their own.
        </motion.p>
        <motion.div variants={item} className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="rounded-full bg-teal-500 px-7 py-3.5 text-base font-semibold text-plum-950 shadow-xl shadow-teal-500/20 transition-transform hover:scale-105"
          >
            Get a Free Care Assessment
          </Link>
          <a
            href={site.phoneHref}
            className="glass-dark flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white transition-colors hover:border-teal-400/50"
          >
            <Phone className="h-5 w-5 text-teal-400" aria-hidden />
            {site.phone}
          </a>
        </motion.div>
        <motion.ul variants={item} className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
          {chips.map(({ icon: Icon, label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors hover:text-teal-300"
              >
                <Icon className="h-4 w-4 text-teal-300" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      {hasVideo && (
        <button
          onClick={toggle}
          className="glass-dark absolute bottom-28 right-8 z-10 sm:bottom-36 rounded-full p-3 text-white"
          aria-label={playing ? "Pause background video" : "Play background video"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}
