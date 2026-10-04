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
