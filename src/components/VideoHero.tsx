"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Phone, Pause, Play } from "lucide-react";
import { site } from "@/lib/site";

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
    <section className="relative flex min-h-[92svh] items-end overflow-hidden bg-pine-950">
      {/* Background video with poster + Ken Burns fallback */}
      <div className="absolute inset-0">
        {hasVideo ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
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
        <div className="absolute inset-0 bg-gradient-to-t from-pine-950 via-pine-950/45 to-pine-950/20" />
      </div>

      <motion.div
        className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-40 sm:pb-28"
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <motion.p
          variants={item}
          className="mb-4 inline-block rounded-full border border-gold-400/40 bg-pine-950/40 px-4 py-1.5 text-sm font-medium tracking-wide text-gold-300 backdrop-blur"
        >
          Licensed in-home care across New Jersey
        </motion.p>
        <motion.h1
          variants={item}
          className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-white [text-shadow:0_2px_24px_rgba(8,31,27,0.55)] sm:text-6xl lg:text-7xl"
        >
          Care that lets your loved one{" "}
          <span className="text-gold-400">stay home.</span>
        </motion.h1>
        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-lg leading-8 text-cream-100/90"
        >
          Companion care, live-in &amp; 24/7 support, respite, and NJ DDD
          services — delivered by trained, supervised caregivers who treat your
          family like their own.
        </motion.p>
        <motion.div variants={item} className="mt-9 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="rounded-full bg-gold-500 px-7 py-3.5 text-base font-semibold text-pine-950 shadow-xl shadow-gold-500/20 transition-transform hover:scale-105"
          >
            Get a Free Care Assessment
          </Link>
          <a
            href={site.phoneHref}
            className="glass-dark flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white transition-colors hover:border-gold-400/50"
          >
            <Phone className="h-5 w-5 text-gold-400" aria-hidden />
            {site.phone}
          </a>
        </motion.div>
      </motion.div>

      {hasVideo && (
        <button
          onClick={toggle}
          className="glass-dark absolute bottom-6 right-6 z-10 rounded-full p-3 text-white"
          aria-label={playing ? "Pause background video" : "Play background video"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      )}
    </section>
  );
}
