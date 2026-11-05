-- Staff explanations are transition data; only review history exposes them to Admin and the assignee.
alter table public.tasks add column submission_comment text;
alter table public.tasks add constraint tasks_submission_comment_length
  check (submission_comment is null or length(trim(submission_comment)) between 1 and 1000);

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and status = 'active';
  if tg_op = 'INSERT' and new.submission_comment is not null then
    raise exception 'New tasks cannot include a submission comment';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'awaiting_approval' and
      (to_jsonb(new) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at') is distinct from
      (to_jsonb(old) - 'status' - 'review_comment' - 'submission_comment' - 'updated_at') then
      raise exception 'Task details are locked during review';
    end if;
    if v_role = 'staff' and (
      old.assigned_to is distinct from auth.uid()
      or old.status not in ('open', 'needs_changes') or new.status <> 'awaiting_approval'
      or new.review_comment is not null
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
  if not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
    raise exception 'Select an available client';
  end if;
  if not exists (select 1 from public.profiles
    where id = new.assigned_to and role in ('staff', 'secretary') and status = 'active') then
    raise exception 'Select an active personnel member';
  end if;
  return new;
end; $$;

create or replace function public.record_task_review_event() returns trigger
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
      case when v_event = 'returned' then trim(new.review_comment)
           when v_event = 'submitted' then trim(new.submission_comment)
           else null end);
  end if;
  return new;
end; $$;
