begin;
select plan(14);

insert into auth.users(id,email) values ('d1000000-0000-0000-0000-000000000001','age-admin@example.test');
update public.profiles set role='admin', status='active' where id='d1000000-0000-0000-0000-000000000001';
insert into public.attorneys(id,full_name,contact_no,email) values ('d2000000-0000-0000-0000-000000000001','Fake Age Lawyer','0912-345-6789','age-lawyer@example.test');

select lives_ok($$insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values
('d3000000-0000-0000-0000-000000000001','Fake Age Client',((now() at time zone 'Asia/Manila')::date - interval '1 year')::date,'Male','0912-345-6789','age-client@example.test','Fake address','d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001')$$,'petitioner on first birthday is allowed');
select lives_ok($$insert into public.respondents(client_id,full_name,birthdate,sex,contact_no,email,address) values
('d3000000-0000-0000-0000-000000000001','Fake Age Respondent',((now() at time zone 'Asia/Manila')::date - interval '1 year')::date,'Female','0912-345-6789','age-respondent@example.test','Fake address')$$,'respondent on first birthday is allowed');
select throws_ok($$insert into public.clients(full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values
('Fake Younger Client',((now() at time zone 'Asia/Manila')::date - interval '1 year' + interval '1 day')::date,'Male','0912-345-6789','younger-client@example.test','Fake address','d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001')$$,'P0001','Age must be at least 1 year old','new age-zero petitioner rejected');
select throws_ok($$insert into public.respondents(client_id,full_name,birthdate,sex,contact_no,email,address) values
('d3000000-0000-0000-0000-000000000001','Fake Younger Respondent',((now() at time zone 'Asia/Manila')::date - interval '1 year' + interval '1 day')::date,'Female','0912-345-6789','younger-respondent@example.test','Fake address')$$,'P0001','Age must be at least 1 year old','new age-zero respondent rejected');
select throws_ok($$update public.clients set birthdate=((now() at time zone 'Asia/Manila')::date - interval '1 year' + interval '1 day')::date where id='d3000000-0000-0000-0000-000000000001'$$,'P0001','Age must be at least 1 year old','changed petitioner birthdate rejected');
select throws_ok($$update public.respondents set birthdate=((now() at time zone 'Asia/Manila')::date - interval '1 year' + interval '1 day')::date where client_id='d3000000-0000-0000-0000-000000000001'$$,'P0001','Age must be at least 1 year old','changed respondent birthdate rejected');

-- Simulate records saved before the age guard existed.
alter table public.clients disable trigger clients_minimum_age_guard;
alter table public.respondents disable trigger respondents_minimum_age_guard;
insert into public.clients(id,full_name,birthdate,sex,contact_no,email,address,attorney_id,created_by) values
('d3000000-0000-0000-0000-000000000002','Fake Legacy Age Client',((now() at time zone 'Asia/Manila')::date - interval '6 months')::date,'Male','0912-345-6789','legacy-age-client@example.test','Fake address','d2000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001');
insert into public.respondents(client_id,full_name,birthdate,sex,contact_no,email,address) values
('d3000000-0000-0000-0000-000000000002','Fake Legacy Age Respondent',((now() at time zone 'Asia/Manila')::date - interval '6 months')::date,'Female','0912-345-6789','legacy-age-respondent@example.test','Fake address');
alter table public.clients enable trigger clients_minimum_age_guard;
alter table public.respondents enable trigger respondents_minimum_age_guard;

select lives_ok($$update public.clients set full_name='Fake Legacy Age Client Edited',birthdate=birthdate where id='d3000000-0000-0000-0000-000000000002'$$,'legacy petitioner unrelated edit allowed');
select lives_ok($$update public.respondents set full_name='Fake Legacy Age Respondent Edited',birthdate=birthdate where client_id='d3000000-0000-0000-0000-000000000002'$$,'legacy respondent unrelated edit allowed');
select throws_ok($$update public.clients set birthdate=((now() at time zone 'Asia/Manila')::date - interval '5 months')::date where id='d3000000-0000-0000-0000-000000000002'$$,'P0001','Age must be at least 1 year old','legacy petitioner cannot change to another age-zero date');
select throws_ok($$update public.respondents set birthdate=((now() at time zone 'Asia/Manila')::date - interval '5 months')::date where client_id='d3000000-0000-0000-0000-000000000002'$$,'P0001','Age must be at least 1 year old','legacy respondent cannot change to another age-zero date');
select lives_ok($$update public.clients set birthdate=((now() at time zone 'Asia/Manila')::date - interval '1 year')::date where id='d3000000-0000-0000-0000-000000000002'$$,'legacy petitioner can be corrected');
select lives_ok($$update public.respondents set birthdate=((now() at time zone 'Asia/Manila')::date - interval '1 year')::date where client_id='d3000000-0000-0000-0000-000000000002'$$,'legacy respondent can be corrected');
select is(extract(year from age(date '2025-02-28',date '2024-02-29'))::int,0,'leap-day birthday is not reached on February 28');
select is(extract(year from age(date '2025-03-01',date '2024-02-29'))::int,1,'leap-day birthday is reached on March 1');

select * from finish();
rollback;
