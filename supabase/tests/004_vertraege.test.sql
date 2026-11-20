-- RLS: Verträge nur fürs Büro, Einsätze für Büro und zugewiesene Mitarbeiter (M4)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a4', 'a4@test.de', '{"betrieb_name":"A4"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b4', 'b4@test.de', '{"betrieb_name":"B4"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'm4@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (id, betrieb_id, user_id, rolle)
select '30000000-0000-0000-0000-000000000004', betrieb_id, '00000000-0000-0000-0000-0000000000c4', 'mitarbeiter'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a4';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';

insert into public.kunde (id, betrieb_id, name)
select '10000000-0000-0000-0000-000000000004', betrieb_id, 'K' from public.mitglied where user_id = auth.uid();
insert into public.objekt (id, betrieb_id, kunde_id, name)
select '20000000-0000-0000-0000-000000000004', betrieb_id, '10000000-0000-0000-0000-000000000004', 'O'
from public.mitglied where user_id = auth.uid();
insert into public.auftragsvorlage (id, betrieb_id, name)
select '40000000-0000-0000-0000-000000000004', betrieb_id, 'V' from public.mitglied where user_id = auth.uid();
insert into public.vertrag (id, betrieb_id, kunde_id, objekt_id, titel, beginn)
select '50000000-0000-0000-0000-000000000004', betrieb_id, '10000000-0000-0000-0000-000000000004',
       '20000000-0000-0000-0000-000000000004', 'T', '2026-12-01'
from public.mitglied where user_id = auth.uid();
insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, vertrag_id, datum, mitarbeiter_id)
select betrieb_id, '20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004',
       '50000000-0000-0000-0000-000000000004', d, case when d = '2026-12-07' then '30000000-0000-0000-0000-000000000004'::uuid end
from public.mitglied, (values ('2026-12-07'::date), ('2026-12-14'::date)) x(d)
where user_id = auth.uid();

select is((select count(*)::int from public.einsatz), 2, 'Büro sieht alle Einsätze');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
select is_empty('select 1 from public.vertrag', 'Mitarbeiter sieht keine Verträge');
select is((select count(*)::int from public.einsatz), 1, 'Mitarbeiter sieht nur eigenen Einsatz');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b4","role":"authenticated"}';
select is_empty('select 1 from public.vertrag', 'B sieht keine Verträge von A');
select is_empty('select 1 from public.einsatz', 'B sieht keine Einsätze von A');

set local role anon;
set local request.jwt.claims = '';
select is(
  (select titel from public.vertrag_freigabe_info(
     (select freigabe_token from public.vertrag where false union all select null::uuid limit 1))),
  null, 'Freigabe-Info ohne gültigen Token leer');

select * from finish();
rollback;
