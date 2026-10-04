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
