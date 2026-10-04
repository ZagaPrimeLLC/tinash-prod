'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, ShieldCheck, Eye } from 'lucide-react';
import { navFor, canWrite, ROLE_LABELS, type Role } from '@/lib/crm/nav';
import { site } from '@/lib/site';
import Avatar from '@/components/crm/Avatar';
import type { Profile } from '@/lib/crm/session';

export default function Shell({
  who, profile, role, children,
}: { who: string; profile: Profile | null; role: Role | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sections = navFor(role);
  const writes = canWrite(role);
  // The most specific match wins, so /dashboard/recruitment/import lights up
  // "Import applicants" rather than "Applicants" as well.
  const activeHref = sections
    .flatMap((s) => s.items.map((i) => i.href))
    .filter((h) => (h === '/dashboard' ? pathname === h : pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];

  const nav = (
    <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
                        ? 'bg-white/15 font-semibold text-white'
                        : 'font-medium text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-teal-300' : 'text-white/50 group-hover:text-white/80'}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="border-b border-white/10 px-5 py-4">
      <Image src={site.logoWhite} alt={site.name} width={800} height={245} className="h-9 w-auto" />
      <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider text-teal-300">
        Operations CRM
      </span>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 px-4 py-4">
      <Link
        href="/dashboard/profile"
        onClick={() => setOpen(false)}
        title="Edit my profile"
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/10"
      >
        <Avatar name={profile?.display_name} email={who} url={profile?.avatar_url} size={36} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-xs font-semibold text-white">{profile?.display_name || who}</span>
          <span className="flex items-center gap-1 truncate text-[11px] text-white/50">
            {writes ? <ShieldCheck className="h-3 w-3 shrink-0" /> : <Eye className="h-3 w-3 shrink-0" />}
            {profile?.job_title || (role ? ROLE_LABELS[role] : 'No role')}
          </span>
        </span>
        <span className="text-[11px] font-semibold text-teal-300/80">Edit</span>
      </Link>
      <form action="/auth/signout" method="post" className="mt-3">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-mist-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-brand lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-plum-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-brand shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex-1">{brand}</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="mr-3 rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="lg:pl-[260px]">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-plum-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image src={site.logo} alt="" width={800} height={245} className="h-7 w-auto" />
          <span className="text-sm font-bold text-plum-700">Operations</span>
        </div>

        {children}
      </div>
    </div>
  );
}
