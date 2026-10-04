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
