import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// The team CRM lives only on its own host (crm.tinashhomecareservices.com).
// The public site never links to it and behaves as if it does not exist:
// every CRM path answers 404 there. On the CRM host, public pages bounce back
// to the main site. Local dev and the staging worker serve both, for testing.
const PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tinashhomecareservices.com';

const CRM_PREFIXES = ['/dashboard', '/login', '/auth', '/welcome', '/design-preview', '/api/board-search', '/api/intake'];
// Assets and endpoints the CRM pages themselves need on the CRM host.
const CRM_HOST_ALLOWED = ['/_next', '/brand', '/media', '/icon', '/apple-icon', '/favicon', '/api/inquiry'];

// "/icon" matches "/icon.png", "/dashboard" matches "/dashboard/jobs", but
// "/dashboard" does not match "/dashboardx".
const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}.`));

type HostKind = 'crm' | 'public' | 'open';

function hostKind(host: string): HostKind {
  const h = host.toLowerCase();
  if (h.startsWith('crm.')) return 'crm';
  if (/^(localhost|127\.0\.0\.1|192\.168\.|\[::1\])/.test(h) || h.includes('-staging.')) return 'open';
  return 'public';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';

  // One canonical URL per page, in one hop: www.* goes to the bare domain and
  // a trailing slash is dropped (next.config.ts sets skipTrailingSlashRedirect
  // so old WordPress "/path/" redirects run first). API routes are left alone.
  const isWww = host.toLowerCase().startsWith('www.');
  const hasSlash = pathname !== '/' && pathname.endsWith('/') && !pathname.startsWith('/api/');
  if (isWww || hasSlash) {
    const path = hasSlash ? pathname.replace(/\/+$/, '') || '/' : pathname;
    const origin = isWww ? PUBLIC_ORIGIN : request.nextUrl.origin;
    return NextResponse.redirect(new URL(path + request.nextUrl.search, origin), 308);
  }

  const kind = hostKind(host);
  const isCrmPath = startsWithAny(pathname, CRM_PREFIXES);

  if (kind === 'public' && isCrmPath) {
    // Render the normal 404 page with a 404 status.
    return NextResponse.rewrite(new URL('/__not-found', request.url), { status: 404 });
  }

  if (kind === 'crm') {
    if (pathname === '/robots.txt') {
      return new NextResponse('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', request.url));
    if (!isCrmPath && !startsWithAny(pathname, CRM_HOST_ALLOWED)) {
      return NextResponse.redirect(new URL(pathname + request.nextUrl.search, PUBLIC_ORIGIN), 308);
    }
  }

  const response = pathname.startsWith('/dashboard') ? await gateDashboard(request) : NextResponse.next({ request });
  if (kind === 'crm' || isCrmPath) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/** Signed-out visitors to /dashboard go to /login on the same host. */
async function gateDashboard(request: NextRequest) {
  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  };

  // Not connected: nobody can be signed in, so the CRM is closed.
  if (!supabaseConfigured) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return toLogin();
  return response;
}

export const config = {
  // Everything except build assets and image optimisation, so the host rules
  // above see every page and API request.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
