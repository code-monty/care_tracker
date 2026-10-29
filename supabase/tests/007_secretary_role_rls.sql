begin;
select plan(18);

insert into auth.users(id,email) values
('71000000-0000-0000-0000-000000000001','secretary-admin@example.test'),
('71000000-0000-0000-0000-000000000002','secretary-active@example.test'),
('71000000-0000-0000-0000-000000000003','secretary-staff@example.test'),
('71000000-0000-0000-0000-000000000004','secretary-disabled@example.test');
update public.profiles set role='admin', status='active' where id='71000000-0000-0000-0000-000000000001';
update public.profiles set role='secretary', status='active', full_name='Fake Secretary' where id='71000000-0000-0000-0000-000000000002';
update public.profiles set role='staff', status='active', full_name='Fake Staff' where id='71000000-0000-0000-0000-000000000003';
update public.profiles set role='secretary', status='disabled' where id='71000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values
('72000000-0000-0000-0000-000000000001','Fake Secretary Lawyer','0912-345-6789','secretary-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values
('73000000-0000-0000-0000-000000000001','Fake Secretary Client','1990-01-01','0912-345-6789','secretary-client@example.test','Fake address','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select ok(public.is_active_user(auth.uid()),'Active Secretary passes active-user RLS');
select ok(not public.is_admin(auth.uid()),'Secretary is not Admin');
select is((select count(*) from public.profiles)::int,1,'Secretary sees only own profile');
select is((select count(*) from public.activity_log)::int,0,'Secretary cannot read activity logs');
select is((select count(*) from public.clients where id='73000000-0000-0000-0000-000000000001')::int,1,'Secretary reads shared clients');
select is((select count(*) from public.active_personnel_directory() where id='71000000-0000-0000-0000-000000000002')::int,1,'Active Secretary appears as task assignee');
select is((select count(*) from public.active_personnel_directory() where id='71000000-0000-0000-0000-000000000003')::int,1,'Active Staff remains a task assignee');
select is((select count(*) from public.active_personnel_directory() where id='71000000-0000-0000-0000-000000000004')::int,0,'Disabled Secretary is not assignable');
select lives_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,created_by) values
('73000000-0000-0000-0000-000000000001','Fake Secretary task','71000000-0000-0000-0000-000000000002',current_date + 7,'71000000-0000-0000-0000-000000000002')$$,'Secretary can create a task assigned to Secretary');
select lives_ok($$update public.tasks set status='done' where title='Fake Secretary task'$$,'Secretary can complete a task');
select throws_ok($$update public.clients set is_archived=true where id='73000000-0000-0000-0000-000000000001'$$,'P0001','Only Admin may archive or restore clients','Secretary cannot archive clients');
select throws_ok($$update public.profiles set role='admin' where id='71000000-0000-0000-0000-000000000002'$$,'P0001','Only Admins can change role, status, or login-security fields','Secretary cannot change own role');
select ok(not has_function_privilege('authenticated','public.admin_set_profile(uuid,uuid,text,text,text,boolean,text)','EXECUTE'),'Secretary cannot call privileged account mutation');

select set_config('role','service_role',true);
select set_config('request.jwt.claims','',true);
select lives_ok($$select public.admin_set_profile('71000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000003','Fake Staff','secretary','active',null,'role_change')$$,'Admin can assign the Secretary role');
select is((select role from public.profiles where id='71000000-0000-0000-0000-000000000003'),'secretary','Secretary role assignment is persisted');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select ok(not public.is_active_user(auth.uid()),'Disabled Secretary fails active-user RLS');
select is((select count(*) from public.clients)::int,0,'Disabled Secretary cannot read clients');
select is((select count(*) from public.active_personnel_directory())::int,0,'Disabled Secretary cannot list personnel');

select * from finish();
rollback;
