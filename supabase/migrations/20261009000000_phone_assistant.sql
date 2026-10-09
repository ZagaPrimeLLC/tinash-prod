-- ═══════════════════════════════════════════════════════════════════════════
-- Phone Assistant: the call log, the settings the office edits in the CRM,
-- and the devices (the Raspberry Pi receptionist) allowed to read those
-- settings and log calls.
--
-- ACCESS MODEL:
--   * The team reads calls, devices and settings; admin/ops change settings.
--     Nobody edits or deletes a call from the CRM.
--   * anon gets no table access at all. The receptionist talks to three
--     SECURITY DEFINER functions with the public key plus its device token.
--     Only the SHA-256 of a device token is stored, so a database read never
--     reveals a usable token.
--   * phone_device_log_call creates the inbox lead itself (when test mode is
--     off), so the office email (notify_office trigger) fires exactly as it
--     does for a website form.
--
-- PHI BOUNDARY: the same as inquiries. Contact details and what the caller
-- asked for. Transcripts are kept for phone_settings.transcript_retention_days
-- and then blanked (transcript set to null) by phone_device_log_call.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Devices ───────────────────────────────────────────────────────────────

create table proj_tinash.phone_devices (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  -- encode(sha256(convert_to(<token>, 'UTF8')), 'hex'); the token itself is never stored.
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last_seen_at timestamptz,
  status       jsonb check (status is null or (jsonb_typeof(status) = 'object' and pg_column_size(status) < 8000)),
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ─── Calls ─────────────────────────────────────────────────────────────────

create table proj_tinash.phone_calls (
  id                 uuid primary key default gen_random_uuid(),
  device_id          uuid references proj_tinash.phone_devices(id) on delete set null,
  carrier            text check (carrier is null or char_length(carrier) <= 20),
  carrier_call_id    text check (carrier_call_id is null or char_length(carrier_call_id) <= 200),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  duration_secs      numeric check (duration_secs is null or duration_secs >= 0),
  caller_number      text check (caller_number is null or char_length(caller_number) <= 40),
  outcome            text not null check (outcome in ('completed', 'partial', 'abandoned', 'failed', 'emergency')),
  end_reason         text check (end_reason is null or char_length(end_reason) <= 200),
  caller_type        text check (caller_type is null or caller_type in ('family', 'job_seeker', 'other')),
  caller_name        text check (caller_name is null or char_length(caller_name) <= 200),
  callback_number    text check (callback_number is null or char_length(callback_number) <= 40),
  service            text check (service is null or char_length(service) <= 120),
  town               text check (town is null or char_length(town) <= 120),
  county             text check (county is null or char_length(county) <= 80),
  urgency            text check (urgency is null or char_length(urgency) <= 200),
  best_callback_time text check (best_callback_time is null or char_length(best_callback_time) <= 200),
  emergency_flagged  boolean not null default false,
  summary            text check (summary is null or char_length(summary) <= 4000),
  intake             jsonb check (intake is null or jsonb_typeof(intake) = 'object'),
  -- [{ "role": "user" | "assistant", "text": "...", "t": <seconds into the call> }]
  -- Blanked after the retention period.
  transcript         jsonb check (transcript is null or jsonb_typeof(transcript) = 'array'),
  inquiry_id         uuid references proj_tinash.inquiries(id) on delete set null,
  test_mode          boolean not null default true,
  brain              text check (brain is null or char_length(brain) <= 80),
  cost_usd           numeric check (cost_usd is null or cost_usd >= 0),
  latency            jsonb check (latency is null or jsonb_typeof(latency) = 'object'),
  created_at         timestamptz not null default now()
);
create index phone_calls_time on proj_tinash.phone_calls (started_at desc);
create index phone_calls_outcome on proj_tinash.phone_calls (outcome);
create index phone_calls_inquiry on proj_tinash.phone_calls (inquiry_id) where inquiry_id is not null;
-- A retried upload of the same call must not log it twice.
create unique index phone_calls_carrier_call on proj_tinash.phone_calls (carrier, carrier_call_id)
  where carrier_call_id is not null;

-- ─── Settings (one row) ────────────────────────────────────────────────────

create table proj_tinash.phone_settings (
  id                        int primary key default 1 check (id = 1),
  enabled                   boolean not null default true,
  -- On: calls are logged here only. Off: real calls also create inbox leads
  -- and email the office.
  test_mode                 boolean not null default true,
  voice_engine              text not null default 'kokoro' check (voice_engine in ('kokoro', 'piper')),
  voice                     text not null default 'af_sarah',
  voice_speed               numeric not null default 1.0 check (voice_speed between 0.8 and 1.2),
  greeting                  text check (greeting is null or char_length(greeting) between 1 and 400),
  farewell                  text check (farewell is null or char_length(farewell) between 1 and 300),
  -- Tone and behaviour guidance appended to the script. The safety rules
  -- (911, no prices, no medical advice) live in the receptionist's code and
  -- script, and come first.
  custom_instructions       text check (custom_instructions is null or char_length(custom_instructions) <= 4000),
  extra_facts               text check (extra_facts is null or char_length(extra_facts) <= 6000),
  transcript_retention_days int not null default 30 check (transcript_retention_days between 1 and 365),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id) on delete set null,
  constraint phone_settings_voice check (
    (voice_engine = 'kokoro' and voice in ('af_sarah', 'af_heart', 'af_bella', 'af_nicole', 'am_michael'))
    or (voice_engine = 'piper' and voice in ('en_US-amy-medium', 'en_US-lessac-high', 'en_US-hfc_female-medium'))
  )
);

