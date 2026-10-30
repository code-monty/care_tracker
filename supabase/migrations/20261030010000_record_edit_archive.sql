alter table public.attorneys add column is_archived boolean not null default false;
create index attorneys_available_idx on public.attorneys(id) where not is_archived;

create or replace function public.guard_attorney_archive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_archived is distinct from old.is_archived then
    if new.is_archived then
      if not public.can_manage_records(auth.uid()) then raise exception 'Access denied'; end if;
      if exists(select 1 from public.clients where attorney_id = old.id) then
        raise exception 'Reassign all linked clients before archiving this attorney';
      end if;
    elsif not public.is_admin(auth.uid()) then
      raise exception 'Only Admin may restore attorneys';
    end if;
  end if;
  return new;
end; $$;
create trigger attorneys_archive_guard before update on public.attorneys
for each row execute function public.guard_attorney_archive();

create or replace function public.update_client_record(p_id uuid, p_client jsonb, p_attorney_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_manage_records(auth.uid()) then raise exception 'Access denied'; end if;
  if not exists(select 1 from public.attorneys where id = p_attorney_id and not is_archived) then
    raise exception 'Select an available attorney';
  end if;
  update public.clients set
    full_name = p_client->>'petitionerName', birthdate = (p_client->>'petitionerBirthdate')::date,
    contact_no = p_client->>'petitionerContact', email = p_client->>'petitionerEmail',
    address = p_client->>'petitionerAddress', attorney_id = p_attorney_id
  where id = p_id and not is_archived;
  if not found then raise exception 'Client unavailable'; end if;
  update public.respondents set
    full_name = p_client->>'respondentName', birthdate = (p_client->>'respondentBirthdate')::date,
    contact_no = p_client->>'respondentContact', email = p_client->>'respondentEmail',
    address = p_client->>'respondentAddress'
  where client_id = p_id;
  if not found then raise exception 'Respondent unavailable'; end if;
end; $$;
revoke all on function public.update_client_record(uuid,jsonb,uuid) from public, anon;
grant execute on function public.update_client_record(uuid,jsonb,uuid) to authenticated;

create or replace function public.guard_client_attorney() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.attorneys where id = new.attorney_id and not is_archived) then
    raise exception 'Select an available attorney';
  end if;
  return new;
end; $$;
create trigger clients_attorney_guard before insert or update of attorney_id on public.clients
for each row execute function public.guard_client_attorney();

create or replace function public.audit_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new,old); end if;
  if TG_TABLE_NAME in ('clients', 'attorneys') and TG_OP = 'UPDATE'
     and new.is_archived is distinct from old.is_archived then
    verb := case when new.is_archived then 'archive' else 'restore' end;
  elsif TG_TABLE_NAME = 'appointments' and TG_OP = 'UPDATE'
     and new.status is distinct from old.status then
    verb := 'status_change';
  elsif TG_TABLE_NAME = 'tasks' and TG_OP = 'UPDATE' and new.status is distinct from old.status then
    verb := case when new.status = 'done' then 'complete' else 'status_change' end;
  elsif TG_TABLE_NAME = 'tasks' and TG_OP = 'UPDATE' and new.assigned_to is distinct from old.assigned_to then
    verb := 'assign';
  else verb := case when TG_OP = 'INSERT' then 'create' else 'update' end;
  end if;
  perform public.log_activity(actor, verb, TG_TABLE_NAME, record_id);
  return coalesce(new,old);
end; $$;
