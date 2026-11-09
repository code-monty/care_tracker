begin;
select plan(16);

insert into auth.users(id,email) values ('c1000000-0000-0000-0000-000000000001','sex-admin@example.test');
update public.profiles set role='admin', status='active' where id='c1000000-0000-0000-0000-000000000001';
insert into public.attorneys(id,full_name,contact_no,email) values ('c2000000-0000-0000-0000-000000000001','Fake Sex Lawyer','0912-345-6789','sex-lawyer@example.test');

insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values
('c3000000-0000-0000-0000-000000000001','Fake Sex Client A','1990-01-01','Male','0912-345-6789','sex-a@example.test','Fake address','c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001'),
('c3000000-0000-0000-0000-000000000002','Fake Sex Client B','1990-01-02','Non-Binary','0912-345-6789','sex-b@example.test','Fake address','c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,sex,contact_no,email,address) values
('c3000000-0000-0000-0000-000000000001','Fake Sex Respondent A','1991-01-01','Female','0912-345-6789','respondent-a@example.test','Fake address'),
('c3000000-0000-0000-0000-000000000002','Fake Sex Respondent B','1991-01-02','Prefer not to Say','0912-345-6789','respondent-b@example.test','Fake address');

select is((select sex from public.clients where id='c3000000-0000-0000-0000-000000000001'),'Male','Male persists');
select is((select sex from public.respondents where client_id='c3000000-0000-0000-0000-000000000001'),'Female','Female persists');
select is((select sex from public.clients where id='c3000000-0000-0000-0000-000000000002'),'Non-Binary','Non-Binary persists');
select is((select sex from public.respondents where client_id='c3000000-0000-0000-0000-000000000002'),'Prefer not to Say','Prefer not to Say persists');
select throws_ok($$insert into public.clients(full_name,birthdate,contact_no,email,address,attorney_id,created_by) values ('Fake Missing Sex','1990-01-03','0912-345-6789','missing@example.test','Fake address','c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001')$$,'P0001','Select a sex option','new petitioner requires sex');
select throws_ok($$insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address) values ('c3000000-0000-0000-0000-000000000001','Fake Missing Sex','1991-01-03','0912-345-6789','missing-respondent@example.test','Fake address')$$,'P0001','Select a sex option','new respondent requires sex');
select throws_ok($$update public.clients set sex='Unsupported' where id='c3000000-0000-0000-0000-000000000001'$$,'23514',null,'unsupported petitioner value rejected');
select throws_ok($$update public.respondents set sex='Unsupported' where client_id='c3000000-0000-0000-0000-000000000001'$$,'23514',null,'unsupported respondent value rejected');

-- Simulate rows that already existed before the migration without changing production data.
alter table public.clients disable trigger clients_sex_guard;
alter table public.respondents disable trigger respondents_sex_guard;
insert into public.clients(id,full_name,birthdate,contact_no,email,address,attorney_id,created_by) values
('c3000000-0000-0000-0000-000000000003','Fake Legacy Client','1990-01-04','0912-345-6789','legacy@example.test','Fake address','c2000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,contact_no,email,address) values
('c3000000-0000-0000-0000-000000000003','Fake Legacy Respondent','1991-01-04','0912-345-6789','legacy-respondent@example.test','Fake address');
alter table public.clients enable trigger clients_sex_guard;
alter table public.respondents enable trigger respondents_sex_guard;
select is((select sex from public.clients where id='c3000000-0000-0000-0000-000000000003'),null,'legacy petitioner stays null');
select is((select sex from public.respondents where client_id='c3000000-0000-0000-0000-000000000003'),null,'legacy respondent stays null');

select set_config('role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_client_record('c3000000-0000-0000-0000-000000000003','{"petitionerName":"Fake Legacy Client Edited","petitionerBirthdate":"1990-01-04","petitionerContact":"0912-345-6789","petitionerEmail":"legacy@example.test","petitionerAddress":"Fake address","respondentName":"Fake Legacy Respondent","respondentBirthdate":"1991-01-04","respondentContact":"0912-345-6789","respondentEmail":"legacy-respondent@example.test","respondentAddress":"Fake address"}'::jsonb,'keep')$$,'unrelated edit preserves legacy nulls');
select is((select sex from public.clients where id='c3000000-0000-0000-0000-000000000003'),null,'petitioner remains null after unrelated edit');
select is((select sex from public.respondents where client_id='c3000000-0000-0000-0000-000000000003'),null,'respondent remains null after unrelated edit');
select lives_ok($$select public.save_client_record('c3000000-0000-0000-0000-000000000003','{"petitionerName":"Fake Legacy Client Edited","petitionerBirthdate":"1990-01-04","petitionerSex":"Non-Binary","petitionerContact":"0912-345-6789","petitionerEmail":"legacy@example.test","petitionerAddress":"Fake address","respondentName":"Fake Legacy Respondent","respondentBirthdate":"1991-01-04","respondentSex":"Prefer not to Say","respondentContact":"0912-345-6789","respondentEmail":"legacy-respondent@example.test","respondentAddress":"Fake address"}'::jsonb,'keep')$$,'later sex values can be saved');
select is((select sex from public.clients where id='c3000000-0000-0000-0000-000000000003'),'Non-Binary','later petitioner value persists');
select is((select sex from public.respondents where client_id='c3000000-0000-0000-0000-000000000003'),'Prefer not to Say','later respondent value persists');

select * from finish();
rollback;
