-- The current return comment is transition state for the trigger, not a shared task field.
-- Review feedback is read through task_review_events RLS by Admin and the assignee.
revoke select on public.tasks from public, anon, authenticated;
grant select (id, client_id, title, assigned_to, due_date, status, created_by, created_at, updated_at)
  on public.tasks to authenticated;
