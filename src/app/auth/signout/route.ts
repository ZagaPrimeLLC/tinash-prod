import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';

export async function POST(request: Request) {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
