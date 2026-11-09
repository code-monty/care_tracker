-- Keep earlier records unknown; require a recorded choice for newly inserted people.
alter table public.clients add column sex text
  constraint clients_sex_choice check (sex in ('Male', 'Female', 'Non-Binary', 'Prefer not to Say'));
alter table public.respondents add column sex text
  constraint respondents_sex_choice check (sex in ('Male', 'Female', 'Non-Binary', 'Prefer not to Say'));

create function public.guard_person_sex() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.sex is null then raise exception 'Select a sex option'; end if;
  elsif old.sex is not null and new.sex is null then
    raise exception 'Select a sex option';
  end if;
  return new;
end; $$;
create trigger clients_sex_guard before insert or update of sex on public.clients
for each row execute function public.guard_person_sex();
create trigger respondents_sex_guard before insert or update of sex on public.respondents
for each row execute function public.guard_person_sex();

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
    select id into v_attorney_id from public.attorneys where id = p_attorney_id and not is_archived;
    if v_attorney_id is null then raise exception 'Attorney unavailable'; end if;
  end if;
  insert into public.clients(full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by)
  values(p_client->>'petitionerName',(p_client->>'petitionerBirthdate')::date,p_client->>'petitionerSex',p_client->>'petitionerContact',p_client->>'petitionerEmail',p_client->>'petitionerAddress',v_attorney_id,v_user_id)
  returning id into v_client_id;
  insert into public.respondents(client_id,full_name,birthdate,sex,contact_no,email,address)
  values(v_client_id,p_client->>'respondentName',(p_client->>'respondentBirthdate')::date,p_client->>'respondentSex',p_client->>'respondentContact',p_client->>'respondentEmail',p_client->>'respondentAddress');
  return v_client_id;
end; $$;

create or replace function public.save_client_record(p_id uuid, p_client jsonb, p_attorney_mode text, p_attorney_id uuid default null)
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
    sex = coalesce(p_client->>'petitionerSex', sex),
    contact_no = p_client->>'petitionerContact', email = p_client->>'petitionerEmail',
    address = p_client->>'petitionerAddress', attorney_id = chosen_attorney_id
  where id = p_id and not is_archived;
  if not found then raise exception 'Client unavailable'; end if;
  update public.respondents set
    full_name = p_client->>'respondentName', birthdate = (p_client->>'respondentBirthdate')::date,
    sex = coalesce(p_client->>'respondentSex', sex),
    contact_no = p_client->>'respondentContact', email = p_client->>'respondentEmail',
    address = p_client->>'respondentAddress'
  where client_id = p_id;
  if not found then raise exception 'Respondent unavailable'; end if;
  return chosen_attorney_id;
end; $$;
