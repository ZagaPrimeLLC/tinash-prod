"use client";

import { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

// TODO(Kzee): replace with real client testimonials (first name + NJ town).
const testimonials = [
  {
    quote:
      "The caregiver Tinash matched with my mother feels like part of our family now. Mom is safe, happy, and still in the home she loves.",
    name: "Adaeze O.",
    where: "Essex County, NJ",
  },
  {
    quote:
      "They explained our DDD budget better than anyone had in three years, then actually delivered the supports. My son looks forward to every visit.",
    name: "Michael R.",
    where: "Union County, NJ",
  },
  {
    quote:
      "Respite care gave me my first real rest in a year. Professional, punctual, and genuinely kind people.",
    name: "Grace T.",
    where: "Middlesex County, NJ",
  },
  {
    quote:
      "Live-in care meant Dad never spent a night alone after his fall. The communication with our family was constant and honest.",
    name: "Samuel K.",
    where: "Morris County, NJ",
  },
];

export default function Testimonials() {
  const reduce = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    reduce ? [] : [Autoplay({ delay: 6000, stopOnInteraction: true })]
  );
  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6">
          {testimonials.map((t) => (
            <motion.figure
              key={t.name}
              className="glass min-w-0 flex-[0_0_88%] rounded-3xl p-8 shadow-lg shadow-pine-950/5 sm:flex-[0_0_46%] lg:flex-[0_0_31%]"
              whileHover={reduce ? undefined : { y: -4 }}
            >
              <Quote className="h-8 w-8 text-gold-500" aria-hidden />
              <blockquote className="mt-4 leading-7 text-pine-900">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 text-sm font-semibold text-pine-700">
                {t.name} <span className="font-normal text-pine-500">· {t.where}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={prev}
          aria-label="Previous testimonial"
          className="rounded-full border border-pine-200 bg-white p-2.5 text-pine-700 transition-colors hover:border-gold-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          aria-label="Next testimonial"
          className="rounded-full border border-pine-200 bg-white p-2.5 text-pine-700 transition-colors hover:border-gold-400"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-pine-500">
        Sample testimonials shown for illustration until client reviews are
        published.
      </p>
    </div>
  );
}
