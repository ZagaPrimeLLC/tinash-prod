/**
 * The service options on every public inquiry form, and the allow-list the
 * /api/inquiry route and the database accept. One list, so they cannot drift.
 * (Mirrored by the inquiries_service_check constraint in supabase/migrations.)
 */
export const CARE_SERVICES = [
  'Not sure yet',
  // Medicare program
  'GUIDE Program',
  // Home care
  'Skilled Nursing',
  'Daily Senior Care',
  'Companion Care',
  'Live-In & 24/7 Care',
  'Respite Care',
  // NJ DDD services
  'DDD Services',
  'Individual Supports (DDD)',
  'Community-Based Supports (DDD)',
  'DDD Respite',
] as const;

/** Non-family values used internally by the site's own forms. */
export const INTERNAL_SOURCES = ['consulting', 'chat-assistant', 'caregiver-application'] as const;

export function isCareService(v: unknown): v is (typeof CARE_SERVICES)[number] {
  return typeof v === 'string' && (CARE_SERVICES as readonly string[]).includes(v);
}
