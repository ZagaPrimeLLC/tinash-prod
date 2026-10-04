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
