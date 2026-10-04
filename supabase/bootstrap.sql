-- ═══════════════════════════════════════════════════════════════════════════
-- Tinash Homecare — Supabase bootstrap (all migrations, in order).
--
-- GENERATED from supabase/migrations/*.sql. Do not edit by hand; edit the
-- migration files and regenerate:
--   for f in supabase/migrations/*.sql; do echo "-- >>> $f"; cat "$f"; echo; done
--
-- Paste this whole file into the Supabase SQL editor of a NEW project and run
-- it once. Then:
--   1. Project Settings -> Data API -> Exposed schemas: add proj_tinash.
--   2. Add the first administrator (see section "e." near the end).
--   3. Optional: Authentication -> Hooks -> Before User Created ->
--      proj_tinash.hook_before_user_created (only invited emails can sign up).
-- See docs/CRM.md.
-- ═══════════════════════════════════════════════════════════════════════════

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000000_hub_bootstrap.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- ═══════════════════════════════════════════════════════════════════════════
-- 0. The `hub` schema: team membership, shared by every proj_* schema.
--
-- This is a brand-new Supabase project, so the hub that the MMD build relied on
-- does not exist yet. This creates exactly what the Tinash schema uses:
--
--   hub.memberships (project_slug, user_id, role)   who is on which team
--   hub.is_member(text) -> boolean                   "is the caller on this team?"
--
-- Membership answers *whether* someone is on the Tinash team. *What* they may
-- do (admin / ops / leadership / viewer) lives in proj_tinash.team_roles.
-- Rows here are only ever written by SECURITY DEFINER functions in
-- proj_tinash (add_team_member, claim_team_invite, remove_team_member) or by
-- the first-admin snippet run in the SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create schema if not exists hub;

create table if not exists hub.memberships (
  project_slug text        not null check (project_slug ~ '^[a-z0-9_]{2,40}$'),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  role         text        not null default 'member' check (role in ('member', 'owner')),
  created_at   timestamptz not null default now(),
  primary key (project_slug, user_id)
);

create index if not exists memberships_user on hub.memberships (user_id);

alter table hub.memberships enable row level security;

-- A signed-in person may see their own memberships, nothing else. No write
-- policies at all: membership changes only through definer functions.
drop policy if exists memberships_own_read on hub.memberships;
create policy memberships_own_read on hub.memberships
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on hub.memberships from public, anon, authenticated;
grant select on hub.memberships to authenticated;

create or replace function hub.is_member(p_project text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from hub.memberships m
     where m.project_slug = p_project
       and m.user_id = (select auth.uid())
  );
$$;

grant usage on schema hub to anon, authenticated, service_role;
revoke all on function hub.is_member(text) from public;
grant execute on function hub.is_member(text) to anon, authenticated, service_role;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000100_tinash_core_schema.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. proj_tinash core schema.
--
-- The MMD repo's migrations start from an existing "milestone 1" schema that
-- was created outside the repo. This file reconstructs that baseline for a
-- fresh project from how the application code and later migrations use it,
-- so the ported migrations that follow (jobs_and_intake, team_and_profiles,
-- hardening, rate_limit_fixes, task_comments, board_blocked_stage) apply on
-- top of it unchanged apart from the mmd -> tinash rename.
--
-- ACCESS MODEL (same as MMD):
--   * Team tables: readable by any Tinash team member; written by the roles
--     that run the business (admin, ops). Leadership and viewer are read-only,
--     which is what the CRM's "read only view" notices promise.
--   * Delete restricted to admin on applicants, applications, screenings,
--     handoffs (and inquiries/bookings/newsletter/job_posts).
--   * activity_log is append-only: no update or delete policy for anyone.
--   * Public form tables (inquiries, bookings, newsletter_subscribers): anon
--     may INSERT only, limited to safe columns. There is no anon SELECT policy,
--     so the public key can submit a form and cannot read a single row back.
--   * job_posts: anon may SELECT only published, open jobs.
--
-- PHI BOUNDARY: employee/applicant PII and family contact details only.
-- There is no care-notes table and there must not be one. No diagnoses,
-- care plans or medication anywhere. Watch the free-text columns
-- (handoffs.case_info, screenings.notes, inquiries.message).
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists proj_tinash;

grant usage on schema proj_tinash to anon, authenticated, service_role;

-- Tables created from here on (including by later migrations) are reachable
-- by signed-in users, with Row Level Security as the lock. anon gets nothing
-- by default; its few rights are granted table by table below.
alter default privileges in schema proj_tinash
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema proj_tinash
  grant all on tables to service_role;
alter default privileges in schema proj_tinash
  grant usage, select on sequences to authenticated, service_role;

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function proj_tinash.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Team: roles and profiles ──────────────────────────────────────────────

create table proj_tinash.team_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'ops', 'leadership', 'viewer')),
  job_title  text check (job_title is null or char_length(job_title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proj_tinash.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/** On the team AND holding one of the given roles. */
create or replace function proj_tinash.has_role(p_project text, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select hub.is_member(p_project)
     and exists (select 1 from proj_tinash.team_roles r
                  where r.user_id = (select auth.uid()) and r.role = any(p_roles));
$$;

/** The caller's role, or null when they are not on the team. Called by the app. */
create or replace function proj_tinash.tinash_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when hub.is_member('tinash')
              then coalesce((select r.role from proj_tinash.team_roles r where r.user_id = (select auth.uid())), 'viewer')
         end;
$$;

revoke all on function proj_tinash.has_role(text, text[]) from public;
revoke all on function proj_tinash.tinash_role() from public;
grant execute on function proj_tinash.has_role(text, text[]) to anon, authenticated;
grant execute on function proj_tinash.tinash_role() to authenticated;

-- Shorthands used in policies below.
create or replace function proj_tinash.is_team()
returns boolean language sql stable security definer set search_path = ''
as $$ select hub.is_member('tinash'); $$;

create or replace function proj_tinash.can_write()
returns boolean language sql stable security definer set search_path = ''
as $$ select proj_tinash.has_role('tinash', array['admin', 'ops']); $$;

create or replace function proj_tinash.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select proj_tinash.has_role('tinash', array['admin']); $$;

revoke all on function proj_tinash.is_team() from public;
revoke all on function proj_tinash.can_write() from public;
revoke all on function proj_tinash.is_admin() from public;
grant execute on function proj_tinash.is_team() to anon, authenticated;
grant execute on function proj_tinash.can_write() to anon, authenticated;
grant execute on function proj_tinash.is_admin() to anon, authenticated;

alter table proj_tinash.team_roles enable row level security;
alter table proj_tinash.profiles enable row level security;

create policy team_roles_member_read on proj_tinash.team_roles
  for select to authenticated using (proj_tinash.is_team());
-- Settings -> change a role. Adding and removing people goes through definer
-- functions (team_and_profiles migration), which also guard the last admin.
create policy team_roles_admin_update on proj_tinash.team_roles
  for update to authenticated using (proj_tinash.is_admin()) with check (proj_tinash.is_admin());

create policy profiles_member_read on proj_tinash.profiles
  for select to authenticated using (proj_tinash.is_team());
create policy profiles_own_write on proj_tinash.profiles
  for insert to authenticated with check (id = (select auth.uid()) and proj_tinash.is_team());
create policy profiles_own_update on proj_tinash.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and proj_tinash.is_team());

create trigger set_updated_at before update on proj_tinash.team_roles
  for each row execute function proj_tinash.set_updated_at();
create trigger set_updated_at before update on proj_tinash.profiles
  for each row execute function proj_tinash.set_updated_at();

-- ─── Activity log (append-only) ────────────────────────────────────────────

create table proj_tinash.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  verb        text not null check (char_length(verb) <= 200),
  entity_type text check (entity_type is null or char_length(entity_type) <= 60),
  entity_id   uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_log_time on proj_tinash.activity_log (created_at desc);

alter table proj_tinash.activity_log enable row level security;
create policy activity_log_member_read on proj_tinash.activity_log
  for select to authenticated using (proj_tinash.is_team());
create policy activity_log_member_append on proj_tinash.activity_log
  for insert to authenticated
  with check (proj_tinash.is_team() and (actor_id is null or actor_id = (select auth.uid())));
-- No update or delete policy for anyone, and no grant either.
revoke update, delete, truncate on proj_tinash.activity_log from authenticated;

