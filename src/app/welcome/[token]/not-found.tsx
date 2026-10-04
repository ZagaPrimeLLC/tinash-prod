import Image from 'next/image';
import { Phone } from 'lucide-react';
import { site } from '@/lib/site';

export default function WelcomeNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-mist-100 px-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Image src={site.logo} alt={site.name} width={800} height={245} className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-xl font-bold text-plum-950">This link is not working</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          It may have expired, or the office may have issued you a newer one. Give us a call and we
          will send you a fresh link straight away.
        </p>
        <a
          href={site.phoneHref}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-3 text-sm font-bold text-plum-950 hover:bg-teal-400"
        >
          <Phone className="h-4 w-4" /> {site.phone}
        </a>
      </div>
    </main>
  );
}