-- The greeting and farewell the receptionist uses today (receptionist/prompts.py).
insert into proj_tinash.phone_settings (id, greeting, farewell) values (
  1,
  'Hi, thanks for calling Tinash Homecare Services! I''ll take a few notes so our team can follow up with you. How can I help today?',
  'Thanks so much for calling Tinash Homecare Services. Take care, goodbye.'
) on conflict (id) do nothing;

/** Who changed the settings and when, stamped by the database rather than trusted from the form. */
create or replace function proj_tinash.stamp_phone_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;
revoke all on function proj_tinash.stamp_phone_settings() from public, anon, authenticated;

create trigger stamp_phone_settings before update on proj_tinash.phone_settings
  for each row execute function proj_tinash.stamp_phone_settings();

-- ─── Row Level Security ────────────────────────────────────────────────────

alter table proj_tinash.phone_calls enable row level security;
alter table proj_tinash.phone_devices enable row level security;
alter table proj_tinash.phone_settings enable row level security;

create policy phone_calls_member_read on proj_tinash.phone_calls
  for select to authenticated using (proj_tinash.is_team());
create policy phone_devices_member_read on proj_tinash.phone_devices
  for select to authenticated using (proj_tinash.is_team());
create policy phone_settings_member_read on proj_tinash.phone_settings
  for select to authenticated using (proj_tinash.is_team());
create policy phone_settings_team_update on proj_tinash.phone_settings
  for update to authenticated using (proj_tinash.can_write()) with check (proj_tinash.can_write());

-- Grants. The schema's default privileges give authenticated full table
-- rights (RLS is the lock); narrow them here so the outer bounds match the
-- policies, and make sure anon has nothing.
revoke all on proj_tinash.phone_calls, proj_tinash.phone_devices, proj_tinash.phone_settings from anon;
revoke all on proj_tinash.phone_calls, proj_tinash.phone_devices, proj_tinash.phone_settings from authenticated;
grant select on proj_tinash.phone_calls to authenticated;
-- Not token_hash: the CRM has no reason to read it.
grant select (id, name, last_seen_at, status, revoked_at, created_at) on proj_tinash.phone_devices to authenticated;
grant select on proj_tinash.phone_settings to authenticated;
-- updated_at / updated_by are set by the trigger above.
grant update (enabled, test_mode, voice_engine, voice, voice_speed, greeting, farewell,
              custom_instructions, extra_facts, transcript_retention_days)
  on proj_tinash.phone_settings to authenticated;
grant all on proj_tinash.phone_calls, proj_tinash.phone_devices, proj_tinash.phone_settings to service_role;

-- ─── Public-insert rate limit: let the phone device through ────────────────
-- Same body as the hardening migration, plus one exit: an inquiry written by
-- phone_device_log_call has already passed a device-token check and its own
-- per-device rate limit. Without this, the office Pi would share the
-- 5-per-10-minutes website form limit for its public IP. The setting is
-- transaction-local and set only inside that function; PostgREST gives
-- callers no way to set it.
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
  if tg_table_name = 'inquiries' and current_setting('proj_tinash.trusted_insert', true) = 'phone-device' then
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

-- ─── Device functions (called by the receptionist with the public key) ─────

/**
 * The device a token belongs to, or an error. Internal: not callable over the API.
 * Tokens are long random strings (openssl rand -hex 32), so guessing one is
 * not a practical attack; the per-device rate limits below cap what a leaked
 * token could do until it is revoked.
 */