-- ─── Staffing cases (staffing facts only — never an individual's health) ───

create table proj_tinash.cases (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (char_length(code) <= 40),
  town           text check (town is null or char_length(town) <= 120),
  schedule       text check (schedule is null or char_length(schedule) <= 300),
  hours_per_week numeric(5,1) check (hours_per_week is null or hours_per_week between 0 and 168),
  status         text not null default 'open' check (status in ('open', 'staffed', 'closed')),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── Recruitment ───────────────────────────────────────────────────────────
-- job_posts starts with its original columns; the jobs_and_intake migration
-- adds the posting fields (slug, description, pay, ...).

create table proj_tinash.job_posts (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) <= 120),
  location          text check (location is null or char_length(location) <= 120),
  status            text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  published         boolean not null default false,
  posted_at         timestamptz,
  careerplug_job_id text check (careerplug_job_id is null or char_length(careerplug_job_id) <= 60),
  apply_url         text check (apply_url is null or apply_url ~* '^https://'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table proj_tinash.applicants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) <= 200),
  email         text check (email is null or char_length(email) <= 200),
  phone         text check (phone is null or char_length(phone) <= 40),
  source        text check (source is null or char_length(source) <= 60),
  -- the job board's own id for this person (CareerPlug, Indeed, ...)
  careerplug_id text check (careerplug_id is null or char_length(careerplug_id) <= 120),
  about         text check (about is null or char_length(about) <= 4000),
  -- a path in the private tinash-resumes bucket, or an external link
  resume_url    text check (resume_url is null or char_length(resume_url) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index applicants_email on proj_tinash.applicants (lower(email));

-- Stages: keep in sync with src/lib/pipeline.ts (STAGES).
create table proj_tinash.applications (
  id                uuid primary key default gen_random_uuid(),
  applicant_id      uuid not null references proj_tinash.applicants(id) on delete cascade,
  job_post_id       uuid references proj_tinash.job_posts(id) on delete set null,
  stage             text not null default 'new'
                    check (stage in ('new', 'screening', 'interview', 'checks', 'hired', 'archived')),
  qualified         boolean not null default false,
  ready             boolean not null default false,
  score             int check (score is null or score between 0 and 100),
  owner_id          uuid references auth.users(id) on delete set null,
  last_contact_at   timestamptz,
  contact_attempts  int not null default 0 check (contact_attempts >= 0),
  archive_reason    text check (archive_reason is null or char_length(archive_reason) <= 300),
  screening_answers jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(screening_answers) = 'object' and pg_column_size(screening_answers) < 8000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index applications_applicant on proj_tinash.applications (applicant_id);
create index applications_job on proj_tinash.applications (job_post_id);

create table proj_tinash.screenings (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references proj_tinash.applications(id) on delete cascade,
  outcome        text check (outcome is null or outcome in ('pass', 'fail', 'no_answer', 'rescheduled')),
  -- Free text: availability and qualifications only. Never health information.
  notes          text check (notes is null or char_length(notes) <= 2000),
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table proj_tinash.handoffs (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references proj_tinash.applications(id) on delete cascade,
  case_id        uuid references proj_tinash.cases(id) on delete set null,
  coordinator_id uuid references auth.users(id) on delete set null,
  -- Free text: schedule and logistics only. Never an individual's health.
  case_info      text check (case_info is null or char_length(case_info) <= 2000),
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ─── Work board ────────────────────────────────────────────────────────────

create table proj_tinash.boards (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 40),
  name        text not null check (char_length(name) <= 80),
  description text check (description is null or char_length(description) <= 400),
  visible_to  text[] not null default array['admin', 'ops']
              check (visible_to <@ array['admin', 'ops', 'leadership', 'viewer'] and 'admin' = any(visible_to)),
  position    int not null default 100,
  archived    boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The board_blocked_stage migration widens the stage check with 'blocked'.
create table proj_tinash.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 200),
  notes        text check (notes is null or char_length(notes) <= 4000),
  stage        text not null default 'backlog' check (stage in ('backlog', 'todo', 'in_progress', 'review', 'done')),
  status       text not null default 'open' check (status in ('open', 'done')),
  work_type    text not null default 'task'
               check (work_type in ('epic', 'story', 'task', 'todo', 'issue', 'bug', 'milestone')),
  priority     text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  position     bigint not null default 0,
  labels       text[] not null default '{}',
  owner_id     uuid references auth.users(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  due_at       timestamptz,
  completed_at timestamptz,
  linked_type  text check (linked_type is null or linked_type in ('inquiry', 'application', 'booking', 'case')),
  linked_id    uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_owner on proj_tinash.tasks (owner_id);
create index tasks_linked on proj_tinash.tasks (linked_type, linked_id);

create table proj_tinash.board_items (
  board_id   uuid not null references proj_tinash.boards(id) on delete cascade,
  task_id    uuid not null references proj_tinash.tasks(id) on delete cascade,
  position   bigint not null default 0,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, task_id)
);
create index board_items_task on proj_tinash.board_items (task_id);

-- Generic comments (entity_type + entity_id). Append-only.
create table proj_tinash.comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (char_length(entity_type) <= 60),
  entity_id   uuid not null,
  author_id   uuid default auth.uid() references auth.users(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index comments_entity on proj_tinash.comments (entity_type, entity_id, created_at desc);

/** How many cards would vanish from every board if this board were archived. */
create or replace function proj_tinash.board_strands_cards(p_board uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when proj_tinash.has_role('tinash', array['admin', 'ops']) then (
    select count(*)::int from proj_tinash.board_items bi
     where bi.board_id = p_board
       and not exists (select 1 from proj_tinash.board_items o
                        where o.task_id = bi.task_id and o.board_id <> p_board)
  ) else 0 end;
$$;
revoke all on function proj_tinash.board_strands_cards(uuid) from public, anon;
grant execute on function proj_tinash.board_strands_cards(uuid) to authenticated;

-- ─── Families: contacts and the public forms ───────────────────────────────

-- Stage keys: keep in sync with src/lib/pipeline.ts (INQUIRY_STAGES).
create table proj_tinash.contacts (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (char_length(full_name) <= 200),
  email        text check (email is null or char_length(email) <= 200),
  phone        text check (phone is null or char_length(phone) <= 40),
  kind         text not null default 'family' check (kind in ('family', 'applicant', 'other')),
  status       text not null default 'new'
               check (status in ('new', 'contacted', 'assessment_scheduled', 'care_plan_sent', 'client_started', 'archived')),
  first_source text check (first_source is null or char_length(first_source) <= 200),
  first_cta    text check (first_cta is null or char_length(first_cta) <= 40),
  touches      int not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index contacts_email on proj_tinash.contacts (lower(email));
create index contacts_phone on proj_tinash.contacts (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10));

create table proj_tinash.inquiries (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 200),
  email              text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone              text check (phone is null or char_length(phone) <= 40),
  -- The services on the site's forms (src/lib/care-services.ts) plus the
  -- site's own internal sources.
  service_interested text check (service_interested is null or service_interested in (
                       'Not sure yet', 'GUIDE Program', 'Skilled Nursing', 'Daily Senior Care',
                       'Companion Care', 'Live-In & 24/7 Care', 'Respite Care', 'DDD Services',
                       'Individual Supports (DDD)', 'Community-Based Supports (DDD)', 'DDD Respite',
                       'consulting', 'chat-assistant', 'caregiver-application')),
  message            text check (message is null or char_length(message) <= 4000),
  source_page        text check (source_page is null or char_length(source_page) <= 200),
  cta                text check (cta is null or char_length(cta) <= 40),
  status             text not null default 'new'
                     check (status in ('new', 'contacted', 'assessment_scheduled', 'care_plan_sent', 'client_started', 'archived')),
  owner_id           uuid references auth.users(id) on delete set null,
  handled_at         timestamptz,
  contact_id         uuid references proj_tinash.contacts(id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint inquiries_reachable check (email is not null or phone is not null)
);
create index inquiries_time on proj_tinash.inquiries (created_at desc);

create table proj_tinash.bookings (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 200),
  email          text check (email is null or (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone          text check (phone is null or char_length(phone) <= 40),
  requested_slot timestamptz,
  notes          text check (notes is null or char_length(notes) <= 800),
  status         text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  cta            text check (cta is null or char_length(cta) <= 40),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint bookings_reachable check (email is not null or phone is not null)
);
create index bookings_slot on proj_tinash.bookings (requested_slot);

create table proj_tinash.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index newsletter_email_key on proj_tinash.newsletter_subscribers (lower(email));

/**
 * One person, however many times they reach out: match an inquiry to an
 * existing contact by email, then by the last ten phone digits.
 */
create or replace function proj_tinash.link_inquiry_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact uuid;
  v_digits  text := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);
  v_kind    text := case when new.service_interested = 'caregiver-application' then 'applicant'
                         when new.service_interested = 'consulting' then 'other'
                         else 'family' end;
begin
  if new.email is not null then
    select id into v_contact from proj_tinash.contacts
     where lower(email) = lower(new.email) order by created_at limit 1;
  end if;
  if v_contact is null and length(v_digits) = 10 then
    select id into v_contact from proj_tinash.contacts
     where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_digits
     order by created_at limit 1;
  end if;

  if v_contact is null then
    insert into proj_tinash.contacts (full_name, email, phone, kind, first_source, first_cta)
    values (new.name, new.email, new.phone, v_kind, coalesce(new.source_page, 'website'), new.cta)
    returning id into v_contact;
  else
    update proj_tinash.contacts
       set touches = touches + 1, last_seen_at = now(), updated_at = now(),
           email = coalesce(email, new.email), phone = coalesce(phone, new.phone)
     where id = v_contact;
  end if;

  new.contact_id := v_contact;
  return new;
end;
$$;
revoke all on function proj_tinash.link_inquiry_contact() from public, anon, authenticated;

-- Fires after limit_public_insert (hardening migration): triggers run in name order.
create trigger link_contact before insert on proj_tinash.inquiries
  for each row execute function proj_tinash.link_inquiry_contact();

-- ─── People: employees, training, onboarding ───────────────────────────────

create table proj_tinash.employees (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (char_length(full_name) <= 120),
  email      text check (email is null or char_length(email) <= 200),
  phone      text check (phone is null or char_length(phone) <= 40),
  job_title  text not null default 'Caregiver' check (char_length(job_title) <= 120),
  employment text not null default 'onboarding'
             check (employment in ('applicant', 'offer', 'onboarding', 'active', 'inactive')),
  start_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Record the training and whether it is done — never a medical result.
create table proj_tinash.trainings (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid references proj_tinash.employees(id) on delete cascade,
  name         text not null check (char_length(name) <= 120),
  provider     text check (provider is null or char_length(provider) <= 120),
  status       text not null default 'assigned' check (status in ('assigned', 'in_progress', 'complete', 'expired')),
  completed_on date,
  expires_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table proj_tinash.workflows (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) <= 120),
  summary    text check (summary is null or char_length(summary) <= 600),
  kind       text not null default 'onboarding' check (kind in ('onboarding', 'training', 'other')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proj_tinash.workflow_steps (
  id          uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references proj_tinash.workflows(id) on delete cascade,
  position    int not null,
  title       text not null check (char_length(title) <= 200),
  body        text check (body is null or char_length(body) <= 4000),
  owner_side  text not null default 'hire' check (owner_side in ('hire', 'office')),
  created_at  timestamptz not null default now(),
  unique (workflow_id, position)
);

-- Metadata for onboarding documents. (The MMD download edge function was not
-- part of the source repo, so the welcome page lists documents without a
-- download link for now — see docs/CRM.md.)
create table proj_tinash.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 200),
  description text check (description is null or char_length(description) <= 400),
  path        text not null check (char_length(path) <= 500),
  mime        text,
  size        bigint,
  created_at  timestamptz not null default now()
);

create table proj_tinash.workflow_step_documents (
  step_id     uuid not null references proj_tinash.workflow_steps(id) on delete cascade,
  document_id uuid not null references proj_tinash.documents(id) on delete cascade,
  primary key (step_id, document_id)
);

create table proj_tinash.assignments (
  id             uuid primary key default gen_random_uuid(),
  workflow_id    uuid not null references proj_tinash.workflows(id) on delete restrict,
  employee_id    uuid not null references proj_tinash.employees(id) on delete cascade,
  status         text not null default 'draft' check (status in ('draft', 'sent', 'in_progress', 'complete', 'revoked')),
  due_on         date,
  -- The link's only credential. A draft pack returns nothing to the portal.
  token          text not null unique
                 default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  expires_at     timestamptz not null default now() + interval '30 days',
  sent_at        timestamptz,
  open_count     int not null default 0,
  last_opened_at timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── updated_at maintenance ────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['cases', 'job_posts', 'applicants', 'applications', 'boards', 'tasks',
                           'contacts', 'bookings', 'employees', 'trainings', 'workflows', 'assignments']
  loop
    execute format('create trigger set_updated_at before update on proj_tinash.%I
                    for each row execute function proj_tinash.set_updated_at()', t);
  end loop;
end $$;

-- ─── Row Level Security ────────────────────────────────────────────────────

do $$
declare t text;
begin
  -- Team tables: member read, admin/ops write.
  foreach t in array array['cases', 'job_posts', 'applicants', 'applications', 'screenings', 'handoffs',
                           'contacts', 'employees', 'trainings', 'workflows', 'workflow_steps',
                           'documents', 'workflow_step_documents', 'assignments']
  loop
    execute format('alter table proj_tinash.%I enable row level security', t);
    execute format('create policy %I on proj_tinash.%I for select to authenticated using (proj_tinash.is_team())',
                   t || '_member_read', t);
    execute format('create policy %I on proj_tinash.%I for insert to authenticated with check (proj_tinash.can_write())',
                   t || '_team_insert', t);
    execute format('create policy %I on proj_tinash.%I for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write())',
                   t || '_team_update', t);
  end loop;

  -- Delete: administrators only where a mistake would lose a person's record.
  foreach t in array array['applicants', 'applications', 'screenings', 'handoffs', 'job_posts', 'contacts', 'employees']
  loop
    execute format('create policy %I on proj_tinash.%I for delete to authenticated using (proj_tinash.is_admin())',
                   t || '_admin_delete', t);
  end loop;
  foreach t in array array['cases', 'trainings', 'workflows', 'workflow_steps', 'documents',
                           'workflow_step_documents', 'assignments']
  loop
    execute format('create policy %I on proj_tinash.%I for delete to authenticated using (proj_tinash.can_write())',
                   t || '_team_delete', t);
  end loop;
end $$;

-- Screenings/handoffs/comments are append-style records: no update by anyone
-- except the policy above (admin/ops); comments have no update or delete at all.
alter table proj_tinash.comments enable row level security;
create policy comments_member_read on proj_tinash.comments
  for select to authenticated using (proj_tinash.is_team());
create policy comments_team_add on proj_tinash.comments
  for insert to authenticated
  with check (proj_tinash.can_write() and author_id = (select auth.uid()));
revoke update, delete, truncate on proj_tinash.comments from authenticated;

-- Boards: a board is visible to the roles in visible_to (admin always).
alter table proj_tinash.boards enable row level security;
create policy boards_role_read on proj_tinash.boards
  for select to authenticated using (proj_tinash.tinash_role() = any(visible_to));
create policy boards_team_insert on proj_tinash.boards
  for insert to authenticated with check (proj_tinash.can_write());
create policy boards_team_update on proj_tinash.boards
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());
-- Boards are archived, never deleted (no delete policy).

alter table proj_tinash.board_items enable row level security;
create policy board_items_read on proj_tinash.board_items
  for select to authenticated
  using (exists (select 1 from proj_tinash.boards b where b.id = board_items.board_id));
create policy board_items_team_insert on proj_tinash.board_items
  for insert to authenticated with check (proj_tinash.can_write());
create policy board_items_team_update on proj_tinash.board_items
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());
create policy board_items_team_delete on proj_tinash.board_items
  for delete to authenticated using (proj_tinash.can_write());

-- Tasks: admin/ops see every card; others see cards on a board their role can open.
alter table proj_tinash.tasks enable row level security;
create policy tasks_read on proj_tinash.tasks
  for select to authenticated
  using (proj_tinash.can_write()
         or exists (select 1 from proj_tinash.board_items bi
                     join proj_tinash.boards b on b.id = bi.board_id
                    where bi.task_id = tasks.id));
create policy tasks_team_insert on proj_tinash.tasks
  for insert to authenticated with check (proj_tinash.can_write());
create policy tasks_team_update on proj_tinash.tasks
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());
create policy tasks_team_delete on proj_tinash.tasks
  for delete to authenticated using (proj_tinash.can_write());

-- Public form tables: anon (and any signed-in visitor) may INSERT only.
alter table proj_tinash.inquiries enable row level security;
alter table proj_tinash.bookings enable row level security;
alter table proj_tinash.newsletter_subscribers enable row level security;

create policy inquiries_public_insert on proj_tinash.inquiries
  for insert to anon, authenticated with check (true);
create policy inquiries_member_read on proj_tinash.inquiries
  for select to authenticated using (proj_tinash.is_team());
create policy inquiries_team_update on proj_tinash.inquiries
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());
create policy inquiries_admin_delete on proj_tinash.inquiries
  for delete to authenticated using (proj_tinash.is_admin());

create policy bookings_public_insert on proj_tinash.bookings
  for insert to anon, authenticated with check (true);
create policy bookings_member_read on proj_tinash.bookings
  for select to authenticated using (proj_tinash.is_team());
create policy bookings_team_update on proj_tinash.bookings
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());
create policy bookings_admin_delete on proj_tinash.bookings
  for delete to authenticated using (proj_tinash.is_admin());

create policy newsletter_public_insert on proj_tinash.newsletter_subscribers
  for insert to anon, authenticated with check (true);
create policy newsletter_member_read on proj_tinash.newsletter_subscribers
  for select to authenticated using (proj_tinash.is_team());
create policy newsletter_admin_delete on proj_tinash.newsletter_subscribers
  for delete to authenticated using (proj_tinash.is_admin());

-- Job posts: the public sees published, open jobs only.
create policy job_posts_public_read on proj_tinash.job_posts
  for select to anon, authenticated using (published and status = 'open');

-- ─── Grants (RLS above is the lock; these set the outer bounds) ────────────

grant select, insert, update, delete on all tables in schema proj_tinash to authenticated;
grant all on all tables in schema proj_tinash to service_role;
grant usage, select on all sequences in schema proj_tinash to authenticated, service_role;
revoke update, delete, truncate on proj_tinash.activity_log, proj_tinash.comments from authenticated;

-- Public forms: only the columns a visitor fills in. Status, owner, contact
-- and timestamps are set by defaults and triggers, never by the caller.
revoke insert on proj_tinash.inquiries, proj_tinash.bookings, proj_tinash.newsletter_subscribers from authenticated;
grant insert (name, email, phone, service_interested, message, source_page, cta)
  on proj_tinash.inquiries to anon, authenticated;
grant insert (name, email, phone, requested_slot, notes, cta)
  on proj_tinash.bookings to anon, authenticated;
grant insert (email) on proj_tinash.newsletter_subscribers to anon, authenticated;
grant select on proj_tinash.job_posts to anon;

-- ─── Starter boards ────────────────────────────────────────────────────────

insert into proj_tinash.boards (key, name, description, visible_to, position) values
  ('operations', 'Operations',
   'The day to day board. Families, recruitment, scheduling, compliance and everything the office is carrying.',
   array['admin', 'ops'], 10),
  ('leadership', 'Leadership',
   'What leadership needs to see. Decisions waiting, items at risk, and anything the office has escalated.',
   array['admin', 'ops', 'leadership'], 20)
on conflict (key) do nothing;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000200_jobs_and_intake.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20260930160000_jobs_and_intake.sql), mmd -> tinash.

-- Jobs become full postings managed in the CRM, and applicants can arrive from
-- a CSV export, an automatic feed (n8n / Zapier) or the job's own page on the
-- website. All three paths go through one routine, so duplicates are matched
-- the same way whichever door someone came in by.
--
-- Additive only: new columns are nullable or defaulted, the status check is
-- widened, nothing existing is renamed or dropped.

-- ─── Job postings ──────────────────────────────────────────────────────────

alter table proj_tinash.job_posts
  add column if not exists slug            text,
  add column if not exists summary         text,
  add column if not exists description     text,
  add column if not exists requisition_id  text,
  add column if not exists employment_type text not null default 'part_time',
  add column if not exists experience      text,
  add column if not exists work_mode       text not null default 'onsite',
  add column if not exists benefits        text[] not null default '{}',
  add column if not exists pay_min         numeric(10,2),
  add column if not exists pay_max         numeric(10,2),
  add column if not exists pay_interval    text not null default 'hour',
  add column if not exists closed_at       timestamptz,
  add column if not exists created_by      uuid references auth.users(id) on delete set null;

alter table proj_tinash.job_posts drop constraint if exists job_posts_status_check;
alter table proj_tinash.job_posts add constraint job_posts_status_check
  check (status in ('draft', 'open', 'paused', 'closed'));

alter table proj_tinash.job_posts add constraint job_posts_employment_type_check
  check (employment_type in ('full_time', 'part_time', 'per_diem', 'contract'));
alter table proj_tinash.job_posts add constraint job_posts_work_mode_check
  check (work_mode in ('onsite', 'remote', 'hybrid'));
alter table proj_tinash.job_posts add constraint job_posts_pay_interval_check
  check (pay_interval in ('hour', 'week', 'year'));
alter table proj_tinash.job_posts add constraint job_posts_pay_range_check
  check (pay_min is null or pay_max is null or pay_min <= pay_max);
alter table proj_tinash.job_posts add constraint job_posts_description_length_check
  check (description is null or char_length(description) <= 20000);
alter table proj_tinash.job_posts add constraint job_posts_slug_format_check
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Existing posts get a stable address on the website.
update proj_tinash.job_posts
   set slug = trim(both '-' from left(regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'), 60))
              || '-' || left(replace(id::text, '-', ''), 6)
 where slug is null;

create unique index if not exists job_posts_slug_key on proj_tinash.job_posts (slug);

-- ─── Keys for the automatic feed ───────────────────────────────────────────
-- Only a SHA-256 of each key is stored. The key itself is shown once, when it
-- is created, and cannot be read back by anyone.

create table if not exists proj_tinash.intake_keys (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  source       text not null default 'CareerPlug',
  key_prefix   text not null,
  key_hash     text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

alter table proj_tinash.intake_keys enable row level security;

drop policy if exists intake_keys_admin_read on proj_tinash.intake_keys;
create policy intake_keys_admin_read on proj_tinash.intake_keys
  for select to authenticated
  using (proj_tinash.has_role('tinash', array['admin']));
-- No insert/update/delete policy: keys are only created and revoked through
-- the functions below, which check the caller is an administrator.

-- ─── The one intake routine ────────────────────────────────────────────────
-- Internal: not callable from outside. Takes one applicant as JSON:
--   external_id, name | first_name + last_name, email, phone, source,
--   job_post_id | job_external_id | job_title (+ location), applied_at,
--   resume_url, notes, answers (object)

create or replace function proj_tinash._ingest_applicant(p jsonb, p_default_source text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  v_name   text := nullif(trim(coalesce(p->>'name',
                    concat_ws(' ', nullif(trim(p->>'first_name'), ''), nullif(trim(p->>'last_name'), '')))), '');
  v_email  text := nullif(lower(trim(p->>'email')), '');
  v_phone  text := nullif(trim(p->>'phone'), '');
  v_digits text := right(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), 10);
  v_ext    text := nullif(trim(p->>'external_id'), '');
  v_source text := coalesce(nullif(trim(p->>'source'), ''), p_default_source);
  v_job    uuid;
  v_app    uuid;
  v_appl   uuid;
  v_new_applicant   boolean := false;
  v_new_application boolean := false;
  v_applied timestamptz;
begin
  if v_name is null then
    raise exception 'missing name';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'missing email and phone for %', v_name;
  end if;
  if length(v_digits) < 10 then v_digits := null; end if;

  begin
    v_applied := nullif(p->>'applied_at', '')::timestamptz;
  exception when others then
    v_applied := null;
  end;

  -- Same person? External id first, then email, then the last ten phone digits.
  select id into v_app from applicants where v_ext is not null and careerplug_id = v_ext limit 1;
  if v_app is null and v_email is not null then
    select id into v_app from applicants where lower(email) = v_email order by created_at limit 1;
  end if;
  if v_app is null and v_digits is not null then
    select id into v_app from applicants
     where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_digits
     order by created_at limit 1;
  end if;

  if v_app is null then
    insert into applicants (name, email, phone, source, careerplug_id, about, resume_url, created_at)
    values (left(v_name, 200), v_email, left(v_phone, 40), left(v_source, 60), v_ext,
            left(nullif(trim(p->>'notes'), ''), 4000), nullif(trim(p->>'resume_url'), ''),
            coalesce(v_applied, now()))
    returning id into v_app;
    v_new_applicant := true;
  else
    -- Fill gaps, never overwrite what the team has already recorded.
    update applicants set
      email         = coalesce(email, v_email),
      phone         = coalesce(phone, left(v_phone, 40)),
      careerplug_id = coalesce(careerplug_id, v_ext),
      resume_url    = coalesce(resume_url, nullif(trim(p->>'resume_url'), '')),
      about         = coalesce(about, left(nullif(trim(p->>'notes'), ''), 4000))
    where id = v_app;
  end if;

  -- Which job? Explicit id, then the job board's id, then the title.
  if p ? 'job_post_id' and nullif(p->>'job_post_id', '') is not null then
    select id into v_job from job_posts where id = (p->>'job_post_id')::uuid;
  end if;
  if v_job is null and nullif(trim(p->>'job_external_id'), '') is not null then
    select id into v_job from job_posts where careerplug_job_id = trim(p->>'job_external_id') limit 1;
  end if;
  if v_job is null and nullif(trim(p->>'job_title'), '') is not null then
    select id into v_job from job_posts
     where lower(title) = lower(trim(p->>'job_title'))
     order by (location is not null and nullif(trim(p->>'location'), '') is not null
               and location ilike '%' || trim(p->>'location') || '%') desc,
              (status = 'open') desc, posted_at desc nulls last
     limit 1;
  end if;

  -- One application per person per job; a person with no job gets one general one.
  if v_job is not null then
    select id into v_appl from applications where applicant_id = v_app and job_post_id = v_job;
  else
    select id into v_appl from applications where applicant_id = v_app and job_post_id is null;
  end if;

  if v_appl is null then
    insert into applications (applicant_id, job_post_id, stage, screening_answers, created_at)
    values (v_app, v_job, 'new',
            case when jsonb_typeof(p->'answers') = 'object' then p->'answers' else '{}'::jsonb end,
            coalesce(v_applied, now()))
    returning id into v_appl;
    v_new_application := true;

    insert into activity_log (actor_id, verb, entity_type, entity_id, meta)
    values (p_actor, 'applicant added from ' || v_source, 'application', v_appl,
            jsonb_build_object('name', v_name, 'source', v_source, 'job_post_id', v_job,
                               'new_person', v_new_applicant));
  end if;

  return jsonb_build_object(
    'applicant_id', v_app, 'application_id', v_appl,
    'new_applicant', v_new_applicant, 'new_application', v_new_application,
    'job_matched', v_job is not null);
end;
$$;

revoke all on function proj_tinash._ingest_applicant(jsonb, text, uuid) from public, anon, authenticated;

-- ─── Door 1: CSV import by the operations team ─────────────────────────────

create or replace function proj_tinash.import_applicants(p_rows jsonb, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  r jsonb;
  res jsonb;
  i int := 0;
  n_people int := 0; n_apps int := 0; n_dupes int := 0; n_unmatched int := 0;
  errors jsonb := '[]'::jsonb;
begin
  if not proj_tinash.has_role('tinash', array['admin', 'ops']) then
    raise exception 'Only the operations team can import applicants.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected a list of rows.';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Import at most 1000 rows at a time.';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      res := proj_tinash._ingest_applicant(r, coalesce(nullif(trim(p_source), ''), 'Import'), auth.uid());
      if (res->>'new_applicant')::boolean then n_people := n_people + 1; end if;
      if (res->>'new_application')::boolean then n_apps := n_apps + 1; else n_dupes := n_dupes + 1; end if;
      if not (res->>'job_matched')::boolean then n_unmatched := n_unmatched + 1; end if;
    exception when others then
      errors := errors || jsonb_build_object('row', i, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('rows', i, 'new_people', n_people, 'new_applications', n_apps,
                            'already_there', n_dupes, 'no_job_match', n_unmatched, 'errors', errors);
end;
$$;

revoke all on function proj_tinash.import_applicants(jsonb, text) from public, anon;
grant execute on function proj_tinash.import_applicants(jsonb, text) to authenticated;

-- ─── Door 2: the automatic feed (n8n, Zapier, any job board) ───────────────

create or replace function proj_tinash.intake_applicant(p_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  k intake_keys%rowtype;
  r jsonb;
  results jsonb := '[]'::jsonb;
begin
  select * into k from intake_keys
   where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex')
     and revoked_at is null;
  if not found then
    raise exception 'invalid intake key' using errcode = '28000';
  end if;

  update intake_keys set last_used_at = now() where id = k.id;

  if jsonb_typeof(p_payload) = 'array' then
    if jsonb_array_length(p_payload) > 100 then
      raise exception 'Send at most 100 applicants per request.';
    end if;
    for r in select * from jsonb_array_elements(p_payload) loop
      begin
        results := results || proj_tinash._ingest_applicant(r, k.source, null);
      exception when others then
        results := results || jsonb_build_object('error', sqlerrm);
      end;
    end loop;
    return jsonb_build_object('results', results);
  end if;

  return proj_tinash._ingest_applicant(p_payload, k.source, null);
end;
$$;

revoke all on function proj_tinash.intake_applicant(text, jsonb) from public;
grant execute on function proj_tinash.intake_applicant(text, jsonb) to anon, authenticated;

-- ─── Door 3: applying on the job's page on the website ─────────────────────

create or replace function proj_tinash.apply_to_job(p_job uuid, p jsonb)
returns boolean
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
begin
  if not exists (select 1 from job_posts where id = p_job and published and status = 'open') then
    raise exception 'This position is no longer taking applications.';
  end if;

  perform proj_tinash._ingest_applicant(
    jsonb_build_object(
      'name',       left(p->>'name', 200),
      'email',      left(p->>'email', 200),
      'phone',      left(p->>'phone', 40),
      'resume_url', left(p->>'resume_url', 300),
      'notes',      left(p->>'notes', 4000),
      'answers',    case when jsonb_typeof(p->'answers') = 'object' then p->'answers' else '{}'::jsonb end,
      'job_post_id', p_job,
      'source',     'Website'),
    'Website', null);
  -- Deliberately returns nothing about the person, so the public form cannot
  -- be used to find out whether someone has applied before.
  return true;
end;
$$;

revoke all on function proj_tinash.apply_to_job(uuid, jsonb) from public;
grant execute on function proj_tinash.apply_to_job(uuid, jsonb) to anon, authenticated;

-- ─── Managing feed keys (administrators) ───────────────────────────────────

create or replace function proj_tinash.create_intake_key(p_label text, p_source text)
returns text
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  v_key text := 'tinash_in_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can create a feed key.';
  end if;
  if nullif(trim(p_label), '') is null then
    raise exception 'Give the key a name.';
  end if;

  insert into intake_keys (label, source, key_prefix, key_hash, created_by)
  values (left(trim(p_label), 80), coalesce(nullif(left(trim(p_source), 60), ''), 'CareerPlug'),
          left(v_key, 14), encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), auth.uid());

  return v_key;
end;
$$;

create or replace function proj_tinash.revoke_intake_key(p_id uuid)
returns void
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can revoke a feed key.';
  end if;
  update intake_keys set revoked_at = now() where id = p_id and revoked_at is null;
end;
$$;

revoke all on function proj_tinash.create_intake_key(text, text) from public, anon;
revoke all on function proj_tinash.revoke_intake_key(uuid) from public, anon;
grant execute on function proj_tinash.create_intake_key(text, text) to authenticated;
grant execute on function proj_tinash.revoke_intake_key(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000300_team_and_profiles.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20260930220000_team_and_profiles.sql), mmd -> tinash.

-- Team management from the CRM: an administrator adds people by email and
-- picks their role in Settings, without opening Supabase.
--
--   * Email already has an account  -> added to the team immediately.
--   * No account yet                -> an invite is recorded. The first time
--     that email signs in at /login, the account is created and the invite's
--     role is applied automatically (trigger on auth.users).
--
-- Every change goes through a SECURITY DEFINER function that checks the caller
-- is a Tinash administrator. Nothing here is callable by anon.

-- ─── Profiles: name, title and photo instead of an email address ───────────
-- display_name and avatar_url already exist; each person edits only their own
-- row (profiles_own_write), and every team member can read everyone's.

alter table proj_tinash.profiles
  add column if not exists job_title text check (job_title is null or char_length(job_title) <= 80);

alter table proj_tinash.profiles drop constraint if exists profiles_display_name_length;
alter table proj_tinash.profiles add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 80);

-- Photos: small public images, one folder per person, only they can change it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tinash-avatars', 'tinash-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists tinash_avatars_own_read on storage.objects;
drop policy if exists tinash_avatars_own_insert on storage.objects;
drop policy if exists tinash_avatars_own_update on storage.objects;
drop policy if exists tinash_avatars_own_delete on storage.objects;
-- Replacing a photo in place (upsert) needs to see the existing file.
create policy tinash_avatars_own_read on storage.objects for select to authenticated
  using (bucket_id = 'tinash-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tinash_avatars_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tinash-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and hub.is_member('tinash'));
create policy tinash_avatars_own_update on storage.objects for update to authenticated
  using (bucket_id = 'tinash-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tinash_avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tinash-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─── Invites ───────────────────────────────────────────────────────────────

create table if not exists proj_tinash.team_invites (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role          text not null check (role in ('admin', 'ops', 'leadership', 'viewer')),
  job_title     text check (job_title is null or char_length(job_title) <= 80),
  invited_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_user uuid references auth.users(id) on delete set null,
  revoked_at    timestamptz
);

-- One open invite per email.
create unique index if not exists team_invites_open_email
  on proj_tinash.team_invites (lower(email))
  where accepted_at is null and revoked_at is null;

alter table proj_tinash.team_invites enable row level security;

drop policy if exists team_invites_admin_read on proj_tinash.team_invites;
create policy team_invites_admin_read on proj_tinash.team_invites
  for select to authenticated
  using (proj_tinash.has_role('tinash', array['admin', 'ops']));
-- No write policies: invites change only through the functions below.

grant select on proj_tinash.team_invites to authenticated;

-- ─── Internal: put a user on the team with a role ──────────────────────────

create or replace function proj_tinash._grant_team_role(p_user uuid, p_role text, p_job_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into hub.memberships (project_slug, user_id, role)
  values ('tinash', p_user, 'member')
  on conflict (project_slug, user_id) do nothing;

  insert into proj_tinash.team_roles (user_id, role, job_title)
  values (p_user, p_role, nullif(trim(p_job_title), ''))
  on conflict (user_id) do update
    set role       = excluded.role,
        job_title  = coalesce(excluded.job_title, proj_tinash.team_roles.job_title),
        updated_at = now();

  -- Seed the profile with the title the administrator gave; the person can
  -- change it later on their own profile page.
  insert into proj_tinash.profiles (id, job_title)
  values (p_user, nullif(trim(p_job_title), ''))
  on conflict (id) do update
    set job_title = coalesce(proj_tinash.profiles.job_title, excluded.job_title);
end;
$$;

revoke all on function proj_tinash._grant_team_role(uuid, text, text) from public, anon, authenticated;

-- ─── Team list with names and photos ───────────────────────────────────────
-- Return type changes, so the old function is replaced rather than altered.

drop function if exists proj_tinash.team_list();
create function proj_tinash.team_list()
returns table (user_id uuid, email text, role text, job_title text, display_name text, avatar_url text, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tr.user_id, u.email::text, tr.role,
         coalesce(p.job_title, tr.job_title), p.display_name, p.avatar_url, u.last_sign_in_at
  from proj_tinash.team_roles tr
  join auth.users u on u.id = tr.user_id
  left join proj_tinash.profiles p on p.id = tr.user_id
  where proj_tinash.has_role('tinash', array['admin', 'ops'])
  order by tr.role, coalesce(p.display_name, u.email::text);
$$;

revoke all on function proj_tinash.team_list() from public, anon;
grant execute on function proj_tinash.team_list() to authenticated;

-- ─── Admin: add someone by email ───────────────────────────────────────────

create or replace function proj_tinash.add_team_member(p_email text, p_role text, p_job_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user  uuid;
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can add people to the team.';
  end if;
  if p_role not in ('admin', 'ops', 'leadership', 'viewer') then
    raise exception 'Choose a role: Administrator, Operations, Leadership or Viewer.';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That does not look like an email address.';
  end if;

  select id into v_user from auth.users where lower(email) = v_email;

  if v_user is not null then
    perform proj_tinash._grant_team_role(v_user, p_role, p_job_title);
    update proj_tinash.team_invites
       set accepted_at = now(), accepted_user = v_user
     where lower(email) = v_email and accepted_at is null and revoked_at is null;
    insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id, meta)
    values (auth.uid(), 'added to the team', 'team_member', v_user, jsonb_build_object('email', v_email, 'role', p_role));
    return jsonb_build_object('status', 'added', 'email', v_email);
  end if;

  -- Replace any earlier open invite for the same email.
  update proj_tinash.team_invites
     set revoked_at = now()
   where lower(email) = v_email and accepted_at is null and revoked_at is null;

  insert into proj_tinash.team_invites (email, role, job_title, invited_by)
  values (v_email, p_role, nullif(trim(p_job_title), ''), auth.uid());

  insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id, meta)
  values (auth.uid(), 'invited to the team', 'team_invite', null, jsonb_build_object('email', v_email, 'role', p_role));

  return jsonb_build_object('status', 'invited', 'email', v_email);
end;
$$;

-- ─── Admin: withdraw an invite ─────────────────────────────────────────────

create or replace function proj_tinash.revoke_team_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can withdraw an invite.';
  end if;
  update proj_tinash.team_invites set revoked_at = now()
   where id = p_id and accepted_at is null and revoked_at is null;
end;
$$;

-- ─── Admin: take someone off the team ──────────────────────────────────────
-- Their login stays (it may be used elsewhere); they simply lose Tinash access.

create or replace function proj_tinash.remove_team_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can remove someone from the team.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot remove yourself. Ask another administrator.';
  end if;
  if (select role from proj_tinash.team_roles where user_id = p_user) = 'admin'
     and (select count(*) from proj_tinash.team_roles where role = 'admin') <= 1 then
    raise exception 'That is the last administrator. Make someone else an administrator first.';
  end if;

  select email into v_email from auth.users where id = p_user;
  delete from proj_tinash.team_roles where user_id = p_user;
  delete from hub.memberships where project_slug = 'tinash' and user_id = p_user;

  insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id, meta)
  values (auth.uid(), 'removed from the team', 'team_member', p_user, jsonb_build_object('email', v_email));
end;
$$;

revoke all on function proj_tinash.add_team_member(text, text, text) from public, anon;
revoke all on function proj_tinash.revoke_team_invite(uuid) from public, anon;
revoke all on function proj_tinash.remove_team_member(uuid) from public, anon;
grant execute on function proj_tinash.add_team_member(text, text, text) to authenticated;
grant execute on function proj_tinash.revoke_team_invite(uuid) to authenticated;
grant execute on function proj_tinash.remove_team_member(uuid) to authenticated;

-- ─── Automatic: an invited email signs in for the first time ───────────────

create or replace function proj_tinash.claim_team_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv proj_tinash.team_invites%rowtype;
begin
  select * into inv from proj_tinash.team_invites
   where lower(email) = lower(new.email) and accepted_at is null and revoked_at is null
   order by created_at desc limit 1;

  if found then
    perform proj_tinash._grant_team_role(new.id, inv.role, inv.job_title);
    update proj_tinash.team_invites set accepted_at = now(), accepted_user = new.id where id = inv.id;
  end if;
  return new;
end;
$$;

revoke all on function proj_tinash.claim_team_invite() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_tinash_invite on auth.users;
create trigger on_auth_user_created_tinash_invite
  after insert on auth.users
  for each row execute function proj_tinash.claim_team_invite();

-- ─── Optional hardening: only invited emails may create an account ─────────
-- Enable in Authentication -> Hooks -> "Before User Created" -> Postgres,
-- function proj_tinash.hook_before_user_created. Until then, a stranger can create
-- a login but sees "not on the Tinash team" and can read nothing.

create or replace function proj_tinash.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from proj_tinash.team_invites
     where lower(email) = lower(event->'user'->>'email') and accepted_at is null and revoked_at is null
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email has not been invited to the Tinash team. Ask an administrator to add you.'));
end;
$$;

revoke all on function proj_tinash.hook_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema proj_tinash to supabase_auth_admin;
grant execute on function proj_tinash.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ─── Tidy-up found in the audit ────────────────────────────────────────────
-- MMD also revoked its legacy proj_mmd.grant_team_access() and hub.join_project()
-- here. Neither exists in this fresh Tinash project (they were never created),
-- so those two statements are intentionally omitted.
-- A count of cards per board is nobody's business before signing in.
revoke execute on function proj_tinash.board_strands_cards(uuid) from public, anon;
grant execute on function proj_tinash.board_strands_cards(uuid) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000400_hardening.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20261001000000_hardening.sql), mmd -> tinash.

-- Launch hardening, from the 2026-09-30 security gate and code review:
--   1. Rate limits on every public write (forms, job applications, feed).
--   2. "Add to team" can no longer demote yourself or the last administrator.
--   3. Imported applicant ids match only within the same job board.
--   4. Lead attribution (UTM / referrer / landing page) stored with each lead.

-- ─── 1. Rate limiting ──────────────────────────────────────────────────────
-- Enforced in the database so it also covers anyone posting straight to the
-- Supabase API, not just the website. Supabase passes the caller's headers to
-- Postgres, so the limit is keyed on the real client IP (stored hashed).
-- It fails closed: if the check cannot run, the insert fails with it.
-- PostgREST turns SQLSTATE PT429 into an HTTP 429 response.

create table if not exists proj_tinash.rate_events (
  bucket     text not null,
  subject    text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup on proj_tinash.rate_events (bucket, subject, created_at desc);
create index if not exists rate_events_bucket_time on proj_tinash.rate_events (bucket, created_at desc);
alter table proj_tinash.rate_events enable row level security;
-- No policies: only the functions below touch it.

create or replace function proj_tinash.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ',', 1),
    nullif(current_setting('request.headers', true), '')::json->>'x-real-ip',
    'unknown');
$$;

create or replace function proj_tinash._rate_limit(
  p_bucket text, p_per_subject int, p_window interval, p_global int, p_global_window interval,
  p_subject text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text := md5(coalesce(p_subject, proj_tinash.client_ip()));
begin
  -- Housekeeping: nothing older than a day is ever needed.
  delete from proj_tinash.rate_events where bucket = p_bucket and created_at < now() - interval '1 day';

  if (select count(*) from proj_tinash.rate_events
       where bucket = p_bucket and subject = v_subject and created_at > now() - p_window) >= p_per_subject then
    raise exception 'Too many requests. Please wait a few minutes and try again, or call us.'
      using errcode = 'PT429', hint = 'retry_after=' || extract(epoch from p_window)::int;
  end if;

  if (select count(*) from proj_tinash.rate_events
       where bucket = p_bucket and created_at > now() - p_global_window) >= p_global then
    raise exception 'This form is busy right now. Please try again shortly, or call us.'
      using errcode = 'PT429', hint = 'retry_after=' || extract(epoch from p_global_window)::int;
  end if;

  insert into proj_tinash.rate_events (bucket, subject) values (p_bucket, v_subject);
end;
$$;

revoke all on function proj_tinash._rate_limit(text, int, interval, int, interval, text) from public, anon, authenticated;
revoke all on function proj_tinash.client_ip() from public, anon, authenticated;

-- Public form tables: one trigger function, limits per table.
-- Team members (signed in, on the Tinash team) are never limited.
create or replace function proj_tinash.limit_public_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if hub.is_member('tinash') then
    return new;
  end if;
  case tg_table_name
    when 'inquiries'              then perform proj_tinash._rate_limit('inquiry',    5, interval '10 minutes', 100, interval '1 hour');
    when 'bookings'               then perform proj_tinash._rate_limit('booking',    3, interval '10 minutes',  40, interval '1 hour');
    when 'newsletter_subscribers' then perform proj_tinash._rate_limit('newsletter', 3, interval '10 minutes', 100, interval '1 hour');
    else null;
  end case;
  return new;
end;
$$;

revoke all on function proj_tinash.limit_public_insert() from public, anon, authenticated;

drop trigger if exists limit_public_insert on proj_tinash.inquiries;
drop trigger if exists limit_public_insert on proj_tinash.bookings;
drop trigger if exists limit_public_insert on proj_tinash.newsletter_subscribers;
create trigger limit_public_insert before insert on proj_tinash.inquiries
  for each row execute function proj_tinash.limit_public_insert();
create trigger limit_public_insert before insert on proj_tinash.bookings
  for each row execute function proj_tinash.limit_public_insert();
create trigger limit_public_insert before insert on proj_tinash.newsletter_subscribers
  for each row execute function proj_tinash.limit_public_insert();

-- ─── 4. Attribution columns (anon may set them on insert, never read them) ──

alter table proj_tinash.inquiries              add column if not exists attribution jsonb;
alter table proj_tinash.bookings               add column if not exists attribution jsonb;
alter table proj_tinash.newsletter_subscribers add column if not exists attribution jsonb;

alter table proj_tinash.inquiries drop constraint if exists inquiries_attribution_size;
alter table proj_tinash.inquiries add constraint inquiries_attribution_size
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) < 4000));
alter table proj_tinash.bookings drop constraint if exists bookings_attribution_size;
alter table proj_tinash.bookings add constraint bookings_attribution_size
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) < 4000));
alter table proj_tinash.newsletter_subscribers drop constraint if exists newsletter_attribution_size;
alter table proj_tinash.newsletter_subscribers add constraint newsletter_attribution_size
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) < 4000));

