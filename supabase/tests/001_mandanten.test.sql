-- RLS: Betrieb A sieht keine Daten von Betrieb B (M1)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Testbenutzer wie bei der Registrierung (Trigger legt Betrieb + Inhaber an)
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.de', '{"betrieb_name":"Betrieb A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.de', '{"betrieb_name":"Betrieb B"}', 'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.mitglied where rolle = 'inhaber'
     and user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')),
  2, 'Registrierung legt je Betrieb einen Inhaber an');

-- Als Benutzer A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select results_eq(
  'select name from public.betrieb',
  array['Betrieb A'],
  'A sieht nur den eigenen Betrieb');


select is(
  (select count(*)::int from public.mitglied),
  1, 'A sieht nur eigene Mitglieder');

update public.betrieb set name = 'gehackt' where name = 'Betrieb B';
select throws_ok(
  $$insert into public.betrieb (name) values ('neu')$$,
  '42501', null, 'Betrieb direkt anlegen ist verboten');

select throws_ok(
  $$update public.mitglied set rolle = 'disponent' where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Letzter Inhaber bleibt Inhaber');

reset role;
select is(
  (select name from public.betrieb where id = (select betrieb_id from public.mitglied where user_id = '00000000-0000-0000-0000-00000000000b')),
  'Betrieb B', 'A konnte B nicht ändern');

-- anon
set local role anon;
set local request.jwt.claims = '';
select is_empty('select 1 from public.betrieb', 'anon sieht keine Betriebe');

select * from finish();
rollback;
