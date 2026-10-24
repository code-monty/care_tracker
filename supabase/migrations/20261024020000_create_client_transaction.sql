-- Save the attorney, client and respondent in one Postgres transaction.
create function public.create_client_record(p_client jsonb, p_attorney_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_attorney_id uuid; v_client_id uuid; v_user_id uuid;
begin
  v_user_id := auth.uid();
  if not public.is_active_user(v_user_id) then raise exception 'Access denied'; end if;
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
revoke all on function public.create_client_record(jsonb,uuid) from public, anon;
grant execute on function public.create_client_record(jsonb,uuid) to authenticated;