-- ─── 3. Applicant matching scoped by job board ─────────────────────────────
-- An external id from Indeed must never match a CareerPlug id that happens to
-- be the same string. Ids now match only when the source matches too; anyone
-- else falls through to email, then phone.

create or replace function proj_tinash._ingest_applicant(p jsonb, p_default_source text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  v_name   text := nullif(trim(coalesce(p->>'name',
                    concat_ws(' ', nullif(trim(p->>'first_name'), ''), nullif(trim(p->>'last_name'), '')))), '');
  v_email  text := nullif(lower(trim(p->>'email')), '');
  v_phone  text := nullif(trim(p->>'phone'), '');
  v_digits text := right(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), 10);
  v_ext    text := nullif(trim(p->>'external_id'), '');
  v_source text := coalesce(nullif(trim(p->>'source'), ''), p_default_source);
  v_job    uuid;
  v_app    uuid;
  v_appl   uuid;
  v_new_applicant   boolean := false;
  v_new_application boolean := false;
  v_applied timestamptz;
begin
  if v_name is null then
    raise exception 'missing name';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'missing email and phone for %', v_name;
  end if;
  if length(v_digits) < 10 then v_digits := null; end if;

  begin
    v_applied := nullif(p->>'applied_at', '')::timestamptz;
  exception when others then
    v_applied := null;
  end;

  -- Same person? This board's id first, then email, then the last ten phone digits.
  select id into v_app from applicants
   where v_ext is not null and careerplug_id = v_ext and lower(coalesce(source, '')) = lower(v_source)
   limit 1;
  if v_app is null and v_email is not null then
    select id into v_app from applicants where lower(email) = v_email order by created_at limit 1;
  end if;
  if v_app is null and v_digits is not null then
    select id into v_app from applicants
     where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_digits
     order by created_at limit 1;
  end if;

  if v_app is null then
    insert into applicants (name, email, phone, source, careerplug_id, about, resume_url, created_at)
    values (left(v_name, 200), v_email, left(v_phone, 40), left(v_source, 60), v_ext,
            left(nullif(trim(p->>'notes'), ''), 4000), nullif(trim(p->>'resume_url'), ''),
            coalesce(v_applied, now()))
    returning id into v_app;
    v_new_applicant := true;
  else
    -- Fill gaps, never overwrite. A board id is only recorded against the
    -- board the person originally came from, so the id/source pair stays true.
    update applicants set
      email         = coalesce(email, v_email),
      phone         = coalesce(phone, left(v_phone, 40)),
      careerplug_id = case when careerplug_id is null and lower(coalesce(source, '')) = lower(v_source)
                           then v_ext else careerplug_id end,
      resume_url    = coalesce(resume_url, nullif(trim(p->>'resume_url'), '')),
      about         = coalesce(about, left(nullif(trim(p->>'notes'), ''), 4000))
    where id = v_app;
  end if;

  if p ? 'job_post_id' and nullif(p->>'job_post_id', '') is not null then
    select id into v_job from job_posts where id = (p->>'job_post_id')::uuid;
  end if;
  if v_job is null and nullif(trim(p->>'job_external_id'), '') is not null then
    select id into v_job from job_posts where careerplug_job_id = trim(p->>'job_external_id') limit 1;
  end if;
  if v_job is null and nullif(trim(p->>'job_title'), '') is not null then
    select id into v_job from job_posts
     where lower(title) = lower(trim(p->>'job_title'))
     order by (location is not null and nullif(trim(p->>'location'), '') is not null
               and location ilike '%' || trim(p->>'location') || '%') desc,
              (status = 'open') desc, posted_at desc nulls last
     limit 1;
  end if;

  if v_job is not null then
    select id into v_appl from applications where applicant_id = v_app and job_post_id = v_job;
  else
    select id into v_appl from applications where applicant_id = v_app and job_post_id is null;
  end if;

  if v_appl is null then
    insert into applications (applicant_id, job_post_id, stage, screening_answers, created_at)
    values (v_app, v_job, 'new',
            case when jsonb_typeof(p->'answers') = 'object' then p->'answers' else '{}'::jsonb end,
            coalesce(v_applied, now()))
    returning id into v_appl;
    v_new_application := true;

    insert into activity_log (actor_id, verb, entity_type, entity_id, meta)
    values (p_actor, 'applicant added from ' || v_source, 'application', v_appl,
            jsonb_build_object('name', v_name, 'source', v_source, 'job_post_id', v_job,
                               'new_person', v_new_applicant));
  end if;

  return jsonb_build_object(
    'applicant_id', v_app, 'application_id', v_appl,
    'new_applicant', v_new_applicant, 'new_application', v_new_application,
    'job_matched', v_job is not null);
