-- Managers may create tasks, but every new task must enter the review workflow as open.
create function public.guard_new_task_review_state() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'open' or new.review_comment is not null then
    raise exception 'New tasks must start open without review feedback';
  end if;
  return new;
end; $$;
create trigger tasks_initial_review_state before insert on public.tasks
  for each row execute function public.guard_new_task_review_state();
