import Link from 'next/link';
import { Phone } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { site } from '@/lib/site';

/** Closing call to action for inner pages (the homepage has its own). */
export default function CTABanner({
  title = 'Ready to talk about care?',
  body = 'Book a free consultation call and we will help you work out the right support for your loved one.',
  cta = 'cta-banner',
  className = '',
}: { title?: string; body?: React.ReactNode; cta?: string; className?: string }) {
  return (
    <Reveal className={`relative overflow-hidden rounded-3xl bg-brand p-10 text-center ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="relative">
        <h2 className="font-display text-3xl font-semibold text-white">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-mist-100/85">{body}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/contact?cta=${encodeURIComponent(cta)}#book`}
            className="inline-flex items-center justify-center rounded-full bg-teal-500 px-7 py-3.5 font-semibold text-plum-950 shadow-lg transition-transform hover:scale-105"
          >
            Book a free consultation
          </Link>
          <a
            href={site.phoneHref}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-7 py-3.5 font-semibold text-white transition-colors hover:border-teal-300"
          >
            <Phone className="h-5 w-5" aria-hidden /> Call {site.phone}
          </a>
        </div>
      </div>
    </Reveal>
  );
}
