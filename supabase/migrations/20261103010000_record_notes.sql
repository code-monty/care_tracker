-- Administrative record notes are immutable and belong to one client or attorney.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  attorney_id uuid references public.attorneys(id),
  body text not null check (length(trim(body)) between 1 and 4000),
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  author_role text not null check (author_role in ('admin', 'secretary', 'staff')),
  created_at timestamptz not null default now(),
  constraint notes_one_record check ((client_id is not null) <> (attorney_id is not null))
);
create index notes_client_order on public.notes(client_id, created_at desc, id desc) where client_id is not null;
create index notes_attorney_order on public.notes(attorney_id, created_at desc, id desc) where attorney_id is not null;

create function public.set_note_attribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare author public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Access denied'; end if;
  select * into author from public.profiles where id = auth.uid() and status = 'active' and role in ('admin','secretary','staff');
  if not found then raise exception 'Access denied'; end if;
  if new.client_id is not null and not exists (select 1 from public.clients where id = new.client_id and not is_archived) then
    raise exception 'Client unavailable';
  end if;
  if new.attorney_id is not null and not exists (select 1 from public.attorneys where id = new.attorney_id and not is_archived) then
    raise exception 'Attorney unavailable';
  end if;
  new.author_id := author.id;
  new.author_name := coalesce(nullif(trim(author.full_name), ''), 'Unknown user');
  new.author_role := author.role;
  new.created_at := now();
  new.body := trim(new.body);
  return new;
end; $$;
create trigger notes_attribution before insert on public.notes for each row execute function public.set_note_attribution();

alter table public.notes enable row level security;
create policy notes_read_active on public.notes for select to authenticated using (public.is_active_user(auth.uid()));
create policy notes_insert_active on public.notes for insert to authenticated with check (public.is_active_user(auth.uid()) and author_id = auth.uid());
revoke all on public.notes from anon, authenticated;
grant select, insert on public.notes to authenticated;

create trigger notes_audit after insert on public.notes for each row execute function public.audit_record_change();
