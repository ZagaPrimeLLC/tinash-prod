import { ShieldCheck, Clock, Users, HeartHandshake, BadgeCheck, HeartPulse } from "lucide-react";

const items = [
  { icon: HeartPulse, label: "Medicare GUIDE dementia program — with PocketRN", href: "/guide-dementia-care" },
  { icon: ShieldCheck, label: "Licensed NJ agency" },
  { icon: BadgeCheck, label: "NJ DDD services provider" },
  { icon: Users, label: "Trained, supervised W-2 caregivers" },
  { icon: Clock, label: "Care available around the clock" },
  { icon: HeartHandshake, label: "Care plans built with your family" },
];

export default function TrustBar() {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-10 pr-10">
      {items.map(({ icon: Icon, label, href }) =>
        href ? (
          <a
            key={label}
            href={href}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-full bg-teal-500/15 px-3 py-1 text-sm font-semibold text-plum-800 ring-1 ring-teal-500/40 transition-colors hover:bg-teal-500/25"
          >
            <Icon className="h-5 w-5 text-teal-700" aria-hidden />
            {label}
          </a>
        ) : (
          <span
            key={label}
            className="flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-plum-800"
          >
            <Icon className="h-5 w-5 text-plum-500" aria-hidden />
            {label}
          </span>
        )
      )}
    </div>
  );
  return (
    <div className="marquee overflow-hidden border-y border-plum-100 bg-mist-100 py-5">
      <div className="marquee-track flex w-max">{[row("a"), row("b")]}</div>
    </div>
  );
}
