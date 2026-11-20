-- RLS Inventar (M8): Betrieb B sieht nichts von A; Mitarbeiter bucht nur übers eigene Fahrzeug
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a8', 'a8@test.de', '{"betrieb_name":"A8"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'b8@test.de', '{"betrieb_name":"B8"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c8', 'm8@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (id, betrieb_id, user_id, rolle)
select '30000000-0000-0000-0000-000000000008', betrieb_id, '00000000-0000-0000-0000-0000000000c8', 'mitarbeiter'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a8';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}';

insert into public.artikel (id, betrieb_id, name, einheit)
select '40000000-0000-0000-0000-000000000008', betrieb_id, 'Reiniger', 'l'
from public.mitglied where user_id = auth.uid();
insert into public.fahrzeug (id, betrieb_id, name)
select '50000000-0000-0000-0000-000000000008', betrieb_id, 'Fremdes Auto'
from public.mitglied where user_id = auth.uid();
insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, nach_lagerort_id)
select l.betrieb_id, '40000000-0000-0000-0000-000000000008', 'zugang', 40, l.id
from public.lagerort l join public.mitglied m on m.betrieb_id = l.betrieb_id
where m.user_id = auth.uid() and l.standard;

select is((select menge::int from public.bestand), 40, 'Zugang führt den Bestand');

-- Mitarbeiter: sieht Bestand, darf nicht ins fremde Fahrzeug laden
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c8","role":"authenticated"}';
select is((select count(*)::int from public.bestand), 1, 'Mitarbeiter sieht Bestände');
select throws_ok(
  $$select public.app_geladen(gen_random_uuid(), '40000000-0000-0000-0000-000000000008', 10,
    (select id from public.lagerort where fahrzeug_id = '50000000-0000-0000-0000-000000000008'))$$,
  '42501', null, 'Mitarbeiter lädt nicht in fremde Fahrzeuge');

-- Betrieb B sieht nichts von A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}';
select is_empty(
  'select 1 from public.bestand union all select 1 from public.lagerbewegung
   union all select 1 from public.werkzeug union all select 1 from public.bestellung
   union all select 1 from public.objekt_bedarf',
  'B sieht nichts von A');
select is((select count(*)::int from public.lagerort), 1, 'B sieht nur das eigene Zentrallager');

select * from finish();
rollback;
