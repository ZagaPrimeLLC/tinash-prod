# Tinash CRM — setup and access

The site and the internal CRM are one Next.js app. The public pages live under
`src/app/(site)`; the team CRM lives under `src/app/(dashboard)/dashboard`,
gated by `src/proxy.ts` (Next 16's name for middleware) and Supabase magic-link
sign-in. Architecture is ported from the MMD project.

| Surface | Route | Who |
| :-- | :-- | :-- |
| Public website | `/` … | Families, caregivers |
| Team sign-in | `/login` (also "Team login" in the footer bottom bar) | Tinash team |
| CRM | `/dashboard` | Tinash team |
| Onboarding pack | `/welcome/<token>` | New hires (link sent by the office) |

Without Supabase env vars everything public still builds and runs: lead forms
fall back to `/api/inquiry` (Resend email or function logs), careers shows "no
openings listed right now", and `/login` / `/dashboard` show "CRM not connected".
In development, `/design-preview` shows the CRM with sample data.

## 1. Create the database

1. Create a **new** Supabase project.
2. Open **SQL Editor**, paste all of `supabase/bootstrap.sql`, and run it once.
   (It is the files in `supabase/migrations/` concatenated in order. With the
   Supabase CLI you can instead `supabase link` and `supabase db push`.)
3. **Project Settings → Data API → Exposed schemas**: add `proj_tinash`.

What it creates:

| Migration | Contents |
| :-- | :-- |
| `…000000_hub_bootstrap` | `hub.memberships`, `hub.is_member(text)` — team membership |
| `…000100_tinash_core_schema` | `proj_tinash` schema: team roles, profiles, recruitment, work board, contacts, public form tables, employees/training/onboarding, RLS, grants, starter boards |
| `…000200_jobs_and_intake` | Job posting fields, `_ingest_applicant`, CSV import, feed keys, `apply_to_job` |
| `…000300_team_and_profiles` | Invites, add/remove team members, avatars bucket, `hook_before_user_created` |
| `…000400_hardening` | Database rate limits on every public write, lead attribution |
| `…000500_rate_limit_fixes` | Race-free rate limiter, feed key 401s |
| `…000600_task_comments` | Comments on work items (append-only) |
| `…000700_board_blocked_stage` | "Blocked" column on the work board |
| `…000800_tinash_pipelines_and_onboarding` | `tinash-resumes` private bucket, `apply_general`, onboarding pack functions, first-admin SQL |

## 2. Environment variables

Set in `.env.local` locally and in Vercel → Project → Settings → Environment
Variables (Production, Preview, Development). See `.env.example`.

| Variable | Value |
| :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable (anon) key from Supabase → API keys |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `proj_tinash` |
| `NEXT_PUBLIC_SITE_URL` | optional; defaults to `https://tinashhomecareservices.com` |
| `RESEND_API_KEY`, `INQUIRY_TO`, `INQUIRY_FROM` | optional email notification for new leads |

No service-role key is used anywhere in the app.

## 3. Auth redirect URLs

Supabase → **Authentication → URL Configuration**:

- **Site URL**: the production URL (e.g. `https://tinashhomecareservices.com`).
- **Redirect URLs** — add all of:
  - `http://localhost:3000/auth/callback`
  - `https://<your-vercel-project>.vercel.app/auth/callback`
  - `https://*-<your-vercel-team>.vercel.app/auth/callback` (preview deployments)
  - `https://tinashhomecareservices.com/auth/callback`

Without these, the magic link bounces.

## 4. The first administrator

Nobody can get in until someone is an admin. In the SQL editor, run **one** of:

```sql
-- Before they ever sign in (recommended): applied automatically on first sign-in.
insert into proj_tinash.team_invites (email, role, job_title)
values (lower('owner@tinashhomecareservices.com'), 'admin', 'Owner');

-- Or, after they have signed in once and see "not on the Tinash team":
select proj_tinash._grant_team_role(u.id, 'admin', 'Owner')
  from auth.users u where lower(u.email) = lower('owner@tinashhomecareservices.com');
```

Everyone else is added from the CRM: **Settings → Team and access** (email +
role). An existing account joins immediately; anyone else gets an invite that
applies the first time they sign in.

Optional hardening, **after** the first admin exists: Authentication → Hooks →
Before User Created → Postgres → `proj_tinash.hook_before_user_created`. Then
only invited emails can create a login at all.

Roles: **admin** (everything, incl. team and roles), **ops** (runs boards,
pipelines, jobs, onboarding), **leadership** and **viewer** (read-only).

## 5. Reaching the CRM

1. Go to `/login` (or click **Team login** at the bottom of any page).
2. Enter your work email → open the magic link from your inbox.
3. You land on `/dashboard`.

Main areas: **Care inquiries** (family pipeline: New → Contacted → Assessment
Scheduled → Care Plan Sent → Client Started / Archived), **Inbox** (every
website message and consultation request), **Contacts**, **Jobs** (publish to
`/careers`), **Applicants** (caregiver pipeline: New → Phone Screen →
Interview Set → Checks & Paperwork → Hired / Archived), **Work board**,
**Employees / Onboarding / Training**, **Activity**, **Settings**.

## The PHI boundary

Employee/applicant PII and family contact details only — **no PHI, ever**.
There is no care-notes table and there must not be one; no diagnoses, care
plans or medications. Supabase without a BAA is not a place for health
information. Every public form and the chat assistant tell people not to send
medical details. Watch the free-text fields (`inquiries.message`,
`handoffs.case_info`, `screenings.notes`) and review them a month after launch.

## Things to confirm (TODO)

- Consultation availability: `site.consultation` in `src/lib/site.ts`
  (defaults to weekdays 10:00–16:00, 30-minute calls) and holidays in
  `src/lib/booking.ts`.
- Onboarding workflow steps (example commented in migration `…000800`).
- Onboarding document downloads: MMD used a Supabase edge function that was
  not in its repo, so `/welcome/<token>` lists documents without a download link.
