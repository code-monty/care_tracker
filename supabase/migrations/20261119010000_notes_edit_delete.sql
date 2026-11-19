-- Authors and active Admins can edit or delete notes and replies; notes with replies cannot be deleted.
alter table public.note_pins drop constraint note_pins_note_id_fkey;
alter table public.note_pins add constraint note_pins_note_id_fkey
  foreign key (note_id) references public.notes(id) on delete cascade;

create or replace function public.guard_note_mutation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Access denied'; end if;
  if old.author_id is distinct from auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Access denied';
  end if;
  if old.client_id is not null and not exists (select 1 from public.clients where id = old.client_id and not is_archived) then
    raise exception 'Client unavailable';
  end if;
  if old.attorney_id is not null and not exists (select 1 from public.attorneys where id = old.attorney_id and not is_archived) then
    raise exception 'Attorney unavailable';
  end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'body') is distinct from (to_jsonb(old) - 'body') then
      raise exception 'Note metadata cannot be changed';
    end if;
    new.body := trim(new.body);
    return new;
  end if;
  if exists (select 1 from public.note_replies where note_id = old.id) then
    raise exception 'Cannot delete a note that has replies';
  end if;
  return old;
end; $$;
create trigger notes_mutation_guard before update or delete on public.notes
  for each row execute function public.guard_note_mutation();

create or replace function public.guard_note_reply_mutation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Access denied'; end if;
  if old.author_id is distinct from auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Access denied';
  end if;
  if not exists (
    select 1 from public.notes n
    left join public.clients c on c.id = n.client_id
    left join public.attorneys a on a.id = n.attorney_id
    where n.id = old.note_id and coalesce(c.is_archived, a.is_archived) = false
  ) then raise exception 'Note unavailable'; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'body') is distinct from (to_jsonb(old) - 'body') then
      raise exception 'Reply metadata cannot be changed';
    end if;
    new.body := trim(new.body);
    return new;
  end if;
  return old;
end; $$;
create trigger note_replies_mutation_guard before update or delete on public.note_replies
  for each row execute function public.guard_note_reply_mutation();

create policy notes_update_own_or_admin on public.notes for update to authenticated
  using (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())))
  with check (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())));
create policy notes_delete_own_or_admin on public.notes for delete to authenticated
  using (
    public.is_active_user(auth.uid())
    and (author_id = auth.uid() or public.is_admin(auth.uid()))
    and not exists (select 1 from public.note_replies r where r.note_id = notes.id)
  );
grant update (body), delete on public.notes to authenticated;

create policy note_replies_update_own_or_admin on public.note_replies for update to authenticated
  using (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())))
  with check (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())));
create policy note_replies_delete_own_or_admin on public.note_replies for delete to authenticated
  using (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())));
grant update (body), delete on public.note_replies to authenticated;

create or replace function public.audit_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new,old); end if;
  if TG_OP = 'INSERT' then
    verb := 'create';
  elsif TG_OP = 'DELETE' then
    verb := 'delete';
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

drop trigger notes_audit on public.notes;
create trigger notes_audit after insert or update or delete on public.notes
  for each row execute function public.audit_record_change();

drop trigger note_replies_audit on public.note_replies;
create trigger note_replies_audit after insert or update or delete on public.note_replies
  for each row execute function public.audit_record_change();
