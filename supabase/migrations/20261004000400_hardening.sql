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
