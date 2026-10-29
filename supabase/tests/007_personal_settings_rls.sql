begin;
select plan(18);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',json_build_object('sub',p_user_id,'role','authenticated')::text,true);
  select set_config('role','authenticated',true);
$$;
create or replace function tests.authenticate_as_anon() returns void language sql as $$
  select set_config('request.jwt.claims','',true);
  select set_config('role','anon',true);
$$;
grant execute on function tests.authenticate_as(uuid) to anon, authenticated, service_role;
grant execute on function tests.authenticate_as_anon() to anon, authenticated, service_role;

insert into auth.users(id,email) values
('71000000-0000-0000-0000-000000000001','settings-admin@example.test'),
('71000000-0000-0000-0000-000000000002','settings-secretary@example.test'),
('71000000-0000-0000-0000-000000000003','settings-staff@example.test'),
('71000000-0000-0000-0000-000000000004','settings-other@example.test'),
('71000000-0000-0000-0000-000000000005','settings-pending@example.test');
update public.profiles set role='admin', status='active' where id='71000000-0000-0000-0000-000000000001';
update public.profiles set role='secretary', status='active' where id='71000000-0000-0000-0000-000000000002';
update public.profiles set role='staff', status='active' where id in ('71000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000004');

select tests.authenticate_as('71000000-0000-0000-0000-000000000001');
select lives_ok($$update public.profiles set full_name='Settings Admin' where id='71000000-0000-0000-0000-000000000001'$$,'admin updates own name');
select lives_ok($$insert into storage.objects(bucket_id,name) values('profile-pictures','71000000-0000-0000-0000-000000000001/avatar.webp')$$,'admin inserts own picture');
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),1,'admin reads only own picture');
select throws_ok($$insert into storage.objects(bucket_id,name) values('profile-pictures','71000000-0000-0000-0000-000000000004/avatar.webp')$$,'42501','new row violates row-level security policy for table "objects"','admin cannot insert another picture');
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),1,'admin cannot insert another picture');

select tests.authenticate_as('71000000-0000-0000-0000-000000000002');
select lives_ok($$update public.profiles set full_name='Settings Secretary' where id='71000000-0000-0000-0000-000000000002'$$,'secretary updates own name');
select lives_ok($$insert into storage.objects(bucket_id,name) values('profile-pictures','71000000-0000-0000-0000-000000000002/avatar.webp')$$,'secretary inserts own picture');
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),1,'secretary reads only own picture');

select tests.authenticate_as('71000000-0000-0000-0000-000000000003');
select lives_ok($$update public.profiles set full_name='Settings Staff' where id='71000000-0000-0000-0000-000000000003'$$,'staff updates own name');
select lives_ok($$insert into storage.objects(bucket_id,name) values('profile-pictures','71000000-0000-0000-0000-000000000003/avatar.webp')$$,'staff inserts own picture');
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),1,'staff reads only own picture');
select is((select count(*)::int from public.profiles where full_name='Settings Secretary'),0,'staff cannot read secretary profile');
select lives_ok($$update public.profiles set full_name='Tampered' where id='71000000-0000-0000-0000-000000000002'$$,'foreign profile update is filtered');
select is((select full_name from public.profiles where id='71000000-0000-0000-0000-000000000003'),'Settings Staff','staff retains own profile');

select tests.authenticate_as('71000000-0000-0000-0000-000000000005');
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),0,'pending user sees no pictures');
select throws_ok($$insert into storage.objects(bucket_id,name) values('profile-pictures','71000000-0000-0000-0000-000000000005/avatar.webp')$$,'42501',null,'pending user cannot insert picture');

select tests.authenticate_as_anon();
select is((select count(*)::int from storage.objects where bucket_id='profile-pictures'),0,'anonymous sees no pictures');
select is((select count(*)::int from public.profiles),0,'anonymous sees no profiles');
rollback;
