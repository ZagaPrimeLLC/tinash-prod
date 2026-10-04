/**
 * The two pipelines the CRM runs. Keep these keys in sync with the check
 * constraints in supabase/migrations (applications.stage, inquiries.status).
 */

/** Caregiver applicants: from application to hired. */
export const STAGES = [
  { key: 'new',         label: 'New',                 hint: 'just applied' },
  { key: 'screening',   label: 'Phone Screen',        hint: 'qualification call' },
  { key: 'interview',   label: 'Interview Set',       hint: 'interview booked' },
  { key: 'checks',      label: 'Checks & Paperwork',  hint: 'background check, references, certifications' },
  { key: 'hired',       label: 'Hired',               hint: 'offer accepted, ready to onboard' },
  { key: 'archived',    label: 'Archived',            hint: 'not qualified / unresponsive' },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];
export const STAGE_KEYS = STAGES.map((s) => s.key) as readonly string[];
/** Stages that are finished, one way or the other. */
export const CLOSED_STAGES: readonly string[] = ['hired', 'archived'];

/** Care inquiries from families: from first contact to a started client. */
export const INQUIRY_STAGES = [
  { key: 'new',                  label: 'New',                   hint: 'from the website' },
  { key: 'contacted',            label: 'Contacted',             hint: 'first call made' },
  { key: 'assessment_scheduled', label: 'Assessment Scheduled',  hint: 'free care assessment booked' },
  { key: 'care_plan_sent',       label: 'Care Plan Sent',        hint: 'proposal with the family' },
  { key: 'client_started',       label: 'Client Started',        hint: 'care has begun' },
  { key: 'archived',             label: 'Archived',              hint: 'not a fit / no response' },
] as const;

export type InquiryStageKey = (typeof INQUIRY_STAGES)[number]['key'];
export const INQUIRY_STAGE_KEYS = INQUIRY_STAGES.map((s) => s.key) as readonly string[];
export const CLOSED_INQUIRY_STAGES: readonly string[] = ['client_started', 'archived'];

export const INQUIRY_TONE: Record<string, string> = {
  new:                  'bg-sky-100 text-sky-800 ring-sky-200',
  contacted:            'bg-amber-100 text-amber-900 ring-amber-200',
  assessment_scheduled: 'bg-plum-100 text-plum-800 ring-plum-200',
  care_plan_sent:       'bg-violet-100 text-violet-800 ring-violet-200',
  client_started:       'bg-emerald-100 text-emerald-800 ring-emerald-200',
  archived:             'bg-slate-100 text-slate-600 ring-slate-200',
};

export function inquiryStageLabel(key: string): string {
  return INQUIRY_STAGES.find((s) => s.key === key)?.label ?? key;
}

export const STALE_HOURS = 48;

export function isStale(lastContactAt: string | null, createdAt: string): boolean {
  const since = new Date(lastContactAt ?? createdAt).getTime();
  return Date.now() - since > STALE_HOURS * 3600 * 1000;
}
