'use client';

import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { getAttribution } from '@/lib/attribution';

/**
 * One way in for every public lead form (inquiry, contact, chat assistant).
 *
 * The durable write goes straight from the browser to Supabase with the public
 * anon key: RLS allows INSERT only (no read-back), and the database rate limit
 * sees the visitor's real IP. Then /api/inquiry is pinged to send the optional
 * Resend email notification. If Supabase is not configured (or unreachable),
 * /api/inquiry receives the full lead instead and stores/emails/logs it.
 */
export type Lead = {
  name: string;
  phone?: string | null;
  email?: string | null;
  service?: string | null;
  message?: string | null;
  kind?: 'care' | 'consulting' | 'careers' | 'chat';
  cta?: string | null;
};

export type LeadResult = { ok: true } | { ok: false; reason: 'rate_limited' | 'failed' };

function ctaFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('cta')?.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || null;
  } catch {
    return null;
  }
}

async function relay(lead: Lead, stored: boolean, sourcePage: string): Promise<Response> {
  return fetch('/api/inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, kind: lead.kind ?? 'care', stored, source_page: sourcePage }),
    keepalive: true,
  });
}

export async function submitLead(lead: Lead): Promise<LeadResult> {
  const sourcePage = typeof window !== 'undefined' ? window.location.pathname.slice(0, 200) : null;
  const serviceInterested =
    lead.kind === 'consulting' ? 'consulting'
    : lead.kind === 'chat' ? 'chat-assistant'
    : lead.kind === 'careers' ? 'caregiver-application'
    : lead.service || 'Not sure yet';

  if (supabaseConfigured) {
    const { error } = await createClient().from('inquiries').insert({
      name: lead.name.trim().slice(0, 200),
      phone: lead.phone?.trim().slice(0, 40) || null,
      email: lead.email?.trim().slice(0, 200) || null,
      service_interested: serviceInterested,
      message: lead.message?.trim().slice(0, 4000) || null,
      source_page: sourcePage,
      cta: lead.cta ?? ctaFromUrl(),
      attribution: getAttribution(),
    });
    if (!error) {
      // Notification only; the lead is already safe in the database.
      relay(lead, true, sourcePage ?? '').catch(() => {});
      return { ok: true };
    }
    if (error.code === 'PT429') return { ok: false, reason: 'rate_limited' };
    // Fall through: let the server try (it also emails the office).
  }

  try {
    const res = await relay(lead, false, sourcePage ?? '');
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    return res.ok ? { ok: true } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
