import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';
import { supabaseConfigured } from '@/lib/supabase/env';

// Two ways a sign-in link can arrive:
//  - ?token_hash=…&type=email — what the Supabase email templates send. Verified
//    server-side, so the link works in any browser or device (e.g. opened from
//    the Gmail app on a phone).
//  - ?code=… — the PKCE flow. Only works in the same browser that requested the
//    link (it needs the code-verifier cookie). Kept as a fallback.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (supabaseConfigured && (tokenHash || code)) {
    const supabase = await createClient();
    const { error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type ?? 'email' })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error('[auth/callback] sign-in failed:', error.code ?? '', error.message);
  }
  return NextResponse.redirect(new URL('/login?error=link_expired', origin));
}
