'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, List, SlidersHorizontal, Cable } from 'lucide-react';

const TABS = [
  { href: '/dashboard/phone',          label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/phone/calls',    label: 'Calls',    icon: List },
  { href: '/dashboard/phone/settings', label: 'Settings', icon: SlidersHorizontal },
  { href: '/dashboard/phone/setup',    label: 'Setup',    icon: Cable },
];

/** The Phone Assistant's own tab bar, styled like the board switcher. */
export default function PhoneTabs() {
  const pathname = usePathname();
  const active = TABS
    .map((t) => t.href)
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="border-b border-slate-200 bg-white px-5 sm:px-8">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Phone Assistant">
        {TABS.map((t) => {
          const on = t.href === active;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${
                on
                  ? 'border-teal-500 font-bold text-plum-950'
                  : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-plum-700'
              }`}
            >
              <t.icon className={`h-3.5 w-3.5 ${on ? 'text-teal-600' : 'text-slate-400'}`} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
