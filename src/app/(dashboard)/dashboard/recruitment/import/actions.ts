'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ImportSummary = {
  rows: number;
  new_people: number;
  new_applications: number;
  already_there: number;
  no_job_match: number;
  errors: { row: number; error: string }[];
};

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

const FIELDS = [
  'name', 'first_name', 'last_name', 'email', 'phone', 'job_title', 'job_external_id',
  'location', 'applied_at', 'external_id', 'resume_url', 'notes',
] as const;

const BATCH = 500;

/**
 * Rows arrive already mapped to intake field names by the browser. The
 * database does the matching and the permission check (admin or ops), so this
 * only trims, caps and batches.
 */
export async function importApplicants(rows: Record<string, string>[], source: string): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'There are no rows to import.' };
  if (rows.length > 5000) return { ok: false, error: 'Import at most 5,000 rows at a time.' };

  const clean = rows.map((r) => {
    const o: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = typeof r[f] === 'string' ? r[f].trim().slice(0, f === 'notes' ? 4000 : 300) : '';
      if (v) o[f] = v;
    }
    return o;
  });

  const supabase = await createClient();
  const total: ImportSummary = { rows: 0, new_people: 0, new_applications: 0, already_there: 0, no_job_match: 0, errors: [] };

  for (let i = 0; i < clean.length; i += BATCH) {
    const { data, error } = await supabase.rpc('import_applicants', {
      p_rows: clean.slice(i, i + BATCH),
      p_source: source.trim().slice(0, 60) || 'Import',
    });
    if (error) return { ok: false, error: error.message };
    const s = data as ImportSummary;
    total.rows += s.rows;
    total.new_people += s.new_people;
    total.new_applications += s.new_applications;
    total.already_there += s.already_there;
    total.no_job_match += s.no_job_match;
    total.errors.push(...s.errors.map((e) => ({ ...e, row: e.row + i })));
  }

  revalidatePath('/dashboard/recruitment');
  revalidatePath('/dashboard/jobs');
  revalidatePath('/dashboard');
  return { ok: true, summary: total };
}
