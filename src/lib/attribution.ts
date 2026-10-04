// First-touch attribution: where a visitor originally came from, kept in their
// own browser and attached to whatever form they eventually send. No cookie, no
// third party, nothing about the person, only the campaign tags and referrer.

const KEY = 'tinash_first_touch';
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type Attribution = Partial<Record<(typeof UTM)[number], string>> & {
  referrer?: string;
  landing_page?: string;
  first_seen?: string;
  gclid?: string;
  fbclid?: string;
};

const clip = (v: string | null | undefined, n = 200) => (v ? v.slice(0, n) : undefined);

/** Records the first visit, once. Later visits never overwrite it. */
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : '';
    const a: Attribution = {
      landing_page: clip(window.location.pathname, 300),
      first_seen: new Date().toISOString(),
      referrer: ref ? clip(new URL(ref).origin + new URL(ref).pathname, 300) : undefined,
      gclid: clip(params.get('gclid'), 120),
      fbclid: clip(params.get('fbclid'), 120),
    };
    for (const k of UTM) a[k] = clip(params.get(k));
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // Storage blocked (private mode): attribution is a nicety, never a blocker.
  }
}

/** What to save with a lead. Null when nothing is known. */
export function getAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === 'string' && v)) as Attribution;
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}

/** "google / cpc", "facebook.com", "direct": for showing in the inbox. */
export function sourceLabel(a: Attribution | null | undefined): string | null {
  if (!a) return null;
  if (a.utm_source) return [a.utm_source, a.utm_medium].filter(Boolean).join(' / ');
  if (a.gclid) return 'google ads';
  if (a.fbclid) return 'facebook';
  if (a.referrer) {
    try {
      return new URL(a.referrer).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
  return 'direct';
}
