-- Client Procedures / Requirements checklist and per-procedure notes.
create table public.client_procedures (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  procedure_key text not null check (
    procedure_key in (
      'battery_of_exams',
      'marital_history',
      'witnesses',
      'home_visit',
      'letter_of_invitation',
      'judicial_affidavit'
    )
  ),
  sort_order smallint not null check (sort_order between 1 and 6),
  date_created date,
  is_completed boolean not null default false,
  date_completed date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, procedure_key),
  unique (client_id, sort_order),
  constraint client_procedures_completion_consistency check (
    (is_completed and date_completed is not null)
    or (not is_completed and date_completed is null)
  )
);
create index client_procedures_client_order on public.client_procedures(client_id, sort_order);

create function public.seed_client_procedures() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.client_procedures (client_id, procedure_key, sort_order)
  values
    (new.id, 'battery_of_exams', 1),
    (new.id, 'marital_history', 2),
    (new.id, 'witnesses', 3),
    (new.id, 'home_visit', 4),
    (new.id, 'letter_of_invitation', 5),
    (new.id, 'judicial_affidavit', 6)
  on conflict (client_id, procedure_key) do nothing;
  return new;
end; $$;
create trigger clients_seed_procedures after insert on public.clients
  for each row execute function public.seed_client_procedures();

-- Backfill existing client records with the six standard procedures.
insert into public.client_procedures (client_id, procedure_key, sort_order)
select c.id, p.procedure_key, p.sort_order
from public.clients c
cross join (
  values
    ('battery_of_exams', 1::smallint),
    ('marital_history', 2::smallint),
    ('witnesses', 3::smallint),
    ('home_visit', 4::smallint),
    ('letter_of_invitation', 5::smallint),
    ('judicial_affidavit', 6::smallint)
) as p(procedure_key, sort_order)
on conflict (client_id, procedure_key) do nothing;

create function public.guard_client_procedure() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.can_manage_records(auth.uid()) then
    raise exception 'Access denied';
  end if;
  if not exists (select 1 from public.clients where id = old.client_id and not is_archived) then
    raise exception 'Client unavailable';
  end if;
  if new.id is distinct from old.id
    or new.client_id is distinct from old.client_id
    or new.procedure_key is distinct from old.procedure_key
    or new.sort_order is distinct from old.sort_order
    or new.created_at is distinct from old.created_at then
    raise exception 'Procedure metadata cannot be changed';
  end if;
  if new.is_completed then
    if not old.is_completed then
      new.date_completed := (now() at time zone 'Asia/Manila')::date;
    else
      new.date_completed := old.date_completed;
    end if;
  else
    new.date_completed := null;
  end if;
  return new;
end; $$;
create trigger client_procedures_guard before update on public.client_procedures
  for each row execute function public.guard_client_procedure();
create trigger client_procedures_updated_at before update on public.client_procedures
  for each row execute function public.set_updated_at();

alter table public.client_procedures enable row level security;
create policy client_procedures_read_active on public.client_procedures for select to authenticated
  using (public.is_active_user(auth.uid()));
create policy client_procedures_update_managers on public.client_procedures for update to authenticated
  using (public.can_manage_records(auth.uid()))
  with check (public.can_manage_records(auth.uid()));
revoke all on public.client_procedures from anon, authenticated;
grant select, update (date_created, is_completed) on public.client_procedures to authenticated;

-- Per-procedure notes and pins (same attribution & authorization rules as record notes).
create table public.client_procedure_notes (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.client_procedures(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 4000),
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  author_role text not null check (author_role in ('admin', 'secretary', 'staff')),
  created_at timestamptz not null default now()
);
create index client_procedure_notes_order on public.client_procedure_notes(procedure_id, created_at desc, id desc);

create table public.client_procedure_note_pins (
  note_id uuid primary key references public.client_procedure_notes(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id),
  pinned_at timestamptz not null default now()
);

create function public.set_procedure_note_attribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare author public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Access denied'; end if;
  select * into author from public.profiles
  where id = auth.uid() and status = 'active' and role in ('admin', 'secretary', 'staff');
  if not found then raise exception 'Access denied'; end if;
  if not exists (
    select 1 from public.client_procedures p
    join public.clients c on c.id = p.client_id
    where p.id = new.procedure_id and not c.is_archived
  ) then
    raise exception 'Procedure unavailable';
  end if;
  new.author_id := author.id;
  new.author_name := coalesce(nullif(trim(author.full_name), ''), 'Unknown user');
  new.author_role := author.role;
  new.created_at := now();
  new.body := trim(new.body);
  return new;
