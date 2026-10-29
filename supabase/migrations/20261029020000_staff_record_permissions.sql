-- Staff can read shared records and complete only their own assigned tasks.
create function public.can_manage_records(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and status = 'active' and role in ('admin', 'secretary')
  );
$$;
revoke all on function public.can_manage_records(uuid) from public, anon;
grant execute on function public.can_manage_records(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['attorneys', 'clients', 'respondents', 'appointments'] loop
    execute format('drop policy %I on public.%I', t || '_insert_active', t);
    execute format('drop policy %I on public.%I', t || '_update_active', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_records(auth.uid()))', t || '_insert_managers', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_records(auth.uid())) with check (public.can_manage_records(auth.uid()))', t || '_update_managers', t);
  end loop;
end $$;

drop policy tasks_insert_active on public.tasks;
drop policy tasks_update_active on public.tasks;
create policy tasks_insert_managers on public.tasks for insert to authenticated
  with check (public.can_manage_records(auth.uid()) and created_by = auth.uid());
create policy tasks_update_managers on public.tasks for update to authenticated
  using (public.can_manage_records(auth.uid())) with check (public.can_manage_records(auth.uid()));
create policy tasks_complete_assigned on public.tasks for update to authenticated
  using (public.is_active_user(auth.uid()) and assigned_to = auth.uid() and status = 'open')
  with check (public.is_active_user(auth.uid()) and assigned_to = auth.uid() and status = 'done');

create or replace function public.guard_task() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_staff boolean;
begin
  select role = 'staff' into v_staff from public.profiles
  where id = auth.uid() and status = 'active';
  if coalesce(v_staff, false) and tg_op = 'UPDATE' then
    if old.assigned_to is distinct from auth.uid() or old.status <> 'open' or new.status <> 'done'
      or (to_jsonb(new) - 'status' - 'updated_at') is distinct from
         (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception 'Staff may only complete their own assigned task';
    end if;
  end if;
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

create or replace function public.create_client_record(p_client jsonb, p_attorney_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_attorney_id uuid; v_client_id uuid; v_user_id uuid;
begin
  v_user_id := auth.uid();
  if not public.can_manage_records(v_user_id) then raise exception 'Access denied'; end if;
  if p_attorney_id is null then
    insert into public.attorneys(full_name,contact_no,email)
    values(p_client->>'attorneyName',p_client->>'attorneyContact',p_client->>'attorneyEmail')
    returning id into v_attorney_id;
  else
    select id into v_attorney_id from public.attorneys where id = p_attorney_id;
    if v_attorney_id is null then raise exception 'Attorney unavailable'; end if;
  end if;
  insert into public.clients(full_name,birthdate,contact_no,email,address,attorney_id,created_by)
  values(p_client->>'petitionerName',(p_client->>'petitionerBirthdate')::date,p_client->>'petitionerContact',p_client->>'petitionerEmail',p_client->>'petitionerAddress',v_attorney_id,v_user_id)
  returning id into v_client_id;
  insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address)
  values(v_client_id,p_client->>'respondentName',(p_client->>'respondentBirthdate')::date,p_client->>'respondentContact',p_client->>'respondentEmail',p_client->>'respondentAddress');
  return v_client_id;
end; $$;