end;
$$;

revoke all on function proj_tinash._ingest_applicant(jsonb, text, uuid) from public, anon, authenticated;

-- ─── 1b. Rate limits on the public application and the automatic feed ──────

create or replace function proj_tinash.apply_to_job(p_job uuid, p jsonb)
returns boolean
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
begin
  perform proj_tinash._rate_limit('apply', 5, interval '10 minutes', 60, interval '1 hour');

  if not exists (select 1 from job_posts where id = p_job and published and status = 'open') then
    raise exception 'This position is no longer taking applications.';
  end if;

  perform proj_tinash._ingest_applicant(
    jsonb_build_object(
      'name',       left(p->>'name', 200),
      'email',      left(p->>'email', 200),
      'phone',      left(p->>'phone', 40),
      'resume_url', left(p->>'resume_url', 300),
      'notes',      left(p->>'notes', 4000),
      'answers',    case when jsonb_typeof(p->'answers') = 'object' then p->'answers' else '{}'::jsonb end,
      'job_post_id', p_job,
      'source',     'Website'),
    'Website', null);
  return true;
end;
$$;

revoke all on function proj_tinash.apply_to_job(uuid, jsonb) from public;
grant execute on function proj_tinash.apply_to_job(uuid, jsonb) to anon, authenticated;

