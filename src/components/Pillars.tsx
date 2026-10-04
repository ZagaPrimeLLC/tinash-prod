import { Home, HeartHandshake, Sprout } from "lucide-react";
import Reveal from "@/components/Reveal";

// "Comfort, Care, and Compassion" is the brand tagline from the Tinash logo.
const pillars = [
  { icon: Home, label: "Comfort", className: "bg-teal-500 text-white" },
  { icon: HeartHandshake, label: "Care", className: "bg-plum-600 text-white" },
  { icon: Sprout, label: "Compassion", className: "bg-plum-200 text-plum-800" },
];

export default function Pillars() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-24">
      <Reveal>
        <div className="flex justify-center gap-3 sm:gap-4">
          {pillars.map(({ icon: Icon, label, className }) => (
            <span
              key={label}
              className={`grid h-20 w-20 place-items-center rounded-full shadow-lg shadow-plum-950/10 sm:h-24 sm:w-24 ${className}`}
              title={label}
            >
              <Icon className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.6} aria-hidden />
            </span>
          ))}
        </div>
        <h2 className="mt-8 font-display text-4xl font-bold tracking-tight text-plum-950 sm:text-6xl">
          Comfort. Care. <span className="text-teal-600">Compassion.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-plum-800/85">
          Our mission is simple: optimal, personalized care that lets people
          live fully and safely in the comfort of their own homes. We work with
          clients, families, and healthcare providers to build care plans that
          promote independence, dignity, and well-being — bringing comfort,
          care, and compassion to your doorstep.
        </p>
      </Reveal>
    </section>
  );
}
