-- Secretary may work with active records and receive tasks, but remains outside
-- Admin-only account, audit, archive, settings, and backup permissions.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'staff', 'secretary'));

create or replace function public.is_active_user(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and status = 'active' and role in ('admin', 'staff', 'secretary')
  );
$$;

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'Task creator cannot be changed';
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

create function public.active_personnel_directory()
returns table(id uuid, full_name text)
language sql security definer stable set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'Personnel member')
  from public.profiles p
  where public.is_active_user(auth.uid())
    and p.role in ('staff', 'secretary') and p.status = 'active'
  order by 2, 1;
$$;
revoke all on function public.active_personnel_directory() from public, anon;
grant execute on function public.active_personnel_directory() to authenticated;

-- Keep the previous RPC during deployment so an older app instance can still
-- serve requests while the new version rolls out.
create or replace function public.active_staff_directory()
returns table(id uuid, full_name text)
language sql security definer stable set search_path = public as $$
  select * from public.active_personnel_directory();
$$;
