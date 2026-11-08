create or replace function public.guard_attorney_archive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_archived is distinct from old.is_archived then
    if new.is_archived then
      if not public.can_manage_records(auth.uid()) then raise exception 'Access denied'; end if;
      if exists(select 1 from public.clients where attorney_id = old.id and not is_archived) then
        raise exception 'Reassign all current linked clients before archiving this attorney';
      end if;
    elsif not public.is_admin(auth.uid()) then
      raise exception 'Only Admin may restore attorneys';
    end if;
  end if;
  return new;
end; $$;

create or replace function public.guard_client_archive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_archived is distinct from old.is_archived then
    if auth.uid() is not null and not public.is_admin(auth.uid()) then
      raise exception 'Only Admin may archive or restore clients';
    end if;
    if not new.is_archived then
      perform 1 from public.attorneys where id = new.attorney_id and not is_archived for share;
      if not found then raise exception 'Restore the attorney before restoring this client'; end if;
    end if;
  end if;
  return new;
end; $$;
