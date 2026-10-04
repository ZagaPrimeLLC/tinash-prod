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
