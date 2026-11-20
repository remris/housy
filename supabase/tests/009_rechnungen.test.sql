-- RLS Rechnungen (M9): Betrieb B sieht nichts von A; Mitarbeiter sehen keine Rechnungen
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a9', 'a9@test.de', '{"betrieb_name":"A9"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b9', 'b9@test.de', '{"betrieb_name":"B9"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c9', 'm9@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (betrieb_id, user_id, rolle)
select betrieb_id, '00000000-0000-0000-0000-0000000000c9', 'mitarbeiter'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a9';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';

insert into public.kunde (id, betrieb_id, name)
select '10000000-0000-0000-0000-000000000009', betrieb_id, 'K' from public.mitglied where user_id = auth.uid();
insert into public.rechnung (id, betrieb_id, kunde_id, leistung_von, leistung_bis)
select '60000000-0000-0000-0000-000000000009', betrieb_id, '10000000-0000-0000-0000-000000000009', '2026-11-01', '2026-11-30'
from public.mitglied where user_id = auth.uid();
insert into public.rechnungsposition (betrieb_id, rechnung_id, pos, bezeichnung, menge, einheit, einzelpreis_cent, netto_cent, ust_satz)
select betrieb_id, '60000000-0000-0000-0000-000000000009', 1, 'P', 1, 'monat', 100, 100, 19
from public.mitglied where user_id = auth.uid();

select is(public.rechnung_festschreiben('60000000-0000-0000-0000-000000000009', '2026-11-30', '{}'),
  'RE-2026-0001', 'Büro schreibt fest, erste Nummer');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c9","role":"authenticated"}';
select is_empty('select 1 from public.rechnung union all select 1 from public.rechnungsposition',
  'Mitarbeiter sieht keine Rechnungen');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b9","role":"authenticated"}';
select is_empty('select 1 from public.rechnung union all select 1 from public.rechnungsposition
  union all select 1 from public.abrechnung union all select 1 from public.nummernkreis',
  'B sieht nichts von A');
select throws_ok(
  $$select public.rechnung_stornieren('60000000-0000-0000-0000-000000000009', 'fremd')$$,
  '42501', null, 'B kann Rechnungen von A nicht stornieren');

select * from finish();
rollback;
