import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Gates /dashboard (Next 16's name for middleware). */
export async function proxy(request: NextRequest) {
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

export const config = { matcher: ['/dashboard/:path*'] };