end; $$;
create trigger procedure_notes_attribution before insert on public.client_procedure_notes
  for each row execute function public.set_procedure_note_attribution();

create function public.guard_procedure_note_mutation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Access denied'; end if;
  if old.author_id is distinct from auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'Access denied';
  end if;
  if not exists (
    select 1 from public.client_procedures p
    join public.clients c on c.id = p.client_id
    where p.id = old.procedure_id and not c.is_archived
  ) then
    raise exception 'Procedure unavailable';
  end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'body') is distinct from (to_jsonb(old) - 'body') then
      raise exception 'Note metadata cannot be changed';
    end if;
    new.body := trim(new.body);
    return new;
  end if;
  return old;
end; $$;
create trigger procedure_notes_mutation_guard before update or delete on public.client_procedure_notes
  for each row execute function public.guard_procedure_note_mutation();

create function public.guard_procedure_note_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Access denied'; end if;
  if not exists (
    select 1 from public.client_procedure_notes n
    join public.client_procedures p on p.id = n.procedure_id
    join public.clients c on c.id = p.client_id
    where n.id = new.note_id and not c.is_archived
  ) then
    raise exception 'Note unavailable';
  end if;
  new.pinned_by := auth.uid();
  new.pinned_at := now();
  return new;
end; $$;
create trigger procedure_note_pins_guard before insert on public.client_procedure_note_pins
  for each row execute function public.guard_procedure_note_pin();

create function public.audit_procedure_note_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    perform public.log_activity(
      auth.uid(),
      case when TG_OP = 'INSERT' then 'pin' else 'unpin' end,
      'client_procedure_notes',
      coalesce(new.note_id, old.note_id)
    );
  end if;
  return coalesce(new, old);
end; $$;
create trigger procedure_note_pins_audit after insert or delete on public.client_procedure_note_pins
  for each row execute function public.audit_procedure_note_pin();

alter table public.client_procedure_notes enable row level security;
create policy procedure_notes_read_active on public.client_procedure_notes for select to authenticated
  using (public.is_active_user(auth.uid()));
create policy procedure_notes_insert_active on public.client_procedure_notes for insert to authenticated
  with check (public.is_active_user(auth.uid()) and author_id = auth.uid());
create policy procedure_notes_update_own_or_admin on public.client_procedure_notes for update to authenticated
  using (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())))
  with check (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())));
create policy procedure_notes_delete_own_or_admin on public.client_procedure_notes for delete to authenticated
  using (public.is_active_user(auth.uid()) and (author_id = auth.uid() or public.is_admin(auth.uid())));
revoke all on public.client_procedure_notes from anon, authenticated;
grant select, insert, update (body), delete on public.client_procedure_notes to authenticated;

alter table public.client_procedure_note_pins enable row level security;
create policy procedure_note_pins_read_active on public.client_procedure_note_pins for select to authenticated
  using (public.is_active_user(auth.uid()));
create policy procedure_note_pins_insert_active on public.client_procedure_note_pins for insert to authenticated
  with check (public.is_active_user(auth.uid()) and pinned_by = auth.uid());
create policy procedure_note_pins_delete_active on public.client_procedure_note_pins for delete to authenticated
  using (public.is_active_user(auth.uid()));
revoke all on public.client_procedure_note_pins from anon, authenticated;
grant select, insert, delete on public.client_procedure_note_pins to authenticated;

-- Extend audit_record_change() for client_procedures status transitions.
create or replace function public.audit_record_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare record_id uuid; actor uuid; verb text;
begin
  record_id := coalesce(new.id, old.id);
  actor := auth.uid();
  if actor is null then return coalesce(new, old); end if;
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
  elsif TG_TABLE_NAME = 'client_procedures' then
    if new.is_completed is distinct from old.is_completed then
      verb := case when new.is_completed then 'complete' else 'status_change' end;
    else verb := 'update'; end if;
  else verb := 'update'; end if;
  perform public.log_activity(actor, verb, TG_TABLE_NAME, record_id);
  return coalesce(new, old);
end; $$;

create trigger client_procedures_audit after update on public.client_procedures
  for each row execute function public.audit_record_change();
create trigger procedure_notes_audit after insert or update or delete on public.client_procedure_notes
  for each row execute function public.audit_record_change();
