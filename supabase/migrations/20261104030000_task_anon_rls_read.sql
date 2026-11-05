-- Preserve the established anonymous read probe; tasks_read_active still returns no rows.
grant select (id, client_id, title, assigned_to, due_date, status, created_by, created_at, updated_at)
  on public.tasks to anon;