create or replace function proj_tinash.intake_applicant(p_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  k intake_keys%rowtype;
  r jsonb;
  results jsonb := '[]'::jsonb;
begin
  -- Wrong keys are limited by IP, so the endpoint cannot be used to guess keys.
  perform proj_tinash._rate_limit('intake-auth', 60, interval '10 minutes', 1000, interval '1 hour');

  select * into k from intake_keys
   where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex')
     and revoked_at is null;
  if not found then
    raise exception 'invalid intake key' using errcode = '28000';
  end if;

  -- A valid key is limited per key: generous for a busy job board, bounded for a leaked key.
  perform proj_tinash._rate_limit('intake', 300, interval '1 hour', 2000, interval '1 hour', k.id::text);

  update intake_keys set last_used_at = now() where id = k.id;

  if jsonb_typeof(p_payload) = 'array' then
    if jsonb_array_length(p_payload) > 100 then
      raise exception 'Send at most 100 applicants per request.';
    end if;
    for r in select * from jsonb_array_elements(p_payload) loop
      begin
        results := results || proj_tinash._ingest_applicant(r, k.source, null);
      exception when others then
        results := results || jsonb_build_object('error', sqlerrm);
      end;
    end loop;
    return jsonb_build_object('results', results);
  end if;

  return proj_tinash._ingest_applicant(p_payload, k.source, null);
end;
$$;

revoke all on function proj_tinash.intake_applicant(text, jsonb) from public;
grant execute on function proj_tinash.intake_applicant(text, jsonb) to anon, authenticated;

-- ─── 2. "Add to team" cannot demote yourself or the last administrator ─────

create or replace function proj_tinash.add_team_member(p_email text, p_role text, p_job_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user  uuid;
  v_current text;
begin
  if not proj_tinash.has_role('tinash', array['admin']) then
    raise exception 'Only an administrator can add people to the team.';
  end if;
  if p_role not in ('admin', 'ops', 'leadership', 'viewer') then
    raise exception 'Choose a role: Administrator, Operations, Leadership or Viewer.';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That does not look like an email address.';
  end if;

  select id into v_user from auth.users where lower(email) = v_email;

  if v_user is not null then
    if v_user = auth.uid() then
      raise exception 'That is your own account. Your role can only be changed by another administrator.';
    end if;
    select role into v_current from proj_tinash.team_roles where user_id = v_user;
    if v_current = 'admin' and p_role <> 'admin'
       and (select count(*) from proj_tinash.team_roles where role = 'admin') <= 1 then
      raise exception 'That is the last administrator. Make someone else an administrator first.';
    end if;

    perform proj_tinash._grant_team_role(v_user, p_role, p_job_title);
    update proj_tinash.team_invites
       set accepted_at = now(), accepted_user = v_user
     where lower(email) = v_email and accepted_at is null and revoked_at is null;
    insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id, meta)
    values (auth.uid(), 'added to the team', 'team_member', v_user, jsonb_build_object('email', v_email, 'role', p_role));
    return jsonb_build_object('status', 'added', 'email', v_email);
  end if;

  update proj_tinash.team_invites
     set revoked_at = now()
   where lower(email) = v_email and accepted_at is null and revoked_at is null;

  insert into proj_tinash.team_invites (email, role, job_title, invited_by)
  values (v_email, p_role, nullif(trim(p_job_title), ''), auth.uid());

  insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id, meta)
  values (auth.uid(), 'invited to the team', 'team_invite', null, jsonb_build_object('email', v_email, 'role', p_role));

  return jsonb_build_object('status', 'invited', 'email', v_email);
