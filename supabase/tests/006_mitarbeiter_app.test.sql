-- RLS Mitarbeiter-App (M6): Zeitbuchungen, Checkliste, Meldungen, Positionen, Verlauf
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a6', 'a6@test.de', '{"betrieb_name":"A6"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b6', 'b6@test.de', '{"betrieb_name":"B6"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c6', 'm6@test.de', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d6', 'n6@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (id, betrieb_id, user_id, rolle)
select x.id, betrieb_id, x.u, 'mitarbeiter'
from public.mitglied,
  (values ('30000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-0000000000c6'::uuid),
          ('30000000-0000-0000-0000-000000000016'::uuid, '00000000-0000-0000-0000-0000000000d6'::uuid)) x(id, u)
where user_id = '00000000-0000-0000-0000-0000000000a6';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';

insert into public.kunde (id, betrieb_id, name)
select '10000000-0000-0000-0000-000000000006', betrieb_id, 'K' from public.mitglied where user_id = auth.uid();
insert into public.objekt (id, betrieb_id, kunde_id, name)
select '20000000-0000-0000-0000-000000000006', betrieb_id, '10000000-0000-0000-0000-000000000006', 'O'
from public.mitglied where user_id = auth.uid();
insert into public.auftragsvorlage (id, betrieb_id, name)
select '40000000-0000-0000-0000-000000000006', betrieb_id, 'V' from public.mitglied where user_id = auth.uid();
insert into public.einsatz (id, betrieb_id, objekt_id, vorlage_id, datum, mitarbeiter_id, quelle)
select '60000000-0000-0000-0000-000000000006', betrieb_id, '20000000-0000-0000-0000-000000000006',
       '40000000-0000-0000-0000-000000000006', current_date, '30000000-0000-0000-0000-000000000006', 'manuell'
from public.mitglied where user_id = auth.uid();

-- Mitarbeiter C bucht und meldet
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c6","role":"authenticated"}';
select public.app_zeit_buchen('70000000-0000-0000-0000-000000000006', 'checkin', now(),
  '60000000-0000-0000-0000-000000000006', null, 'qr');
select public.app_meldung('80000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006',
  'mangel', 'Tür klemmt');
select public.app_position('90000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006',
  null, 'Keller fegen', 1, 'heute', 'muendlich');

select is((select count(*)::int from public.zeitbuchung), 1, 'Mitarbeiter sieht eigene Zeitbuchung');
select is((select status::text from public.einsatz), 'begonnen', 'Check-in startet den Einsatz');

-- Kollege D sieht nichts davon
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d6","role":"authenticated"}';
select is_empty(
  'select 1 from public.zeitbuchung union all select 1 from public.einsatz_meldung
   union all select 1 from public.einsatz_position',
  'Kollege sieht fremde Buchungen, Meldungen und Positionen nicht');
select throws_ok(
  $$select public.app_zeit_buchen(gen_random_uuid(), 'checkout', now(), '60000000-0000-0000-0000-000000000006')$$,
  '42501', null, 'Kollege kann für fremden Einsatz nicht buchen');

-- Büro A sieht alles
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
select is((select count(*)::int from public.einsatz_meldung), 1, 'Büro sieht Meldung');

-- Betrieb B sieht nichts von A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
select is_empty(
  'select 1 from public.zeitbuchung union all select 1 from public.einsatz_meldung
   union all select 1 from public.einsatz_position union all select 1 from public.einsatz_aufgabe
   union all select 1 from public.stammdaten_verlauf union all select 1 from public.zeitbuchung_protokoll',
  'B sieht nichts von A');
select throws_ok(
  $$select public.zeitbuchung_stornieren('70000000-0000-0000-0000-000000000006', 'fremde Buchung')$$,
  '42501', null, 'B kann Zeiten von A nicht stornieren');

select * from finish();
rollback;
