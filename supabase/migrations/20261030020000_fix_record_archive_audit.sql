-- PL/pgSQL evaluates fields in Boolean conditions; keep table-specific fields in separate branches.
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
    if new.status is distinct from old.status then
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