end;
$$;

revoke all on function proj_tinash.add_team_member(text, text, text) from public, anon;
grant execute on function proj_tinash.add_team_member(text, text, text) to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000500_rate_limit_fixes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20261001050307_rate_limit_fixes.sql), mmd -> tinash.

-- Serialize each bucket's check and insert, covering both its subject and
-- global caps. The lock lasts until the caller commits or rolls back, so the
-- next transaction sees the previous accepted event before checking its cap.
create or replace function proj_tinash._rate_limit(
  p_bucket text, p_per_subject int, p_window interval, p_global int, p_global_window interval,
  p_subject text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text := md5(coalesce(p_subject, proj_tinash.client_ip()));
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('proj_tinash.rate_limit:' || p_bucket, 0));

  delete from proj_tinash.rate_events where bucket = p_bucket and created_at < now() - interval '1 day';

  if (select count(*) from proj_tinash.rate_events
       where bucket = p_bucket and subject = v_subject and created_at > now() - p_window) >= p_per_subject then
    raise exception 'Too many requests. Please wait a few minutes and try again, or call us.'
      using errcode = 'PT429', hint = 'retry_after=' || extract(epoch from p_window)::int;
  end if;

  if (select count(*) from proj_tinash.rate_events
       where bucket = p_bucket and created_at > now() - p_global_window) >= p_global then
    raise exception 'This form is busy right now. Please try again shortly, or call us.'
      using errcode = 'PT429', hint = 'retry_after=' || extract(epoch from p_global_window)::int;
  end if;

  insert into proj_tinash.rate_events (bucket, subject) values (p_bucket, v_subject);
