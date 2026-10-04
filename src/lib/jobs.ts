/**
 * One job posting, as the CRM edits it and the Careers page shows it.
 * A post is public when it is published AND open; the database enforces the
 * same rule for anonymous visitors, so the two can never disagree.
 */
export type JobStatus = 'draft' | 'open' | 'paused' | 'closed';
export type EmploymentType = 'full_time' | 'part_time' | 'per_diem' | 'contract';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';
export type PayInterval = 'hour' | 'week' | 'year';

export type Job = {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  summary: string | null;
  description: string | null;
  requisition_id: string | null;
  employment_type: EmploymentType;
  experience: string | null;
  work_mode: WorkMode;
  benefits: string[];
  pay_min: number | null;
  pay_max: number | null;
  pay_interval: PayInterval;
  status: JobStatus;
  published: boolean;
  posted_at: string | null;
  closed_at: string | null;
  apply_url: string | null;
  careerplug_job_id: string | null;
  created_at: string;
  updated_at: string;
};

export const JOB_COLUMNS =
  'id, slug, title, location, summary, description, requisition_id, employment_type, experience, work_mode, benefits, pay_min, pay_max, pay_interval, status, published, posted_at, closed_at, apply_url, careerplug_job_id, created_at, updated_at';

export const STATUS_LABEL: Record<JobStatus, string> = {
  open: 'Active',
  draft: 'Draft',
  paused: 'Paused',
  closed: 'Closed',
};

export const STATUS_TONE: Record<JobStatus, string> = {
  open: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  paused: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-red-50 text-red-800 ring-red-200',
};

export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  per_diem: 'Per diem',
  contract: 'Contract',
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  onsite: 'In person',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

export const EXPERIENCE_OPTIONS = [
  'No experience needed',
  'Under 1 year',
  '1 to 2 years',
  '3 years or more',
];

/** Benefits that actually apply to caregiving work, not a generic office list. */
export const BENEFIT_PRESETS = [
  'Flexible schedule',
  'Paid training',
  'Paid time off',
  'Weekly pay',
  'Health insurance',
  'Dental insurance',
  'Vision insurance',
  '401(k)',
  'Mileage reimbursement',
  'Referral bonus',
  'Sign-on bonus',
  'Opportunity for advancement',
  'CPR and First Aid certification paid',
  'Employee discounts',
];

export const MAX_CUSTOM_BENEFITS = 10;

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });

const PER: Record<PayInterval, string> = { hour: '/hr', week: '/wk', year: '/yr' };

export function payLabel(j: Pick<Job, 'pay_min' | 'pay_max' | 'pay_interval'>): string | null {
  const { pay_min: lo, pay_max: hi, pay_interval: per } = j;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && lo !== hi) return `${money(lo)} – ${money(hi)}${PER[per]}`;
  return `${money((lo ?? hi) as number)}${PER[per]}`;
}

export function isPublic(j: Pick<Job, 'status' | 'published'>): boolean {
  return j.published && j.status === 'open';
}

/**
 * A readable address that never changes after the job is created, so links
 * shared on Facebook or in a text message keep working when the title is edited.
 */
export function makeSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  const tail = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  return `${base || 'job'}-${tail}`;
}

/** "3 days ago" in the words a job seeker would use. */
export function postedLabel(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export type Suggestion = { ok: boolean; text: string; why?: string };

/**
 * The same kind of nudges job boards give, tuned for caregiver postings. The
 * wording check matters most: an ad restricted to one sex is only lawful when
 * sex is a genuine occupational qualification, which needs a documented reason.
 */
const FLAGGED = [
  { re: /\b(fe)?males?\b|\b(wo)?m[ae]n only\b/i, why: 'Gender-specific wording. Only lawful when it is a genuine occupational qualification, such as a documented client preference for personal care.' },
  { re: /\byoung\b|\brecent grad/i, why: 'Age-related wording can read as age discrimination.' },
  { re: /\bnative (english|spanish) speaker\b/i, why: 'Say "fluent in" rather than "native speaker".' },
];

export function suggestionsFor(j: {
  title: string; description: string; summary: string; benefits: string[];
  pay_min: string | number | null; pay_max: string | number | null; location: string;
}): Suggestion[] {
  const text = `${j.title}\n${j.summary}\n${j.description}`;
  const flagged = FLAGGED.filter((f) => f.re.test(text));
  return [
    { ok: Boolean(j.pay_min || j.pay_max), text: 'Add a pay range or fixed rate', why: 'Required to publish: New Jersey requires pay on job postings.' },
    { ok: j.benefits.length >= 1, text: 'List the benefits', why: 'New Jersey also requires a general description of benefits for employers with 10 or more staff.' },
    { ok: j.summary.trim().length >= 40, text: 'Write a one or two sentence summary', why: 'It is what people see in the job list before they click.' },
    { ok: j.description.trim().length >= 300, text: 'Describe the role in at least a few paragraphs' },
    { ok: j.description.length <= 4000, text: 'Keep the description under 4,000 characters', why: 'Long posts lose people on a phone.' },
    { ok: j.location.trim().length > 0, text: 'Say where the work is' },
    ...(flagged.length
      ? flagged.map((f) => ({ ok: false, text: 'Review wording in the title or description', why: f.why }))
      : [{ ok: true, text: 'No problematic wording found' }]),
  ];
}
