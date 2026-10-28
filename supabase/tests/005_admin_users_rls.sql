begin;
select plan(15);

insert into auth.users(id,email) values
('51000000-0000-0000-0000-000000000001','admin-one@example.test'),
('51000000-0000-0000-0000-000000000002','admin-two@example.test'),
('51000000-0000-0000-0000-000000000003','staff@example.test'),
('51000000-0000-0000-0000-000000000004','pending@example.test');
update public.profiles set role='admin',status='active' where id in
('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002');
update public.profiles set role='staff',status='active' where id='51000000-0000-0000-0000-000000000003';
-- Local tests may run against a populated database; isolate the last-admin case.
update public.profiles set status='disabled' where role='admin' and status='active'
  and id not in ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000002');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"51000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.profiles)::int,1,'Staff sees only their own account');
select throws_ok($$update public.profiles set must_change_password=true where id='51000000-0000-0000-0000-000000000003'$$,'P0001','Account security fields are system-managed','Staff cannot edit the forced password change flag');
select throws_ok($$update public.profiles set email='other@example.test' where id='51000000-0000-0000-0000-000000000003'$$,'P0001','Account security fields are system-managed','Staff cannot edit the login email');
select ok(not has_function_privilege('authenticated','public.admin_set_profile(uuid,uuid,text,text,text,boolean,text)','EXECUTE'),'Staff cannot call privileged account mutation');
select ok(not has_function_privilege('authenticated','public.complete_temporary_password(uuid)','EXECUTE'),'Staff cannot bypass password change');

select set_config('request.jwt.claims','{"sub":"51000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.profiles)::int,1,'Pending user sees only their own account');

select set_config('request.jwt.claims','{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select cmp_ok((select count(*) from public.profiles)::int,'>=',4,'Admin sees account list');
select throws_ok($$update public.profiles set must_change_password=true where id='51000000-0000-0000-0000-000000000003'$$,'P0001','Account security fields are system-managed','Admin cannot bypass privileged password reset path');
select lives_ok($$update public.profiles set role='staff' where id='51000000-0000-0000-0000-000000000002'$$,'Admin can change another role');
select ok((select count(*) from public.activity_log where action='role_change' and entity_type='profiles' and entity_id='51000000-0000-0000-0000-000000000002')=1,'Role change is audited');
select throws_ok($$update public.profiles set role='staff' where id='51000000-0000-0000-0000-000000000001'$$,'P0001','The last active Admin cannot be changed','Last active Admin is protected');

select set_config('role','service_role',true);
select set_config('request.jwt.claims','',true);
select lives_ok($$select public.admin_set_profile('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000003','Fake Staff','staff','active',true,'password_reset')$$,'Privileged reset marks account for password change');
select ok((select must_change_password from public.profiles where id='51000000-0000-0000-0000-000000000003'),'Reset flag is persisted');
select ok((select count(*) from public.activity_log where actor_id='51000000-0000-0000-0000-000000000001' and action='password_reset' and entity_id='51000000-0000-0000-0000-000000000003')=1,'Password reset logs metadata and actor');
select lives_ok($$select public.complete_temporary_password('51000000-0000-0000-0000-000000000003')$$,'Password change clears the flag');

select * from finish();
rollback;
