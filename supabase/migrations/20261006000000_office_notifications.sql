-- Office email notifications for website submissions.
--
-- After a new inquiry / booking / application / newsletter signup is saved,
-- a trigger asks the `notify-office` Edge Function (supabase/functions/
-- notify-office) to email the office. pg_net sends the request in the
-- background, so the visitor's insert never waits on email and can never fail
-- because of it (any error here is swallowed).
--
-- The request carries only { table, id }; the function re-reads the record
-- with the service role and uses notification_log to send each one once.

create extension if not exists pg_net with schema extensions;

create table if not exists proj_tinash.notification_log (
  table_name text not null,
  record_id  uuid not null,
  sent_at    timestamptz not null default now(),
  primary key (table_name, record_id)
);
alter table proj_tinash.notification_log enable row level security;
-- No policies: only the service role (the Edge Function) touches this table.
revoke all on proj_tinash.notification_log from anon, authenticated;
grant all on proj_tinash.notification_log to service_role;

create or replace function proj_tinash.notify_office_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://xqvtmvxcrgnlmvnlkunl.supabase.co/functions/v1/notify-office',
      body := jsonb_build_object('table', tg_table_name, 'id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  exception when others then
    -- Never let a notification problem block a submission.
    raise warning 'notify_office_trigger: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function proj_tinash.notify_office_trigger() from public, anon, authenticated;

drop trigger if exists notify_office on proj_tinash.inquiries;
create trigger notify_office after insert on proj_tinash.inquiries
  for each row execute function proj_tinash.notify_office_trigger();

drop trigger if exists notify_office on proj_tinash.bookings;
create trigger notify_office after insert on proj_tinash.bookings
  for each row execute function proj_tinash.notify_office_trigger();

drop trigger if exists notify_office on proj_tinash.applications;
create trigger notify_office after insert on proj_tinash.applications
  for each row execute function proj_tinash.notify_office_trigger();

drop trigger if exists notify_office on proj_tinash.newsletter_subscribers;
create trigger notify_office after insert on proj_tinash.newsletter_subscribers
  for each row execute function proj_tinash.notify_office_trigger();
