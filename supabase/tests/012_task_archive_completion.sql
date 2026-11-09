begin;
select plan(34);

insert into auth.users(id,email) values
('91000000-0000-0000-0000-000000000001','archive-admin@example.test'),
('91000000-0000-0000-0000-000000000002','archive-staff@example.test'),
('91000000-0000-0000-0000-000000000003','archive-secretary@example.test'),
('91000000-0000-0000-0000-000000000004','archive-inactive@example.test');
update public.profiles set role='admin',status='active' where id='91000000-0000-0000-0000-000000000001';
update public.profiles set role='staff',status='active' where id='91000000-0000-0000-0000-000000000002';
update public.profiles set role='secretary',status='active' where id='91000000-0000-0000-0000-000000000003';
update public.profiles set role='staff',status='disabled' where id='91000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values
('92000000-0000-0000-0000-000000000001','Fake Archive Lawyer','0912-345-6789','archive-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values
('93000000-0000-0000-0000-000000000001','Fake Archive Client','1990-01-01','Male','0912-345-6789','archive-client@example.test','Fake address','92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001');
insert into public.tasks(id,client_id,title,assigned_to,due_date,created_by) values
('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','Fake Staff work','91000000-0000-0000-0000-000000000002',current_date - 1,'91000000-0000-0000-0000-000000000001'),
('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','Fake Secretary work','91000000-0000-0000-0000-000000000003',current_date + 1,'91000000-0000-0000-0000-000000000001');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select is_archived from public.tasks where id='94000000-0000-0000-0000-000000000001'),false,'new task starts active');
select throws_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,created_by,is_archived) values ('93000000-0000-0000-0000-000000000001','Fake skipped task','91000000-0000-0000-0000-000000000002',current_date,'91000000-0000-0000-0000-000000000001',true)$$,'New tasks must start active','cannot create archived task');
select throws_ok($$update public.tasks set status='done' where id='94000000-0000-0000-0000-000000000001'$$,'Staff work requires a submission before completion','Admin cannot bypass first Staff submission');
select is((select status from public.tasks where id='94000000-0000-0000-0000-000000000001'),'open','Staff task remains open');
select lives_ok($$update public.tasks set status='done' where id='94000000-0000-0000-0000-000000000002'$$,'Admin can complete Secretary task');
select is((select status from public.tasks where id='94000000-0000-0000-0000-000000000002'),'done','Secretary task completed');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.tasks set status='awaiting_approval' where id='94000000-0000-0000-0000-000000000001'$$,'Staff first submission');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.tasks set status='needs_changes',review_comment='Fix the fake task.' where id='94000000-0000-0000-0000-000000000001'$$,'Admin returns task');
select is((select count(*) from public.task_review_events where task_id='94000000-0000-0000-0000-000000000001')::int,2,'submission and return retained');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$update public.tasks set is_archived=true where id='94000000-0000-0000-0000-000000000001'$$,'Staff may only submit their own assigned task','Staff cannot archive assigned task');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select throws_ok($$update public.tasks set is_archived=true where id='94000000-0000-0000-0000-000000000002'$$,'Secretary cannot archive tasks','Secretary cannot archive task');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.tasks)::int,0,'inactive user cannot read tasks');
select lives_ok($$update public.tasks set is_archived=true where id='94000000-0000-0000-0000-000000000001'$$,'inactive user cannot reach task for archive');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.tasks set is_archived=true where id='94000000-0000-0000-0000-000000000001'$$,'Admin archives returned task');
select is((select count(*) from public.deadline_status where id='94000000-0000-0000-0000-000000000001')::int,0,'archived task absent from deadlines');
select is((select count(*) from public.tasks where id='94000000-0000-0000-0000-000000000001' and is_archived)::int,1,'Admin can see archived task');
select is((select count(*) from public.task_review_events where task_id='94000000-0000-0000-0000-000000000001')::int,2,'archive retains review history');
select is((select count(*) from public.activity_log where entity_id='94000000-0000-0000-0000-000000000001' and action='archive')::int,1,'archive creates metadata audit event');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.tasks where id='94000000-0000-0000-0000-000000000001')::int,0,'Staff cannot read archived task');
select is((select count(*) from public.task_review_events where task_id='94000000-0000-0000-0000-000000000001')::int,0,'Staff cannot read archived review history');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.tasks where id='94000000-0000-0000-0000-000000000001')::int,0,'Secretary cannot read archived task');
select lives_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'Secretary cannot restore hidden task');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select lives_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'inactive user cannot restore hidden task');

select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select is_archived from public.tasks where id='94000000-0000-0000-0000-000000000001'),true,'denied restores leave task archived');
update public.profiles set status='disabled' where id='91000000-0000-0000-0000-000000000002';
select throws_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'Select an active personnel member','restore requires active assignee');
update public.profiles set status='active' where id='91000000-0000-0000-0000-000000000002';
update public.clients set is_archived=true where id='93000000-0000-0000-0000-000000000001';
select throws_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'Select an active client','restore requires active client');
update public.clients set is_archived=false where id='93000000-0000-0000-0000-000000000001';
update public.clients set status='inactive' where id='93000000-0000-0000-0000-000000000001';
select throws_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'Select an active client','restore requires active client status');
update public.clients set status='active' where id='93000000-0000-0000-0000-000000000001';
select lives_ok($$update public.tasks set is_archived=false where id='94000000-0000-0000-0000-000000000001'$$,'Admin restores task');
select is((select status from public.tasks where id='94000000-0000-0000-0000-000000000001'),'needs_changes','restore preserves status');
select is((select count(*) from public.deadline_status where id='94000000-0000-0000-0000-000000000001')::int,1,'restored task returns to deadlines');
select is((select count(*) from public.activity_log where entity_id='94000000-0000-0000-0000-000000000001' and action='restore')::int,1,'restore creates metadata audit event');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.task_review_events where task_id='94000000-0000-0000-0000-000000000001')::int,2,'Staff sees retained history after restore');
select lives_ok($$update public.tasks set status='awaiting_approval',review_comment=null,submission_comment='Changes made.' where id='94000000-0000-0000-0000-000000000001'$$,'Staff resubmits restored task');
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$update public.tasks set is_archived=true where id='94000000-0000-0000-0000-000000000001'$$,'Task details are locked during review','pending task cannot be archived');

select * from finish();
rollback;
