import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LoginForm from '@/components/LoginForm';
import NotConnected from '@/components/crm/NotConnected';
import { supabaseConfigured } from '@/lib/supabase/env';
import { site } from '@/lib/site';

export const metadata = { title: 'Team sign in', robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label={`${site.name} home`} className="mx-auto mb-6 block w-fit">
          <Image src={site.logoWhite} alt={site.name} width={800} height={245} priority className="h-12 w-auto" />
        </Link>
        {supabaseConfigured ? (
          <div className="rounded-2xl bg-white p-6 shadow-xl shadow-plum-950/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Team only</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-plum-950">Team sign in</h1>
            <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Loading&hellip;</p>}>
              <LoginForm />
            </Suspense>
          </div>
        ) : (
          <NotConnected compact />
        )}
        <p className="mt-6 text-center text-xs text-white/70">
          Looking for care? <Link href="/contact" className="font-semibold text-white underline">Contact us</Link>
        </p>
      </div>
    </main>
  );
}
