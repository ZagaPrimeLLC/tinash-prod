import { ShieldCheck, Clock, Users, HeartHandshake, BadgeCheck } from "lucide-react";

const items = [
  { icon: ShieldCheck, label: "Licensed NJ agency" },
  { icon: BadgeCheck, label: "NJ DDD services provider" },
  { icon: Users, label: "Trained, supervised W-2 caregivers" },
  { icon: Clock, label: "Available 24/7, including holidays" },
  { icon: HeartHandshake, label: "Care plans built with your family" },
];

export default function TrustBar() {
  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-10 pr-10">
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-pine-800"
        >
          <Icon className="h-5 w-5 text-pine-500" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee border-y border-pine-100 bg-cream-100 py-5">
      <div className="marquee-track flex w-max">{[row("a"), row("b")]}</div>
    </div>
  );
}
