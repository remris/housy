-- RLS: Kunden, Objekte und Kind-Tabellen sind je Betrieb getrennt (M2)
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a2@test.de', '{"betrieb_name":"A2"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b2@test.de', '{"betrieb_name":"B2"}', 'authenticated', 'authenticated');

-- Testdaten als A anlegen
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into public.kunde (id, betrieb_id, name)
select '10000000-0000-0000-0000-000000000001', id, 'Kunde A' from public.betrieb where name = 'A2';
insert into public.objekt (id, betrieb_id, kunde_id, name)
select '20000000-0000-0000-0000-000000000001', id, '10000000-0000-0000-0000-000000000001', 'Objekt A'
from public.betrieb where name = 'A2';
insert into public.ansprechpartner (betrieb_id, kunde_id, name)
select id, '10000000-0000-0000-0000-000000000001', 'AP' from public.betrieb where name = 'A2';
insert into public.bereich (betrieb_id, objekt_id, name)
select id, '20000000-0000-0000-0000-000000000001', 'Flur' from public.betrieb where name = 'A2';
insert into public.fensteraufmass (betrieb_id, objekt_id, anzahl)
select id, '20000000-0000-0000-0000-000000000001', 10 from public.betrieb where name = 'A2';

select is((select kundennummer from public.kunde where name = 'Kunde A'), 1::bigint, 'Kundennummer 1 vergeben');
select isnt_empty('select 1 from public.objekt', 'A sieht eigenes Objekt');

-- Als B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is_empty('select 1 from public.kunde', 'B sieht keine Kunden von A');
select is_empty('select 1 from public.objekt', 'B sieht keine Objekte von A');
select is_empty('select 1 from public.ansprechpartner', 'B sieht keine Ansprechpartner von A');
select is_empty('select 1 from public.bereich', 'B sieht keine Bereiche von A');
select is_empty('select 1 from public.fensteraufmass', 'B sieht kein Fensteraufmaß von A');

select throws_ok(
  $$insert into public.objekt (betrieb_id, kunde_id, name)
    select m.betrieb_id, '10000000-0000-0000-0000-000000000001', 'fremd'
    from public.mitglied m where m.user_id = auth.uid()$$,
  '23503', null, 'B kann kein Objekt an Kunde von A hängen');

select is((select count(*)::int from public.objekt), 0, 'Kein Objekt bei B entstanden');

select * from finish();
rollback;
