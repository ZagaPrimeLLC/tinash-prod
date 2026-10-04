"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { PhoneCall, ClipboardList, HeartHandshake } from "lucide-react";

const steps = [
  {
    icon: PhoneCall,
    title: "Call us — or we call you",
    body: "Tell us what's going on. Five minutes is enough for us to understand the situation and explain exactly how in-home care works, including DDD budgets.",
  },
  {
    icon: ClipboardList,
    title: "Free in-home assessment",
    body: "A care coordinator visits, meets your loved one, and builds a written care plan with your family — schedule, goals, preferences, and cost, in plain language.",
  },
  {
    icon: HeartHandshake,
    title: "Meet your matched caregiver",
    body: "We match on skills and personality, introduce the caregiver in person, and stay in touch with regular updates. Not the right fit? We re-match, no friction.",
  },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.6"],
  });
  const lineH = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className="relative mx-auto max-w-3xl">
      {/* progress line */}
      <div className="absolute left-6 top-2 bottom-2 w-px bg-plum-100 sm:left-7">
        <motion.div
          className="w-px bg-teal-500"
          style={{ height: reduce ? "100%" : lineH }}
        />
      </div>
      <ol className="space-y-14">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <motion.li
            key={title}
            initial={reduce ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="relative flex gap-6 pl-0"
          >
            <span className="glass z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md sm:h-14 sm:w-14">
              <Icon className="h-6 w-6 text-plum-600" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
                Step {i + 1}
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold text-plum-950">
                {title}
              </h3>
              <p className="mt-2 leading-7 text-plum-800/80">{body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
