import Image from 'next/image';

/** Initials from a name ("Kelvin Zee" -> "KZ"), or from an email's first part. */
export function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase();
  }
  return (email?.split('@')[0] ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'MM';
}

/** A team member's photo, or their initials on a teal disc. */
export default function Avatar({
  name, email, url, size = 36, muted = false, className = '',
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  url: string | null | undefined;
  size?: number;
  muted?: boolean;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        unoptimized
        style={style}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={`grid shrink-0 place-items-center rounded-full font-bold ${
        muted ? 'bg-slate-200 text-slate-500' : 'bg-teal-500 text-plum-950'
      } ${className}`}
    >
      {initialsFor(name, email)}
    </span>
  );
}