end;
$$;

revoke all on function proj_tinash._rate_limit(text, int, interval, int, interval, text) from public, anon, authenticated;

create or replace function proj_tinash.intake_applicant(p_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
declare
  k intake_keys%rowtype;
  r jsonb;
  results jsonb := '[]'::jsonb;
begin
  perform proj_tinash._rate_limit('intake-auth', 60, interval '10 minutes', 1000, interval '1 hour');

  select * into k from intake_keys
   where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex')
     and revoked_at is null;
  if not found then
    -- An exception would roll back the rate event too. Return a normal SQL
    -- result with an HTTP error status so PostgREST commits the attempt while
    -- Supabase clients still receive the existing authentication error shape.
    perform set_config('response.status', '401', true);
    return jsonb_build_object(
      'code', '28000', 'message', 'invalid intake key', 'details', null, 'hint', null);
  end if;

  perform proj_tinash._rate_limit('intake', 300, interval '1 hour', 2000, interval '1 hour', k.id::text);

  update intake_keys set last_used_at = now() where id = k.id;

  if jsonb_typeof(p_payload) = 'array' then
    if jsonb_array_length(p_payload) > 100 then
      raise exception 'Send at most 100 applicants per request.';
    end if;
    for r in select * from jsonb_array_elements(p_payload) loop
      begin
        results := results || proj_tinash._ingest_applicant(r, k.source, null);
      exception when others then
        results := results || jsonb_build_object('error', sqlerrm);
      end;
    end loop;
    return jsonb_build_object('results', results);
  end if;

  return proj_tinash._ingest_applicant(p_payload, k.source, null);
end;
$$;

revoke all on function proj_tinash.intake_applicant(text, jsonb) from public;
grant execute on function proj_tinash.intake_applicant(text, jsonb) to anon, authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000600_task_comments.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20261001051910_task_comments.sql), mmd -> tinash.

