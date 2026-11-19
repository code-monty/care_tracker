begin;
select plan(31);

insert into auth.users(id,email) values
('a1000000-0000-0000-0000-000000000001','pin-admin@example.test'),
('a1000000-0000-0000-0000-000000000002','pin-secretary@example.test'),
('a1000000-0000-0000-0000-000000000003','pin-staff@example.test'),
('a1000000-0000-0000-0000-000000000004','pin-disabled@example.test');
update public.profiles set full_name='Fake Pin Admin',role='admin',status='active' where id='a1000000-0000-0000-0000-000000000001';
update public.profiles set full_name='Fake Pin Secretary',role='secretary',status='active' where id='a1000000-0000-0000-0000-000000000002';
update public.profiles set full_name='Fake Pin Staff',role='staff',status='active' where id='a1000000-0000-0000-0000-000000000003';
update public.profiles set role='staff',status='disabled' where id='a1000000-0000-0000-0000-000000000004';
insert into public.attorneys(id,full_name,contact_no,email) values ('a2000000-0000-0000-0000-000000000001','Fake Pin Lawyer','0912-345-6789','pin-lawyer@example.test');
insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values ('a3000000-0000-0000-0000-000000000001','Fake Pin Client','1990-01-01','Male','0912-345-6789','pin-client@example.test','Fake address','a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into public.notes(id,client_id,body,author_id,author_name,author_role) values
('a4000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000001','Fake first note','a1000000-0000-0000-0000-000000000001','','staff'),
('a4000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001','Fake second note','a1000000-0000-0000-0000-000000000001','','staff');
insert into public.notes(id,attorney_id,body,author_id,author_name,author_role) values
('a4000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000001','Fake attorney note','a1000000-0000-0000-0000-000000000001','','staff');
select lives_ok($$insert into public.note_pins(note_id,pinned_by) values ('a4000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003')$$,'Admin can pin a note');
select is((select pinned_by from public.note_pins where note_id='a4000000-0000-0000-0000-000000000001'),'a1000000-0000-0000-0000-000000000001'::uuid,'Pin actor is server assigned');
select is((select count(*) from public.activity_log where action='pin' and entity_type='notes' and entity_id='a4000000-0000-0000-0000-000000000001')::int,1,'Pin logs metadata');
select lives_ok($$insert into public.note_replies(id,note_id,body,author_id,author_name,author_role,created_at) values ('a5000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',' Fake reply ','a1000000-0000-0000-0000-000000000003','Forged','staff','2000-01-01')$$,'Admin can reply');
select is((select author_name from public.note_replies where id='a5000000-0000-0000-0000-000000000001'),'Fake Pin Admin','Reply author is server assigned');
select is((select author_role from public.note_replies where id='a5000000-0000-0000-0000-000000000001'),'admin','Reply role is server assigned');
select ok((select created_at > now() - interval '1 minute' from public.note_replies where id='a5000000-0000-0000-0000-000000000001'),'Reply timestamp is server assigned');
select is((select count(*) from public.activity_log where action='create' and entity_type='note_replies' and entity_id='a5000000-0000-0000-0000-000000000001')::int,1,'Reply logs metadata');
select lives_ok($$update public.note_replies set body=' Fake reply edited ' where id='a5000000-0000-0000-0000-000000000001'$$,'Author can edit own reply');
select is((select body from public.note_replies where id='a5000000-0000-0000-0000-000000000001'),'Fake reply edited','Edited reply body is trimmed and saved');
select is((select count(*) from public.activity_log where action='update' and entity_type='note_replies' and entity_id='a5000000-0000-0000-0000-000000000001')::int,1,'Reply update logs metadata');
delete from public.notes where id='a4000000-0000-0000-0000-000000000001';
select is((select count(*) from public.notes where id='a4000000-0000-0000-0000-000000000001')::int,1,'Note with replies cannot be deleted');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select lives_ok($$delete from public.note_pins where note_id='a4000000-0000-0000-0000-000000000001'$$,'Secretary can unpin');
select lives_ok($$insert into public.note_replies(id,note_id,body,author_id,author_name,author_role) values ('a5000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000001','Fake secretary reply','a1000000-0000-0000-0000-000000000002','','staff')$$,'Secretary can reply');
select is((select author_role from public.note_replies where id='a5000000-0000-0000-0000-000000000002'),'secretary','Secretary role is saved');
update public.note_replies set body='Forbidden reply edit' where id='a5000000-0000-0000-0000-000000000001';
select is((select body from public.note_replies where id='a5000000-0000-0000-0000-000000000001'),'Fake reply edited','Secretary cannot edit Admin reply');
delete from public.note_replies where id='a5000000-0000-0000-0000-000000000001';
select is((select count(*) from public.note_replies where id='a5000000-0000-0000-0000-000000000001')::int,1,'Secretary cannot delete Admin reply');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.activity_log where action='unpin' and entity_type='notes' and entity_id='a4000000-0000-0000-0000-000000000001')::int,1,'Unpin logs metadata');
select lives_ok($$delete from public.note_replies where id='a5000000-0000-0000-0000-000000000002'$$,'Admin can delete another user reply');
select is((select count(*) from public.activity_log where action='delete' and entity_type='note_replies' and entity_id='a5000000-0000-0000-0000-000000000002')::int,1,'Reply delete logs metadata');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
select lives_ok($$insert into public.note_pins(note_id,pinned_by) values ('a4000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003'),('a4000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003')$$,'Staff can pin multiple notes');
select is((select count(*) from public.note_pins where note_id in ('a4000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000002'))::int,2,'Multiple pins persist');
select lives_ok($$insert into public.note_replies(id,note_id,body,author_id,author_name,author_role) values ('a5000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000003','Fake attorney reply','a1000000-0000-0000-0000-000000000003','','staff')$$,'Staff can reply to attorney note');
select lives_ok($$delete from public.note_replies where id='a5000000-0000-0000-0000-000000000003'$$,'Staff can delete own reply');
select throws_ok($$update public.note_pins set pinned_by='a1000000-0000-0000-0000-000000000001' where note_id='a4000000-0000-0000-0000-000000000001'$$,'42501',null,'Pin actor cannot be edited');

-- Deleting a pinned note without replies succeeds and removes its pin
select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$delete from public.notes where id='a4000000-0000-0000-0000-000000000002'$$,'Pinned note without replies can be deleted');

select set_config('request.jwt.claims','{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.note_pins)::int,0,'Disabled user cannot read pins');
select is((select count(*) from public.note_replies)::int,0,'Disabled user cannot read replies');
select throws_ok($$insert into public.note_replies(note_id,body,author_id,author_name,author_role) values ('a4000000-0000-0000-0000-000000000001','Denied','a1000000-0000-0000-0000-000000000004','','staff')$$,'P0001','Access denied','Disabled user cannot reply');

select set_config('role','anon',true);
select throws_ok($$select * from public.note_pins$$,'42501',null,'Anonymous user cannot read pins');
select throws_ok($$select * from public.note_replies$$,'42501',null,'Anonymous user cannot read replies');

select * from finish();
rollback;
