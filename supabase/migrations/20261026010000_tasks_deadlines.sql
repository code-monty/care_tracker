-- Client tasks and Manila-date deadline status (FR-TSK-01 to 04).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  title text not null check (length(trim(title)) between 1 and 120),
  assigned_to uuid not null references public.profiles(id),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_client_idx on public.tasks(client_id);
create index tasks_open_due_idx on public.tasks(due_date) where status = 'open';
create index tasks_assignee_idx on public.tasks(assigned_to);

alter table public.tasks enable row level security;
create policy tasks_read_active on public.tasks for select to authenticated using (public.is_active_user(auth.uid()));
create policy tasks_insert_active on public.tasks for insert to authenticated with check (public.is_active_user(auth.uid()) and created_by = auth.uid());
create policy tasks_update_active on public.tasks for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()) and created_by is not null);
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

create function public.guard_task() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'Task creator cannot be changed';
  end if;
  if not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
    raise exception 'Select an available client';
  end if;
  if not exists (select 1 from public.profiles where id = new.assigned_to and role = 'staff' and status = 'active') then
    raise exception 'Select an active staff member';
  end if;
  return new;
end; $$;
create trigger tasks_guard before insert or update on public.tasks for each row execute function public.guard_task();
create trigger tasks_audit after insert or update on public.tasks for each row execute function public.audit_record_change();

create or replace function public.audit_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new,old); end if;
  if TG_OP = 'INSERT' then
    verb := 'create';
  elsif TG_TABLE_NAME = 'clients' then
    if new.is_archived is distinct from old.is_archived then
      verb := case when new.is_archived then 'archive' else 'restore' end;
    else verb := 'update'; end if;
  elsif TG_TABLE_NAME = 'appointments' or TG_TABLE_NAME = 'tasks' then
    if new.status is distinct from old.status then verb := 'status_change';
    else verb := 'update'; end if;
  else verb := 'update'; end if;
  perform public.log_activity(actor, verb, TG_TABLE_NAME, record_id);
  return coalesce(new,old);
end; $$;

-- Exposes only identifiers and display names needed for the assignee picker.
create function public.active_staff_directory()
returns table(id uuid, full_name text)
language sql security definer stable set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'Staff member')
  from public.profiles p
  where public.is_active_user(auth.uid()) and p.role = 'staff' and p.status = 'active'
  order by 2, 1;
$$;
revoke all on function public.active_staff_directory() from public, anon;
grant execute on function public.active_staff_directory() to authenticated;

create view public.deadline_status with (security_invoker = true) as
select t.id, t.client_id, t.title, t.assigned_to, t.due_date, t.status,
  case
    when t.status = 'done' then 'Done'
    when t.due_date < (now() at time zone 'Asia/Manila')::date then 'Overdue'
    when t.due_date <= (now() at time zone 'Asia/Manila')::date + 3 then 'Due Soon'
    else 'Upcoming'
  end as deadline_status
from public.tasks t;
revoke all on public.deadline_status from public, anon;
grant select on public.deadline_status to authenticated;
