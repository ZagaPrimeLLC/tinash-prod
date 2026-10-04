// Only same-origin paths, so the auth callback can never become an open redirect.
//
// Checking the raw string is not enough: URL parsing strips tabs and newlines and
// treats "\" like "/", so "/\t/example.org" becomes "//example.org". Anything with
// a control character or backslash is refused outright, and what remains must
// still resolve to this site once the browser's own parser has normalised it.
const PROBE = 'https://same-origin.invalid';

export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || next.length > 2048) return fallback;
  if (!next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;

  let url: URL;
  try {
    url = new URL(next, PROBE);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE || url.pathname.startsWith('//')) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
