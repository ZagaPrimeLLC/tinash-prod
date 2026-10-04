import { NextResponse, type NextRequest } from 'next/server';
import { anonClient } from '@/lib/supabase/anon';

/**
 * The automatic applicant feed. n8n, Zapier or a job board POSTs one applicant
 * (or a list of up to 100) with `Authorization: Bearer <key>`.
 *
 * This route holds no secrets and no special database rights: it forwards the
 * key and body to proj_tinash.intake_applicant(), which checks the key's hash,
 * matches duplicates and writes the rows. A wrong key gets nothing but a 401.
 */

const MAX_BYTES = 256 * 1024;


export async function POST(request: NextRequest) {
  const db = anonClient();
  if (!db) return NextResponse.json({ error: 'The applicant feed is not connected yet.' }, { status: 503 });

  const auth = request.headers.get('authorization') ?? '';
  const key = auth.replace(/^Bearer\s+/i, '').trim() || request.headers.get('x-intake-key')?.trim() || '';
  if (!key) {
    return NextResponse.json({ error: 'Missing key. Send Authorization: Bearer <key>.' }, { status: 401 });
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return NextResponse.json({ error: 'Body too large.' }, { status: 413 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'Body too large.' }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Send an applicant object or a list of them.' }, { status: 400 });
  }

  const { data, error } = await db.rpc('intake_applicant', { p_key: key, p_payload: body });

  if (error) {
    if (error.code === 'PT429') {
      const seconds = Number(/^retry_after=(\d+)$/.exec(error.hint ?? '')?.[1]);
      const retryAfter = Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 3600;
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
    if (error.code === '28000' || /invalid intake key/i.test(error.message)) {
      return NextResponse.json({ error: 'Invalid or revoked key.' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  return NextResponse.json({ ok: true, result: data }, { status: 201 });
}

export function GET() {
  return NextResponse.json(
    { error: 'POST applicants here with Authorization: Bearer <key>. See Settings → Automatic applicant feed.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
