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
