-- RLS Planung (M5): Arbeitszeiten, Abwesenheiten, Fahrzeuge, Touren
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a5', 'a5@test.de', '{"betrieb_name":"A5"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b5', 'b5@test.de', '{"betrieb_name":"B5"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c5', 'm5@test.de', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d5', 'n5@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (id, betrieb_id, user_id, rolle)
select x.id, betrieb_id, x.u, 'mitarbeiter'
from public.mitglied,
  (values ('30000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-0000000000c5'::uuid),
          ('30000000-0000-0000-0000-000000000015'::uuid, '00000000-0000-0000-0000-0000000000d5'::uuid)) x(id, u)
where user_id = '00000000-0000-0000-0000-0000000000a5';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';

insert into public.mitarbeiter_verfuegbarkeit (betrieb_id, mitglied_id, wochentag, von, bis)
select betrieb_id, m.id, w, '06:00', '14:00'
from public.mitglied m, generate_series(1, 5) w
where m.id in ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000015');
insert into public.abwesenheit (betrieb_id, mitglied_id, art, von, bis)
select betrieb_id, id, 'urlaub', '2026-12-01', '2026-12-05' from public.mitglied
where id in ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000015');
insert into public.fahrzeug (betrieb_id, name)
select betrieb_id, 'Caddy' from public.mitglied where user_id = auth.uid();
insert into public.tour (betrieb_id, mitarbeiter_id, datum)
select betrieb_id, id, '2026-12-07' from public.mitglied
where id in ('30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000015');

select is((select count(*)::int from public.tour), 2, 'Büro sieht alle Touren');

-- Mitarbeiter C sieht nur seine eigenen Daten
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select is((select count(*)::int from public.tour), 1, 'Mitarbeiter sieht nur eigene Tour');
select is((select count(*)::int from public.abwesenheit), 1, 'Mitarbeiter sieht nur eigene Abwesenheit');
select is((select count(*)::int from public.mitarbeiter_verfuegbarkeit), 5, 'Mitarbeiter sieht eigene Arbeitszeiten');
select is((select count(*)::int from public.fahrzeug), 1, 'Mitarbeiter sieht Fahrzeuge');
select throws_ok(
  $$insert into public.abwesenheit (betrieb_id, mitglied_id, von, bis)
    values ((select betrieb_id from public.fahrzeug limit 1), '30000000-0000-0000-0000-000000000005', '2027-01-01', '2027-01-02')$$,
  '42501', null, 'Mitarbeiter trägt keine Abwesenheit selbst ein');

-- Betrieb B sieht nichts von A
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
select is_empty(
  'select 1 from public.tour union all select 1 from public.abwesenheit
   union all select 1 from public.mitarbeiter_verfuegbarkeit union all select 1 from public.fahrzeug',
  'B sieht nichts von A');
select throws_ok(
  $$insert into public.tour (betrieb_id, mitarbeiter_id, datum)
    values ((select betrieb_id from public.mitglied where user_id = auth.uid()), '30000000-0000-0000-0000-000000000005', '2026-12-08')$$,
  '23503', null, 'B kann keine Tour für Mitarbeiter von A anlegen');

select * from finish();
rollback;
