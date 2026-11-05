-- Staff submission and Admin review; task content and comments never enter activity_log.
alter table public.tasks drop constraint tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'awaiting_approval', 'needs_changes', 'done'));
alter table public.tasks add column review_comment text;
alter table public.tasks add constraint tasks_review_comment_length
  check (review_comment is null or length(trim(review_comment)) between 1 and 1000);
create index tasks_awaiting_approval_idx on public.tasks(updated_at)
  where status = 'awaiting_approval';

create table public.task_review_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  actor_id uuid not null references public.profiles(id),
  event text not null check (event in ('submitted', 'approved', 'returned', 'completed')),
  comment text check (comment is null or length(trim(comment)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index task_review_events_task_idx on public.task_review_events(task_id, created_at, id);
alter table public.task_review_events enable row level security;
create policy task_review_events_read on public.task_review_events for select to authenticated
  using (public.is_active_user(auth.uid()) and exists (
    select 1 from public.tasks t where t.id = task_id
    and (t.assigned_to = auth.uid() or public.is_admin(auth.uid()))
  ));
-- Only the trusted task trigger writes history. No authenticated insert/update/delete policy.

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and status = 'active';
  if tg_op = 'UPDATE' then
    if old.status = 'awaiting_approval' and
      (to_jsonb(new) - 'status' - 'review_comment' - 'updated_at') is distinct from
      (to_jsonb(old) - 'status' - 'review_comment' - 'updated_at') then
      raise exception 'Task details are locked during review';
    end if;
    if v_role = 'staff' and (
      old.assigned_to is distinct from auth.uid()
      or old.status not in ('open', 'needs_changes') or new.status <> 'awaiting_approval'
      or new.review_comment is not null
      or (to_jsonb(new) - 'status' - 'review_comment' - 'updated_at') is distinct from
         (to_jsonb(old) - 'status' - 'review_comment' - 'updated_at')
    ) then raise exception 'Staff may only submit their own assigned task'; end if;
    if v_role = 'secretary' and (new.status is distinct from old.status
      or new.review_comment is distinct from old.review_comment) then
      raise exception 'Secretary cannot change task review';
    end if;
    if v_role = 'admin' then
      if new.status is distinct from old.status and not (
        (old.status in ('open', 'needs_changes') and new.status = 'done')
        or (old.status = 'awaiting_approval' and new.status in ('done', 'needs_changes'))
      ) then raise exception 'Invalid Admin task transition'; end if;
      if new.review_comment is distinct from old.review_comment and not
        (old.status = 'awaiting_approval' and new.status = 'needs_changes') then
        raise exception 'Review comment requires a return decision';
      end if;
      if old.status = 'awaiting_approval' and new.status = 'needs_changes'
        and (new.review_comment is null or length(trim(new.review_comment)) = 0
          or new.review_comment is not distinct from old.review_comment) then
        raise exception 'A new review comment is required';
      end if;
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Task creator cannot be changed';
    end if;
  end if;
  if not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
    raise exception 'Select an available client';
  end if;
  if not exists (select 1 from public.profiles
    where id = new.assigned_to and role in ('staff', 'secretary') and status = 'active') then
    raise exception 'Select an active personnel member';
  end if;
  return new;
end; $$;

create function public.record_task_review_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_event text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_event := case
    when new.status = 'awaiting_approval' then 'submitted'
    when new.status = 'needs_changes' then 'returned'
    when new.status = 'done' and old.status = 'awaiting_approval' then 'approved'
    when new.status = 'done' then 'completed'
  end;
  if v_event is not null then
    insert into public.task_review_events(task_id, actor_id, event, comment)
    values (new.id, auth.uid(), v_event,
      case when v_event = 'returned' then trim(new.review_comment) else null end);
  end if;
  return new;
end; $$;
create trigger tasks_review_event after update on public.tasks
  for each row execute function public.record_task_review_event();

create or replace view public.deadline_status with (security_invoker = true) as
select t.id, t.client_id, t.title, t.assigned_to, t.due_date, t.status,
  case
    when t.status = 'done' then 'Done'
    when t.due_date < (now() at time zone 'Asia/Manila')::date then 'Overdue'
    when t.due_date <= (now() at time zone 'Asia/Manila')::date + 3 then 'Due Soon'
    else 'Upcoming'
  end as deadline_status
from public.tasks t;

drop policy tasks_complete_assigned on public.tasks;
create policy tasks_submit_assigned on public.tasks for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status in ('open', 'needs_changes'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status = 'awaiting_approval');
