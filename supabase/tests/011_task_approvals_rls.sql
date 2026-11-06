begin;
select plan(38);

insert into auth.users(id,email) values
('81000000-0000-0000-0000-000000000001','review-admin@example.test'),
('81000000-0000-0000-0000-000000000002','review-staff@example.test'),
('81000000-0000-0000-0000-000000000003','review-other@example.test'),
('81000000-0000-0000-0000-000000000004','review-secretary@example.test'),
('81000000-0000-0000-0000-000000000005','review-inactive@example.test');
update public.profiles set role='admin', status='active' where id='81000000-0000-0000-0000-000000000001';
update public.profiles set role='staff', status='active' where id in ('81000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003');
update public.profiles set role='secretary', status='active' where id='81000000-0000-0000-0000-000000000004';
update public.profiles set role='staff', status='disabled' where id='81000000-0000-0000-0000-000000000005';
insert into public.attorneys(id,full_name,contact_no,email) values
('82000000-0000-0000-0000-000000000001','Fake Review Lawyer','0912-345-6789','review-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values
('83000000-0000-0000-0000-000000000001','Fake Review Client','1990-01-01','0912-345-6789','review-client@example.test','Fake address','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001');
insert into public.tasks(id,client_id,title,assigned_to,due_date,created_by) values
('84000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','Fake document check','81000000-0000-0000-0000-000000000002',(now() at time zone 'Asia/Manila')::date - 1,'81000000-0000-0000-0000-000000000001'),
('84000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000001','Fake Secretary work','81000000-0000-0000-0000-000000000004',(now() at time zone 'Asia/Manila')::date + 1,'81000000-0000-0000-0000-000000000001');

select set_config('role','anon',true);
select is((select count(*) from public.task_review_events)::int,0,'anonymous cannot read review history');
select set_config('role','authenticated',true);
select ok(not has_column_privilege('authenticated','public.tasks','review_comment','SELECT'),'return comment is not a shared task column');
select ok(not has_column_privilege('authenticated','public.tasks','submission_comment','SELECT'),'Staff explanation is not a shared task column');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
select is((select count(*) from public.tasks)::int,0,'inactive user cannot read tasks');
select is((select count(*) from public.task_review_events)::int,0,'inactive user cannot read review history');
select lives_ok($$update public.tasks set submission_comment='Tampered' where id='84000000-0000-0000-0000-000000000001'$$,'inactive user cannot update a task comment');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$update public.tasks set status='awaiting_approval' where id='84000000-0000-0000-0000-000000000001'$$,'other Staff cannot reach assigned task for update');
select lives_ok($$update public.tasks set status='awaiting_approval',submission_comment='Tampered' where id='84000000-0000-0000-0000-000000000001'$$,'other Staff cannot submit a comment for assigned Staff');
select is((select status from public.tasks where id='84000000-0000-0000-0000-000000000001'),'open','other Staff did not submit task');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select throws_ok($$update public.tasks set status='awaiting_approval' where id='84000000-0000-0000-0000-000000000001'$$,'Secretary cannot change task review','Secretary cannot submit');
select throws_ok($$update public.tasks set submission_comment='Tampered' where id='84000000-0000-0000-0000-000000000001'$$,'Secretary cannot change task review','Secretary cannot change submission comment');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$update public.tasks set status='done' where id='84000000-0000-0000-0000-000000000001'$$,'Staff may only submit their own assigned task','Staff cannot complete directly');
select lives_ok($$update public.tasks set status='awaiting_approval' where id='84000000-0000-0000-0000-000000000001'$$,'assigned Staff submits');
select is((select comment from public.task_review_events where event='submitted' and task_id='84000000-0000-0000-0000-000000000001'),null,'first submission has no comment');
select is((select status from public.tasks where id='84000000-0000-0000-0000-000000000001'),'awaiting_approval','submission persisted');
select is((select deadline_status from public.deadline_status where id='84000000-0000-0000-0000-000000000001'),'Overdue','submitted task stays overdue');
select is((select count(*) from public.task_review_events where task_id='84000000-0000-0000-0000-000000000001')::int,1,'Staff sees own review history');
select lives_ok($$update public.tasks set title='Changed' where id='84000000-0000-0000-0000-000000000001'$$,'Staff cannot reach pending task for update');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.task_review_events where task_id='84000000-0000-0000-0000-000000000001')::int,0,'other Staff cannot read review history');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.task_review_events)::int,0,'Secretary cannot read review history');
select throws_ok($$update public.tasks set title='Changed' where id='84000000-0000-0000-0000-000000000001'$$,'Task details are locked during review','Secretary cannot edit pending task');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select throws_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,created_by,submission_comment) values ('83000000-0000-0000-0000-000000000001','Fake early comment','81000000-0000-0000-0000-000000000002',current_date,'81000000-0000-0000-0000-000000000001','Unreviewed')$$,'New tasks cannot include a submission comment','new task cannot carry a Staff explanation');
select throws_ok($$insert into public.tasks(client_id,title,assigned_to,due_date,status,created_by) values ('83000000-0000-0000-0000-000000000001','Fake skipped review','81000000-0000-0000-0000-000000000002',current_date,'done','81000000-0000-0000-0000-000000000001')$$,'New tasks must start open without review feedback','Admin cannot create an already-done task');
select throws_ok($$update public.tasks set status='needs_changes' where id='84000000-0000-0000-0000-000000000001'$$,'A new review comment is required','Admin return requires comment');
select lives_ok($$update public.tasks set status='needs_changes',review_comment='Please correct the fake report.' where id='84000000-0000-0000-0000-000000000001'$$,'Admin returns with comment');
select is((select status from public.tasks where id='84000000-0000-0000-0000-000000000001'),'needs_changes','returned task needs changes');
select is((select comment from public.task_review_events where event='returned' and task_id='84000000-0000-0000-0000-000000000001'),'Please correct the fake report.','feedback retained in history');
select is((select count(*) from public.activity_log where entity_id='84000000-0000-0000-0000-000000000001' and to_jsonb(activity_log)::text like '%Please correct%')::int,0,'feedback absent from activity log');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select throws_ok($$update public.tasks set status='awaiting_approval',review_comment=null where id='84000000-0000-0000-0000-000000000001'$$,'A resubmission comment is required','blank resubmission comment denied');
select lives_ok($$update public.tasks set status='awaiting_approval',review_comment=null,submission_comment='Corrected the fake report.' where id='84000000-0000-0000-0000-000000000001'$$,'Staff resubmits with explanation');
select is((select count(*) from public.task_review_events where task_id='84000000-0000-0000-0000-000000000001')::int,3,'history retains both submissions and return');
select is((select comment from public.task_review_events where event='submitted' and comment is not null and task_id='84000000-0000-0000-0000-000000000001'),'Corrected the fake report.','Staff explanation retained in submission history');
select is((select count(*) from public.activity_log where entity_id='84000000-0000-0000-0000-000000000001' and to_jsonb(activity_log)::text like '%Corrected the fake report%')::int,0,'Staff explanation absent from activity log');
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.tasks set status='done',submission_comment=null where id='84000000-0000-0000-0000-000000000001'$$,'Admin approves resubmission');
select is((select deadline_status from public.deadline_status where id='84000000-0000-0000-0000-000000000001'),'Done','approved task is done');
select is((select count(*) from public.task_review_events where task_id='84000000-0000-0000-0000-000000000001' and event='approved')::int,1,'approval retained in history');
select lives_ok($$update public.tasks set status='done' where id='84000000-0000-0000-0000-000000000002'$$,'Admin directly completes other open task');
select is((select count(*) from public.task_review_events where task_id='84000000-0000-0000-0000-000000000002' and event='completed')::int,1,'direct completion retained in history');
select * from finish();
rollback;
