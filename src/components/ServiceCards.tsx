"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { services } from "@/lib/services";

export default function ServiceCards() {
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s, i) => (
        <motion.div
          key={s.slug}
          initial={reduce ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: i * 0.08 }}
          whileHover={reduce ? undefined : { y: -6 }}
          className="group relative overflow-hidden rounded-3xl bg-pine-950 shadow-lg shadow-pine-950/10"
        >
          <Image
            src={s.image}
            alt={s.name}
            width={700}
            height={525}
            className="h-56 w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="glass-dark absolute inset-x-4 bottom-4 rounded-2xl p-5 transition-colors group-hover:border-gold-400/50">
            <h3 className="font-display text-xl font-semibold text-white">
              {s.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-cream-100/85">
              {s.short}
            </p>
            <Link
              href={`/services/${s.slug}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300"
            >
              Learn more
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute inset-0" aria-hidden />
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