create or replace function proj_tinash._phone_device(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_token is not null and char_length(p_token) between 32 and 200 then
    select d.id into v_id
      from proj_tinash.phone_devices d
     where d.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
       and d.revoked_at is null;
  end if;
  if v_id is null then
    raise exception 'invalid device token' using errcode = '28000';
  end if;
  return v_id;
end;
$$;
revoke all on function proj_tinash._phone_device(text) from public, anon, authenticated;

/** The settings row for the receptionist (fetched about every 30 seconds). */
create or replace function proj_tinash.phone_device_settings(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := proj_tinash._phone_device(p_token);
  v_out    jsonb;
begin
  perform proj_tinash._rate_limit('phone-settings', 300, interval '10 minutes', 3000, interval '1 hour', v_device::text);

  select jsonb_build_object(
           'enabled', s.enabled,
           'test_mode', s.test_mode,
           'voice_engine', s.voice_engine,
           'voice', s.voice,
           'voice_speed', s.voice_speed,
           'greeting', s.greeting,
           'farewell', s.farewell,
           'custom_instructions', s.custom_instructions,
           'extra_facts', s.extra_facts,
           'transcript_retention_days', s.transcript_retention_days,
           'updated_at', s.updated_at)
    into v_out
    from proj_tinash.phone_settings s
   where s.id = 1;

  if v_out is null then
    raise exception 'phone settings row is missing';
  end if;
  return v_out;
end;
$$;

/** "Still here": last seen time plus a small status object for the CRM. */
create or replace function proj_tinash.phone_device_heartbeat(p_token text, p_status jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device uuid := proj_tinash._phone_device(p_token);
begin
  perform proj_tinash._rate_limit('phone-heartbeat', 60, interval '10 minutes', 1000, interval '1 hour', v_device::text);

  update proj_tinash.phone_devices
     set last_seen_at = now(),
         status = case
                    when p_status is null or jsonb_typeof(p_status) <> 'object' then null
                    when pg_column_size(p_status) >= 8000 then jsonb_build_object('error', 'status too large')
                    else p_status
                  end
   where id = v_device;
end;
$$;

/**
 * Logs one finished call and returns its id.
 *
 * When test mode is off and the call identified a family or a job seeker
 * with a name and a number, it also creates the inbox lead (the columns
 * /api/inquiry writes), which emails the office. Retries of the same carrier
 * call return the existing id instead of logging it twice. Also blanks
 * transcripts older than the retention period.
 */
create or replace function proj_tinash.phone_device_log_call(p_token text, p_call jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device     uuid := proj_tinash._phone_device(p_token);
  s            proj_tinash.phone_settings%rowtype;
  v_id         uuid;
  v_inquiry    uuid;
  v_carrier    text;
  v_carrier_id text;
  v_outcome    text;
  v_type       text;
  v_name       text;
  v_callback   text;
  v_caller     text;
  v_service    text;
  v_summary    text;
  v_transcript jsonb;
begin
  perform proj_tinash._rate_limit('phone-log', 60, interval '10 minutes', 500, interval '1 hour', v_device::text);

  -- Payload checks. A typical call is a few kilobytes; a 15-minute call with
  -- a long transcript stays well under these limits.
  if p_call is null or jsonb_typeof(p_call) <> 'object' then
    raise exception 'p_call must be a JSON object' using errcode = '22023';
  end if;
  if pg_column_size(p_call) > 262144 then
    raise exception 'call record too large' using errcode = '22023';
  end if;
  v_transcript := p_call->'transcript';
  if v_transcript is not null and jsonb_typeof(v_transcript) = 'null' then
    v_transcript := null;
  end if;
  if v_transcript is not null and (jsonb_typeof(v_transcript) <> 'array' or jsonb_array_length(v_transcript) > 2000) then
    raise exception 'transcript must be an array of at most 2000 lines' using errcode = '22023';
  end if;

  v_outcome := p_call->>'outcome';
  if v_outcome is null or v_outcome not in ('completed', 'partial', 'abandoned', 'failed', 'emergency') then
    raise exception 'unknown outcome %', coalesce(v_outcome, 'null') using errcode = '22023';
  end if;

  v_carrier    := left(nullif(trim(p_call->>'carrier'), ''), 20);
  v_carrier_id := left(nullif(trim(p_call->>'carrier_call_id'), ''), 200);
  if v_carrier_id is not null then
    select c.id into v_id from proj_tinash.phone_calls c
     where c.carrier is not distinct from v_carrier and c.carrier_call_id = v_carrier_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  select * into s from proj_tinash.phone_settings where id = 1;
  if not found then
    raise exception 'phone settings row is missing';
  end if;

  v_type     := case when p_call->>'caller_type' in ('family', 'job_seeker', 'other') then p_call->>'caller_type' else 'other' end;
  v_name     := left(nullif(trim(p_call->>'caller_name'), ''), 200);
  v_callback := left(nullif(trim(p_call->>'callback_number'), ''), 40);
  v_caller   := left(nullif(trim(p_call->>'caller_number'), ''), 40);
  v_summary  := left(nullif(trim(p_call->>'summary'), ''), 4000);

  insert into proj_tinash.phone_calls (
    device_id, carrier, carrier_call_id, started_at, ended_at, duration_secs, caller_number,
    outcome, end_reason, caller_type, caller_name, callback_number, service, town, county,
    urgency, best_callback_time, emergency_flagged, summary, intake, transcript, test_mode,
    brain, cost_usd, latency
  ) values (
    v_device, v_carrier, v_carrier_id,
    coalesce(nullif(p_call->>'started_at', '')::timestamptz, now()),
    nullif(p_call->>'ended_at', '')::timestamptz,
    greatest(nullif(p_call->>'duration_secs', '')::numeric, 0),
    v_caller,
    v_outcome,
    left(nullif(trim(p_call->>'end_reason'), ''), 200),
    v_type,
    v_name,
    v_callback,
    left(nullif(trim(p_call->>'service'), ''), 120),
    left(nullif(trim(p_call->>'town'), ''), 120),
    left(nullif(trim(p_call->>'county'), ''), 80),
    left(nullif(trim(p_call->>'urgency'), ''), 200),
    left(nullif(trim(p_call->>'best_callback_time'), ''), 200),
    coalesce((p_call->>'emergency_flagged')::boolean, false),
    v_summary,
    case when jsonb_typeof(p_call->'intake') = 'object' then p_call->'intake' end,
    v_transcript,
    s.test_mode,
    left(nullif(trim(p_call->>'brain'), ''), 80),
    greatest(nullif(p_call->>'cost_usd', '')::numeric, 0),
    case when jsonb_typeof(p_call->'latency') = 'object' then p_call->'latency' end
  )
  returning id into v_id;

  -- The inbox lead, as /api/inquiry would write it. Test mode keeps calls out
  -- of the inbox (and the office's email) entirely.
  if not s.test_mode
     and v_type in ('family', 'job_seeker')
     and v_name is not null
     and coalesce(v_callback, v_caller) is not null then
    v_service := case
      when v_type = 'job_seeker' then 'caregiver-application'
      when p_call->>'service' in ('Not sure yet', 'GUIDE Program', 'Skilled Nursing', 'Daily Senior Care',
                                  'Companion Care', 'Live-In & 24/7 Care', 'Respite Care', 'DDD Services',
                                  'Individual Supports (DDD)', 'Community-Based Supports (DDD)', 'DDD Respite')
        then p_call->>'service'
      else 'Not sure yet'
    end;

    perform set_config('proj_tinash.trusted_insert', 'phone-device', true);
    insert into proj_tinash.inquiries (name, phone, email, service_interested, message, source_page)
    values (v_name, coalesce(v_callback, v_caller), null, v_service,
            coalesce(v_summary, 'Phone assistant call.'), 'phone-assistant')
    returning id into v_inquiry;
    perform set_config('proj_tinash.trusted_insert', '', true);

    update proj_tinash.phone_calls set inquiry_id = v_inquiry where id = v_id;
  end if;

  -- Retention: keep the call row, drop old transcripts.
  update proj_tinash.phone_calls
     set transcript = null
   where transcript is not null
     and started_at < now() - make_interval(days => s.transcript_retention_days);

  return v_id;
end;
$$;

revoke all on function proj_tinash.phone_device_settings(text) from public;
revoke all on function proj_tinash.phone_device_heartbeat(text, jsonb) from public;
revoke all on function proj_tinash.phone_device_log_call(text, jsonb) from public;
grant execute on function proj_tinash.phone_device_settings(text) to anon, authenticated;
grant execute on function proj_tinash.phone_device_heartbeat(text, jsonb) to anon, authenticated;
grant execute on function proj_tinash.phone_device_log_call(text, jsonb) to anon, authenticated;