-- A comment belongs to the task, so shared cards have one conversation.
create table proj_tinash.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references proj_tinash.tasks(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null check (char_length(body) <= 4000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now()
);
create index task_comments_task_time on proj_tinash.task_comments (task_id, created_at desc, id desc);
create index task_comments_author on proj_tinash.task_comments (author_id);

alter table proj_tinash.task_comments enable row level security;
revoke all on proj_tinash.task_comments from public, anon, authenticated;
grant select on proj_tinash.task_comments to authenticated;
-- The database supplies the author, timestamp and id; callers cannot spoof them.
grant insert (task_id, body) on proj_tinash.task_comments to authenticated;

create policy task_comments_read on proj_tinash.task_comments
  for select to authenticated
  using (exists (select 1 from proj_tinash.tasks t where t.id = task_comments.task_id));

create policy task_comments_add on proj_tinash.task_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and proj_tinash.has_role('tinash', array['admin', 'ops'])
    and exists (select 1 from proj_tinash.tasks t where t.id = task_comments.task_id)
  );
-- The task query above runs as the caller, preserving the task's existing RLS.
-- Comments are append-only; no update or delete permissions are granted.

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000700_board_blocked_stage.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Ported from the MMD project (20261001120000_board_blocked_stage.sql), mmd -> tinash.

-- A "Blocked" column on the work board: stuck work, waiting on someone or something.
alter table proj_tinash.tasks drop constraint if exists tasks_stage_check;
alter table proj_tinash.tasks add constraint tasks_stage_check
  check (stage in ('backlog', 'todo', 'in_progress', 'blocked', 'review', 'done'));

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- >>> migrations/20261004000800_tinash_pipelines_and_onboarding.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Tinash additions on top of the ported MMD migrations:
--   a. Public forms may send the attribution column added by `hardening`.
--   b. Private resume bucket `tinash-resumes` (public INSERT only).
--   c. apply_general(): the careers page's general application lands on the
--      Applicants pipeline (no job attached), rate limited like apply_to_job.
--   d. Onboarding packs: rotate_assignment_token() and onboarding_pack(),
--      which the CRM and the public /welcome/<token> page call.
--   e. How the first administrator gets in (commented SQL at the bottom).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── a. Attribution on public inserts ──────────────────────────────────────
-- Column-level insert grants (core schema) do not cover columns added later.
grant insert (attribution) on proj_tinash.inquiries to anon, authenticated;
grant insert (attribution) on proj_tinash.bookings to anon, authenticated;
grant insert (attribution) on proj_tinash.newsletter_subscribers to anon, authenticated;

-- ─── b. Resumes: private bucket, upload-only for the public ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tinash-resumes', 'tinash-resumes', false, 10485760,
        array['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists tinash_resumes_public_upload on storage.objects;
drop policy if exists tinash_resumes_team_read on storage.objects;
drop policy if exists tinash_resumes_admin_delete on storage.objects;
-- Anyone may add a file under applications/ (no overwrite: upsert needs SELECT
-- and UPDATE, which the public does not have). Nobody outside the team can
-- list, read, replace or delete one. The team reads through signed URLs.
create policy tinash_resumes_public_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'tinash-resumes' and (storage.foldername(name))[1] = 'applications');
create policy tinash_resumes_team_read on storage.objects
  for select to authenticated
  using (bucket_id = 'tinash-resumes' and hub.is_member('tinash'));
create policy tinash_resumes_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'tinash-resumes' and proj_tinash.has_role('tinash', array['admin']));

-- ─── c. General caregiver application ──────────────────────────────────────
create or replace function proj_tinash.apply_general(p jsonb)
returns boolean
language plpgsql
security definer
set search_path = proj_tinash, pg_temp
as $$
begin
  perform proj_tinash._rate_limit('apply', 5, interval '10 minutes', 60, interval '1 hour');

  perform proj_tinash._ingest_applicant(
    jsonb_build_object(
      'name',       left(p->>'name', 200),
      'email',      left(p->>'email', 200),
      'phone',      left(p->>'phone', 40),
      'resume_url', left(p->>'resume_url', 300),
      'notes',      left(p->>'notes', 4000),
      'answers',    case when jsonb_typeof(p->'answers') = 'object' then p->'answers' else '{}'::jsonb end,
      'source',     'Website'),
    'Website', null);
  -- Like apply_to_job: returns nothing about the person.
  return true;
end;
$$;

revoke all on function proj_tinash.apply_general(jsonb) from public;
grant execute on function proj_tinash.apply_general(jsonb) to anon, authenticated;

-- ─── d. Onboarding packs ───────────────────────────────────────────────────

/** Issues a fresh link, which instantly kills the old one. */
create or replace function proj_tinash.rotate_assignment_token(p_assignment uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not proj_tinash.has_role('tinash', array['admin', 'ops']) then
    raise exception 'Only the operations team can change onboarding links.';
  end if;
  update proj_tinash.assignments
     set token = v_token, expires_at = now() + interval '30 days', updated_at = now()
   where id = p_assignment;
  if not found then
    raise exception 'That onboarding pack could not be found.';
  end if;
  insert into proj_tinash.activity_log (actor_id, verb, entity_type, entity_id)
  values (auth.uid(), 'issued a new onboarding link', 'assignment', p_assignment);
  return v_token;
end;
$$;
revoke all on function proj_tinash.rotate_assignment_token(uuid) from public, anon;
grant execute on function proj_tinash.rotate_assignment_token(uuid) to authenticated;

/**
 * What a new hire sees at /welcome/<token>. The token is the only credential.
 * Expired, revoked, still-draft or unknown tokens all return null — the same
 * answer — and lookups are rate limited so tokens cannot be guessed at.
 */
create or replace function proj_tinash.onboarding_pack(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a proj_tinash.assignments%rowtype;
  e proj_tinash.employees%rowtype;
  w proj_tinash.workflows%rowtype;
begin
  perform proj_tinash._rate_limit('pack', 30, interval '10 minutes', 2000, interval '1 hour');

  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,128}$' then
    return null;
  end if;

  select * into a from proj_tinash.assignments
   where token = p_token and status in ('sent', 'in_progress') and expires_at > now();
  if not found then
    return null;
  end if;

  select * into e from proj_tinash.employees where id = a.employee_id;
  select * into w from proj_tinash.workflows where id = a.workflow_id;

  update proj_tinash.assignments
     set open_count = open_count + 1, last_opened_at = now(),
         status = case when status = 'sent' then 'in_progress' else status end
   where id = a.id;

  return jsonb_build_object(
    'workflow', jsonb_build_object('name', w.name, 'summary', w.summary, 'kind', w.kind),
    'first_name', split_part(e.full_name, ' ', 1),
    'job_title', e.job_title,
    'start_date', e.start_date,
    'due_on', a.due_on,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'position', s.position, 'title', s.title, 'body', s.body, 'owner_side', s.owner_side,
               'documents', coalesce((
                 select jsonb_agg(jsonb_build_object('title', d.title, 'description', d.description,
                                                     'path', d.path, 'mime', d.mime, 'size', d.size)
                                  order by d.title)
                   from proj_tinash.workflow_step_documents sd
                   join proj_tinash.documents d on d.id = sd.document_id
                  where sd.step_id = s.id), '[]'::jsonb))
             order by s.position)
        from proj_tinash.workflow_steps s where s.workflow_id = w.id), '[]'::jsonb));
end;
$$;
revoke all on function proj_tinash.onboarding_pack(text) from public;
grant execute on function proj_tinash.onboarding_pack(text) to anon, authenticated;

-- Example onboarding workflow — TODO(confirm) the real steps with Tinash
-- before enabling. Uncomment, edit, and run in the SQL editor.
--
-- with w as (
--   insert into proj_tinash.workflows (name, summary, kind)
--   values ('New caregiver onboarding',
--           'Everything you need before your first shift. Work through it at your own pace.', 'onboarding')
--   returning id
-- )
-- insert into proj_tinash.workflow_steps (workflow_id, position, title, body, owner_side)
-- select w.id, s.position, s.title, s.body, s.owner_side from w, (values
--   (1, 'Complete your new-hire paperwork', 'The office will send you the forms.', 'hire'),
--   (2, 'Copies of your certifications', 'Bring or send a copy of your current certifications.', 'hire'),
--   (3, 'Orientation call', 'We will call you to walk through policies and your first client.', 'office')
-- ) as s(position, title, body, owner_side);

-- ─── e. The first administrator ────────────────────────────────────────────
-- Run ONE of these in the SQL editor (as the project owner), replacing the email.
--
-- Option 1 — before they ever sign in (recommended). The invite is applied the
-- first time that email signs in at /login (trigger on auth.users), and the
-- optional before-user-created hook lets this email through:
--
--   insert into proj_tinash.team_invites (email, role, job_title)
--   values (lower('owner@tinashhomecareservices.com'), 'admin', 'Owner');
--
-- Option 2 — after they have signed in once (they currently see "not on the
-- Tinash team"):
--
--   select proj_tinash._grant_team_role(u.id, 'admin', 'Owner')
--     from auth.users u
--    where lower(u.email) = lower('owner@tinashhomecareservices.com');
--
-- Everyone after that is added from the CRM: Settings -> Team and access.

