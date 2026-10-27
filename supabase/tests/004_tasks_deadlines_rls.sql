begin;
select plan(14);

insert into auth.users(id,email) values
('41000000-0000-0000-0000-000000000001','tasks-admin@example.test'),
('41000000-0000-0000-0000-000000000002','tasks-staff@example.test'),
('41000000-0000-0000-0000-000000000003','tasks-pending@example.test'),
('41000000-0000-0000-0000-000000000004','tasks-disabled@example.test');
update public.profiles set role='admin', status='active', full_name='Fake Admin' where id='41000000-0000-0000-0000-000000000001';
update public.profiles set role='staff', status='active', full_name='Fake Staff' where id='41000000-0000-0000-0000-000000000002';
update public.profiles set role='staff', status='disabled', full_name='Fake Disabled' where id='41000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values ('42000000-0000-0000-0000-000000000001','Fake Lawyer','0912-345-6789','task-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values ('43000000-0000-0000-0000-000000000001','Fake Task Client','1990-01-01','0912-345-6789','task-client@example.test','Fake address','42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001');
insert into public.tasks(id,client_id,title,assigned_to,due_date,created_by) values ('44000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001','Fake report','41000000-0000-0000-0000-000000000002',(now() at time zone 'Asia/Manila')::date + 3,'41000000-0000-0000-0000-000000000001');

select set_config('role','anon',true);
select is((select count(*) from public.tasks)::int,0,'anonymous cannot read tasks');
select ok(not has_table_privilege('anon','public.deadline_status','SELECT'),'anonymous cannot read deadline status');
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.tasks)::int,0,'pending user cannot read tasks');
select is((select count(*) from public.active_staff_directory())::int,0,'pending user cannot list staff');
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.tasks)::int,0,'disabled user cannot read tasks');
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.active_staff_directory() where id='41000000-0000-0000-0000-000000000002')::int,1,'staff picker lists active staff');
select is((select count(*) from public.tasks where id='44000000-0000-0000-0000-000000000001')::int,1,'active staff can read shared tasks');
select is((select deadline_status from public.deadline_status where id='44000000-0000-0000-0000-000000000001'),'Due Soon','three days ahead is Due Soon');
select lives_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,created_by) values ('43000000-0000-0000-0000-000000000001','Fake hearing','41000000-0000-0000-0000-000000000002',(now() at time zone 'Asia/Manila')::date + 4,'41000000-0000-0000-0000-000000000002')$$,'staff can create task');
select throws_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,created_by) values ('43000000-0000-0000-0000-000000000001','Invalid assignment','41000000-0000-0000-0000-000000000004',current_date,'41000000-0000-0000-0000-000000000002')$$,'Select an active staff member','disabled assignee rejected');
select lives_ok($$update public.tasks set status='done' where id='44000000-0000-0000-0000-000000000001'$$,'staff can complete task');
select is((select deadline_status from public.deadline_status where id='44000000-0000-0000-0000-000000000001'),'Done','done task remains in history');
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.tasks where client_id='43000000-0000-0000-0000-000000000001')::int,2,'admin can read all tasks');
select ok((select count(*) from public.activity_log where entity_type='tasks' and entity_id='44000000-0000-0000-0000-000000000001' and action='status_change') = 1,'completion writes a status audit row');

select * from finish();
rollback;
