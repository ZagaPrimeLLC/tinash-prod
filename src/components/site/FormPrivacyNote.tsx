import Link from 'next/link';
import { site } from '@/lib/site';

/**
 * Shown on every public form. It tells people what not to send us here (no
 * PHI: this system has no agreement covering health information) and where to
 * read what we do with what they do send.
 */
export default function FormPrivacyNote({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <p className={`rounded-xl border p-3 text-xs leading-relaxed ${dark ? 'border-white/20 bg-white/10 text-mist-100/80' : 'border-plum-100 bg-mist-100 text-plum-800/80'}`}>
      Please don&apos;t include medical details, a diagnosis, medications, or a Medicare or Medicaid
      number in this form. We&apos;ll discuss care needs privately by phone at{' '}
      <a href={site.phoneHref} className={`font-semibold underline ${dark ? 'text-white' : 'text-plum-700'}`}>
        {site.phone}
      </a>
      . We use what you send only to respond to you. Read our{' '}
      <Link href="/legal/privacy-policy" className={`font-semibold underline ${dark ? 'text-white' : 'text-plum-700'}`}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
