-- Pin state is separate from immutable notes. Replies are immutable notes on a note.
create table public.note_pins (
  note_id uuid primary key references public.notes(id),
  pinned_by uuid not null references public.profiles(id),
  pinned_at timestamptz not null default now()
);

create table public.note_replies (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id),
  body text not null check (length(trim(body)) between 1 and 4000),
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  author_role text not null check (author_role in ('admin','secretary','staff')),
  created_at timestamptz not null default now()
);
create index note_replies_note_order on public.note_replies(note_id, created_at, id);

create function public.guard_note_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user(auth.uid()) then raise exception 'Access denied'; end if;
  if not exists (
    select 1 from public.notes n
    left join public.clients c on c.id = n.client_id
    left join public.attorneys a on a.id = n.attorney_id
    where n.id = new.note_id and coalesce(c.is_archived, a.is_archived) = false
  ) then raise exception 'Note unavailable'; end if;
  new.pinned_by := auth.uid();
  new.pinned_at := now();
  return new;
end; $$;
create trigger note_pins_guard before insert on public.note_pins for each row execute function public.guard_note_pin();

create function public.audit_note_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    perform public.log_activity(auth.uid(), case when TG_OP = 'INSERT' then 'pin' else 'unpin' end, 'notes', coalesce(new.note_id, old.note_id));
  end if;
  return coalesce(new, old);
end; $$;
create trigger note_pins_audit after insert or delete on public.note_pins for each row execute function public.audit_note_pin();

create function public.set_note_reply_attribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare author public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Access denied'; end if;
  select * into author from public.profiles where id = auth.uid() and status = 'active' and role in ('admin','secretary','staff');
  if not found then raise exception 'Access denied'; end if;
  if not exists (
    select 1 from public.notes n
    left join public.clients c on c.id = n.client_id
    left join public.attorneys a on a.id = n.attorney_id
    where n.id = new.note_id and coalesce(c.is_archived, a.is_archived) = false
  ) then raise exception 'Note unavailable'; end if;
  new.author_id := author.id;
  new.author_name := coalesce(nullif(trim(author.full_name), ''), 'Unknown user');
  new.author_role := author.role;
  new.created_at := now();
  new.body := trim(new.body);
  return new;
end; $$;
create trigger note_replies_attribution before insert on public.note_replies for each row execute function public.set_note_reply_attribution();
create trigger note_replies_audit after insert on public.note_replies for each row execute function public.audit_record_change();

alter table public.note_pins enable row level security;
create policy note_pins_read_active on public.note_pins for select to authenticated using (public.is_active_user(auth.uid()));
create policy note_pins_insert_active on public.note_pins for insert to authenticated with check (public.is_active_user(auth.uid()) and pinned_by = auth.uid());
create policy note_pins_delete_active on public.note_pins for delete to authenticated using (public.is_active_user(auth.uid()));
revoke all on public.note_pins from anon, authenticated;
grant select, insert, delete on public.note_pins to authenticated;

alter table public.note_replies enable row level security;
create policy note_replies_read_active on public.note_replies for select to authenticated using (public.is_active_user(auth.uid()));
create policy note_replies_insert_active on public.note_replies for insert to authenticated with check (public.is_active_user(auth.uid()) and author_id = auth.uid());
revoke all on public.note_replies from anon, authenticated;
grant select, insert on public.note_replies to authenticated;
