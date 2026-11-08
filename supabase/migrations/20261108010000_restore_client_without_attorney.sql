-- A restored client may temporarily have no current attorney when the former attorney is archived.
alter table public.clients alter column attorney_id drop not null;

create table public.client_attorney_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  attorney_id uuid not null references public.attorneys(id),
  detached_at timestamptz not null default now()
);
create index client_attorney_history_client_idx on public.client_attorney_history(client_id, detached_at desc);
alter table public.client_attorney_history enable row level security;
create policy client_attorney_history_read_active on public.client_attorney_history
  for select to authenticated using (public.is_active_user(auth.uid()));
revoke all on public.client_attorney_history from anon, authenticated;
grant select on public.client_attorney_history to authenticated;

create or replace function public.guard_client_archive() returns trigger
language plpgsql security definer set search_path = public as $$
declare linked_attorney_archived boolean;
begin
  if new.is_archived is distinct from old.is_archived then
    if auth.uid() is not null and not public.is_admin(auth.uid()) then
      raise exception 'Only Admin may archive or restore clients';
    end if;
    if not new.is_archived and old.attorney_id is not null then
      select is_archived into linked_attorney_archived
        from public.attorneys where id = old.attorney_id for share;
      if linked_attorney_archived then
        insert into public.client_attorney_history(client_id, attorney_id)
          values (old.id, old.attorney_id);
        new.attorney_id := null;
      end if;
    end if;
  end if;
  return new;
end; $$;

create or replace function public.guard_client_attorney() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.attorney_id is null then
    if TG_OP = 'INSERT' or old.attorney_id is not null then
      raise exception 'Select an available attorney';
    end if;
  elsif not exists(select 1 from public.attorneys where id = new.attorney_id and not is_archived) then
    raise exception 'Select an available attorney';
  end if;
  return new;
end; $$;

-- Explicit modes avoid confusing an unassigned edit with a request to create an attorney.
create function public.save_client_record(p_id uuid, p_client jsonb, p_attorney_mode text, p_attorney_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare chosen_attorney_id uuid;
begin
  if not public.can_manage_records(auth.uid()) then raise exception 'Access denied'; end if;
  if p_attorney_mode = 'keep' then
    if p_attorney_id is not null then raise exception 'Invalid attorney selection'; end if;
    select attorney_id into chosen_attorney_id from public.clients where id = p_id and not is_archived for update;
    if not found then raise exception 'Client unavailable'; end if;
  elsif p_attorney_mode = 'existing' then
    if p_attorney_id is null then raise exception 'Select an available attorney'; end if;
    select id into chosen_attorney_id from public.attorneys where id = p_attorney_id and not is_archived for share;
    if not found then raise exception 'Select an available attorney'; end if;
  elsif p_attorney_mode = 'new' then
    if p_attorney_id is not null then raise exception 'Invalid attorney selection'; end if;
    insert into public.attorneys(full_name, contact_no, email)
      values (p_client->>'attorneyName', p_client->>'attorneyContact', p_client->>'attorneyEmail')
      returning id into chosen_attorney_id;
  else
    raise exception 'Invalid attorney choice';
  end if;

  update public.clients set
    full_name = p_client->>'petitionerName', birthdate = (p_client->>'petitionerBirthdate')::date,
    contact_no = p_client->>'petitionerContact', email = p_client->>'petitionerEmail',
    address = p_client->>'petitionerAddress', attorney_id = chosen_attorney_id
  where id = p_id and not is_archived;
  if not found then raise exception 'Client unavailable'; end if;
  update public.respondents set
    full_name = p_client->>'respondentName', birthdate = (p_client->>'respondentBirthdate')::date,
    contact_no = p_client->>'respondentContact', email = p_client->>'respondentEmail',
    address = p_client->>'respondentAddress'
  where client_id = p_id;
  if not found then raise exception 'Respondent unavailable'; end if;
  return chosen_attorney_id;
end; $$;
revoke all on function public.save_client_record(uuid,jsonb,text,uuid) from public, anon;
grant execute on function public.save_client_record(uuid,jsonb,text,uuid) to authenticated;
