import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import Shell from '@/components/crm/Shell';
import { getSession } from '@/lib/crm/session';
import { supabaseConfigured } from '@/lib/supabase/env';
import NotConnected from '@/components/crm/NotConnected';

export const metadata = { title: 'Operations', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // No Supabase env vars: the proxy already sends visitors to /login, but if
  // this renders anyway (e.g. env removed mid-session) say so plainly.
  if (!supabaseConfigured) return <NotConnected />;

  const { email, role, failed, profile } = await getSession();

  // We could not ask the database at all. That is our fault, not the user's,
  // and telling them they lack access would send them chasing the wrong thing.
  if (failed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-mist-100 px-5">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <ShieldAlert className="h-8 w-8 text-red-500" />
          <h1 className="mt-4 font-display text-xl font-bold text-plum-950">We could not check your access</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            You are signed in as <strong className="text-plum-700">{email}</strong>. This is a fault on
            our side, not a problem with your account, so please do not request another sign in
            link. Try reloading in a moment.
          </p>
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
            {failed}
          </p>
        </div>
      </main>
    );
  }

  // Signed in, and the database says this account is on nobody's team.
  if (role === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-mist-100 px-5">
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
          <h1 className="mt-4 font-display text-xl font-bold text-plum-950">This account is not on the Tinash team</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            You are signed in as <strong className="text-plum-700">{email}</strong>, but that address has
            not been given access to the Tinash CRM yet. Ask the systems administrator to add it,
            then reload this page.
          </p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button className="text-sm font-semibold text-plum-700 underline">Sign out</button>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            <Link href="/" className="underline">Back to the website</Link>
          </p>
        </div>
      </main>
    );
  }

  return <Shell who={email} profile={profile} role={role}>{children}</Shell>;
}
