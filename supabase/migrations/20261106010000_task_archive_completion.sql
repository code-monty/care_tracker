-- Archive tasks without losing review history or metadata-only audit events.
alter table public.tasks add column is_archived boolean not null default false;
create index tasks_archived_idx on public.tasks(id) where is_archived;
grant select (is_archived) on public.tasks to authenticated;

drop policy tasks_read_active on public.tasks;
create policy tasks_read_active on public.tasks for select to authenticated
  using (public.is_active_user(auth.uid()) and (not is_archived or public.is_admin(auth.uid())));
drop policy tasks_submit_assigned on public.tasks;
create policy tasks_submit_assigned on public.tasks for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status in ('open', 'needs_changes') and not is_archived)
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status = 'awaiting_approval' and not is_archived);

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and status = 'active';
  if tg_op = 'INSERT' and new.submission_comment is not null then
    raise exception 'New tasks cannot include a submission comment';
  end if;
  if tg_op = 'INSERT' and new.is_archived then
    raise exception 'New tasks must start active';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'awaiting_approval' and
      (to_jsonb(new) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at') is distinct from
      (to_jsonb(old) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at') then
      raise exception 'Task details are locked during review';
    end if;
    if old.is_archived and (to_jsonb(new) - 'is_archived' - 'updated_at') is distinct from
      (to_jsonb(old) - 'is_archived' - 'updated_at') then
      raise exception 'Archived task details cannot be changed';
    end if;
    if v_role = 'staff' and (
      old.assigned_to is distinct from auth.uid()
      or old.status not in ('open', 'needs_changes') or new.status <> 'awaiting_approval'
      or new.review_comment is not null or new.is_archived
      or (old.status = 'open' and new.submission_comment is not null)
      or (to_jsonb(new) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at') is distinct from
         (to_jsonb(old) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at')
    ) then raise exception 'Staff may only submit their own assigned task'; end if;
    if v_role = 'staff' and old.status = 'needs_changes'
      and (new.submission_comment is null or length(trim(new.submission_comment)) = 0) then
      raise exception 'A resubmission comment is required';
    end if;
    if v_role = 'secretary' and (new.status is distinct from old.status
      or new.review_comment is distinct from old.review_comment
      or new.submission_comment is distinct from old.submission_comment) then
      raise exception 'Secretary cannot change task review';
    end if;
    if v_role = 'secretary' and new.is_archived is distinct from old.is_archived then
      raise exception 'Secretary cannot archive tasks';
    end if;
    if v_role = 'admin' then
      if new.is_archived is distinct from old.is_archived and not (
        old.status <> 'awaiting_approval' and new.status = old.status
        and (to_jsonb(new) - 'is_archived' - 'updated_at') is not distinct from
            (to_jsonb(old) - 'is_archived' - 'updated_at')
      ) then raise exception 'Task archive requires an unlocked task'; end if;
      if new.status is distinct from old.status and not (
        (old.status in ('open', 'needs_changes') and new.status = 'done' and not old.is_archived)
        or (old.status = 'awaiting_approval' and new.status in ('done', 'needs_changes'))
      ) then raise exception 'Invalid Admin task transition'; end if;
      if old.status = 'open' and new.status = 'done' and not exists (
        select 1 from public.profiles where id = old.assigned_to and role = 'secretary' and status = 'active'
      ) then raise exception 'Staff work requires a submission before completion'; end if;
      if new.review_comment is distinct from old.review_comment and not
        (old.status = 'awaiting_approval' and new.status = 'needs_changes') then
        raise exception 'Review comment requires a return decision';
      end if;
      if old.status = 'awaiting_approval' and new.status = 'needs_changes'
        and (new.review_comment is null or length(trim(new.review_comment)) = 0
          or new.review_comment is not distinct from old.review_comment) then
        raise exception 'A new review comment is required';
      end if;
      if new.submission_comment is distinct from old.submission_comment and not
        (old.status = 'awaiting_approval' and new.status in ('done', 'needs_changes')
          and new.submission_comment is null) then
        raise exception 'Submission comment can only be cleared after review';
      end if;
      if old.status = 'awaiting_approval' and new.status in ('done', 'needs_changes')
        and new.submission_comment is not null then
        raise exception 'Submission comment must be cleared after review';
      end if;
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Task creator cannot be changed';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.is_archived and not new.is_archived and not exists (
    select 1 from public.clients where id = new.client_id and status = 'active' and not is_archived
  ) then
    raise exception 'Select an active client';
  end if;
  if not new.is_archived then
    if not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
      raise exception 'Select an available client';
    end if;
    if not exists (select 1 from public.profiles
      where id = new.assigned_to and role in ('staff', 'secretary') and status = 'active') then
      raise exception 'Select an active personnel member';
    end if;
  end if;
  return new;
end; $$;

create or replace view public.deadline_status with (security_invoker = true) as
select t.id, t.client_id, t.title, t.assigned_to, t.due_date, t.status,
  case
    when t.status = 'done' then 'Done'
    when t.due_date < (now() at time zone 'Asia/Manila')::date then 'Overdue'
    when t.due_date <= (now() at time zone 'Asia/Manila')::date + 3 then 'Due Soon'
    else 'Upcoming'
  end as deadline_status
from public.tasks t where not t.is_archived;

-- Branch on table name before reading task-only fields.
create or replace function public.audit_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new,old); end if;
  if TG_OP = 'INSERT' then
    verb := 'create';
  elsif TG_TABLE_NAME = 'clients' or TG_TABLE_NAME = 'attorneys' then
    if new.is_archived is distinct from old.is_archived then
      verb := case when new.is_archived then 'archive' else 'restore' end;
    else verb := 'update'; end if;
  elsif TG_TABLE_NAME = 'tasks' then
    if new.is_archived is distinct from old.is_archived then
      verb := case when new.is_archived then 'archive' else 'restore' end;
    elsif new.status is distinct from old.status then
      verb := case when new.status = 'done' then 'complete' else 'status_change' end;
    elsif new.assigned_to is distinct from old.assigned_to then verb := 'assign';
    else verb := 'update'; end if;
  elsif TG_TABLE_NAME = 'appointments' then
    if new.status is distinct from old.status then verb := 'status_change';
    else verb := 'update'; end if;
  else verb := 'update'; end if;
  perform public.log_activity(actor, verb, TG_TABLE_NAME, record_id);
  return coalesce(new,old);
end; $$;
