import Link from 'next/link';
import Image from 'next/image';
import { PlugZap } from 'lucide-react';
import { site } from '@/lib/site';

/**
 * Shown on /login and the CRM when NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not
 * set. The public site keeps working; only the team CRM is unavailable.
 */
export default function NotConnected({ compact = false }: { compact?: boolean }) {
  const preview = process.env.NODE_ENV !== 'production';
  const body = (
    <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <PlugZap className="h-7 w-7 text-amber-600" aria-hidden />
      <h2 className="mt-3 font-display text-lg font-bold text-plum-950">The CRM is not connected yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        The database settings (<code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{' '}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_SCHEMA</code>) have not been added to this
        deployment, so team sign-in is switched off. The public website is unaffected. See{' '}
        <code className="text-xs">docs/CRM.md</code> for setup.
      </p>
      {preview && (
        <Link href="/design-preview" className="mt-4 inline-block text-sm font-semibold text-teal-700 underline">
          Open the CRM preview with sample data
        </Link>
      )}
    </div>
  );
  if (compact) return body;
  return (
    <main className="grid min-h-dvh place-items-center bg-mist-100 px-5">
      <div className="w-full max-w-md">
        <Image src={site.logo} alt={site.name} width={800} height={245} className="mx-auto mb-6 h-12 w-auto" />
        {body}
        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href="/" className="underline">Back to the website</Link>
        </p>
      </div>
    </main>
  );
}
