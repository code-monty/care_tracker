-- Secretary may manage task details but only Admin and assigned Staff may complete tasks.
drop policy tasks_complete_assigned on public.tasks;
create policy tasks_complete_assigned on public.tasks for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status = 'open')
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'staff' and status = 'active')
    and assigned_to = auth.uid() and status = 'done');

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid() and status = 'active';
  if tg_op = 'UPDATE' then
    if v_role = 'secretary' and new.status is distinct from old.status then
      raise exception 'Secretary cannot change task status';
    end if;
    if v_role = 'staff' and (
      old.assigned_to is distinct from auth.uid() or old.status <> 'open' or new.status <> 'done'
      or (to_jsonb(new) - 'status' - 'updated_at') is distinct from
         (to_jsonb(old) - 'status' - 'updated_at')
    ) then
      raise exception 'Staff may only complete their own assigned task';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Task creator cannot be changed';
    end if;
  end if;
  if not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
    raise exception 'Select an available client';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = new.assigned_to and role in ('staff', 'secretary') and status = 'active'
  ) then
    raise exception 'Select an active personnel member';
  end if;
  return new;
end; $$;
