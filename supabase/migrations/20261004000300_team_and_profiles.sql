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
