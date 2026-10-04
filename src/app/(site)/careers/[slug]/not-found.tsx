import Link from 'next/link';
import { site } from '@/lib/site';

export default function JobNotFound() {
  return (
    <section className="bg-mist-50 pb-24 pt-40">
      <div className="mx-auto max-w-xl px-5 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-teal-700">Careers</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-plum-950">This position is no longer open</h1>
        <p className="mt-4 leading-relaxed text-plum-800">
          It may have been filled or closed. We hire across New Jersey all the time, so have a look at what is open now.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/careers#openings" className="rounded-full bg-teal-500 px-6 py-3 font-semibold text-plum-950">
            See open positions
          </Link>
          <a href={site.phoneHref} className="rounded-full border-2 border-plum-600 px-6 py-3 font-semibold text-plum-700 hover:bg-plum-600 hover:text-white">
            Call {site.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
