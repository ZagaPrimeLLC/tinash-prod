-- Ported from the MMD project (20261001120000_board_blocked_stage.sql), mmd -> tinash.

-- A "Blocked" column on the work board: stuck work, waiting on someone or something.
alter table proj_tinash.tasks drop constraint if exists tasks_stage_check;
alter table proj_tinash.tasks add constraint tasks_stage_check
  check (stage in ('backlog', 'todo', 'in_progress', 'blocked', 'review', 'done'));
