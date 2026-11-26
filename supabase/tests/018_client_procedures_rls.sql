begin;
select plan(34);

insert into auth.users(id,email) values
('b1000000-0000-0000-0000-000000000001','proc-admin@example.test'),
('b1000000-0000-0000-0000-000000000002','proc-secretary@example.test'),
('b1000000-0000-0000-0000-000000000003','proc-staff@example.test'),
('b1000000-0000-0000-0000-000000000004','proc-disabled@example.test');
update public.profiles set full_name='Fake Proc Admin',role='admin',status='active' where id='b1000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Fake Proc Secretary',role='secretary',status='active' where id='b1000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Fake Proc Staff',role='staff',status='active' where id='b1000000-0000-0000-0000-000000000003';
update public.profiles set role='staff',status='disabled' where id='b1000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values ('b2000000-0000-0000-0000-000000000001','Fake Proc Lawyer','0912-345-6789','proc-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values ('b3000000-0000-0000-0000-000000000001','Fake Proc Client','1990-01-01','Male','0912-345-6789','proc-client@example.test','Fake address','b2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001');

-- 1-2: Auto-seeding 6 procedures on client insert
select is((select count(*) from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001')::int, 6, 'Client insert seeds all 6 procedures');
select is((select array_agg(procedure_key order by sort_order) from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001'), array['battery_of_exams','marital_history','witnesses','home_visit','letter_of_invitation','judicial_affidavit'], 'Seeded procedures keep canonical order');

-- Admin updates date_created and completes a procedure
select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.client_procedures set date_created='2026-11-18', is_completed=true where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'$$, 'Admin can update date_created and complete procedure');
select is((select date_created from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'), '2026-11-18'::date, 'Manual date_created persists');
select is((select date_completed from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'), (now() at time zone 'Asia/Manila')::date, 'Checking status auto-fills Manila date_completed');
select is((select count(*) from public.activity_log where entity_type='client_procedures' and action='complete' and entity_id=(select id from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'))::int, 1, 'Completion logs metadata');
select throws_ok($$update public.client_procedures set date_completed='2020-01-01' where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'$$, '42501', null, 'Direct update of date_completed is denied');

-- Secretary can uncheck procedure (clears date_completed) and edit another
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$update public.client_procedures set is_completed=false where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'$$, 'Secretary can uncheck procedure');
select is((select date_completed from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'), null, 'Unchecking clears date_completed');
select lives_ok($$update public.client_procedures set date_created='2026-11-20', is_completed=true where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='marital_history'$$, 'Secretary can set date_created and complete procedure');

-- Staff can read procedures, cannot update dates/status, cannot insert/delete procedures
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001')::int, 6, 'Staff can read client procedures');
update public.client_procedures set is_completed=true where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='witnesses';
select is((select is_completed from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='witnesses'), false, 'Staff cannot toggle procedure completion');
select throws_ok($$insert into public.client_procedures(client_id,procedure_key,sort_order) values ('b3000000-0000-0000-0000-000000000001','home_visit',4)$$, '42501', null, 'Authenticated user cannot insert procedures');
select throws_ok($$delete from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001'$$, '42501', null, 'Authenticated user cannot delete procedures');

-- Procedure notes & pins permissions
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$insert into public.client_procedure_notes(id,procedure_id,body,author_id,author_name,author_role) values ('b4000000-0000-0000-0000-000000000001',(select id from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'),' Secretary procedure note ','b1000000-0000-0000-0000-000000000003','Forged','staff')$$, 'Secretary can add procedure note');
select is((select author_name from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001'), 'Fake Proc Secretary', 'Procedure note author_name is server assigned');
select is((select author_role from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001'), 'secretary', 'Procedure note author_role is server assigned');

select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$insert into public.client_procedure_notes(id,procedure_id,body,author_id,author_name,author_role) values ('b4000000-0000-0000-0000-000000000002',(select id from public.client_procedures where client_id='b3000000-0000-0000-0000-000000000001' and procedure_key='battery_of_exams'),'Staff procedure note','b1000000-0000-0000-0000-000000000003','','staff')$$, 'Staff can add procedure note');
select lives_ok($$insert into public.client_procedure_note_pins(note_id,pinned_by) values ('b4000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001')$$, 'Staff can pin Secretary procedure note');
select is((select pinned_by from public.client_procedure_note_pins where note_id='b4000000-0000-0000-0000-000000000001'), 'b1000000-0000-0000-0000-000000000003'::uuid, 'Pin actor is server assigned');
select lives_ok($$update public.client_procedure_notes set body=' Staff edited note ' where id='b4000000-0000-0000-0000-000000000002'$$, 'Staff can edit own procedure note');
select is((select body from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000002'), 'Staff edited note', 'Edited procedure note is trimmed');
update public.client_procedure_notes set body='Forbidden edit' where id='b4000000-0000-0000-0000-000000000001';
select is((select body from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001'), 'Secretary procedure note', 'Staff cannot edit Secretary procedure note');
delete from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001';
select is((select count(*) from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001')::int, 1, 'Staff cannot delete Secretary procedure note');
select lives_ok($$delete from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000002'$$, 'Staff can delete own procedure note');

-- Admin can edit/delete Secretary procedure note and audit log tracks pin + unpin
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$delete from public.client_procedure_note_pins where note_id='b4000000-0000-0000-0000-000000000001'$$, 'Admin can unpin procedure note');
select is((select count(*) from public.activity_log where entity_type='client_procedure_notes' and action in ('pin','unpin') and entity_id='b4000000-0000-0000-0000-000000000001')::int, 2, 'Pin and unpin log metadata');
select lives_ok($$update public.client_procedure_notes set body='Admin edited' where id='b4000000-0000-0000-0000-000000000001'$$, 'Admin can edit another user procedure note');
select lives_ok($$delete from public.client_procedure_notes where id='b4000000-0000-0000-0000-000000000001'$$, 'Admin can delete another user procedure note');

-- Disabled and anonymous users are blocked
select set_config('request.jwt.claims','{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.client_procedures)::int, 0, 'Disabled user cannot read procedures');
select is((select count(*) from public.client_procedure_notes)::int, 0, 'Disabled user cannot read procedure notes');
select throws_ok($$insert into public.client_procedure_notes(procedure_id,body,author_id,author_name,author_role) values ((select id from public.client_procedures limit 1),'Denied','b1000000-0000-0000-0000-000000000004','','staff')$$, 'P0001', 'Access denied', 'Disabled user cannot add procedure note');

select set_config('role','anon',true);
select throws_ok($$select * from public.client_procedures$$, '42501', null, 'Anonymous user cannot read procedures');
select throws_ok($$select * from public.client_procedure_notes$$, '42501', null, 'Anonymous user cannot read procedure notes');

select * from finish();
rollback;
