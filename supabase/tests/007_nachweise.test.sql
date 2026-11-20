-- RLS Nachweise (M7): Nachweise und Mail-Protokoll nur fürs eigene Büro
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.de', '{"betrieb_name":"A7"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'b7@test.de', '{"betrieb_name":"B7"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c7', 'm7@test.de', '{}', 'authenticated', 'authenticated');

insert into public.mitglied (id, betrieb_id, user_id, rolle)
select '30000000-0000-0000-0000-000000000007', betrieb_id, '00000000-0000-0000-0000-0000000000c7', 'mitarbeiter'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a7';

insert into public.kunde (id, betrieb_id, name)
select '10000000-0000-0000-0000-000000000007', betrieb_id, 'K'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a7';
insert into public.objekt (id, betrieb_id, kunde_id, name)
select '20000000-0000-0000-0000-000000000007', betrieb_id, '10000000-0000-0000-0000-000000000007', 'O'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a7';
insert into public.nachweis (id, betrieb_id, art, kunde_id, objekt_id, von, bis, status)
select '50000000-0000-0000-0000-000000000007', betrieb_id, 'monat', '10000000-0000-0000-0000-000000000007',
       '20000000-0000-0000-0000-000000000007', '2026-10-01', '2026-10-31', 'gesendet'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a7';
insert into public.mail_protokoll (betrieb_id, art, bezug_id, empfaenger, betreff)
select betrieb_id, 'nachweis', '50000000-0000-0000-0000-000000000007', '{k@test.de}', 'Nachweis'
from public.mitglied where user_id = '00000000-0000-0000-0000-0000000000a7';

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select count(*)::int from public.nachweis), 1, 'Büro A sieht eigenen Nachweis');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}';
select is_empty('select 1 from public.nachweis union all select 1 from public.mail_protokoll',
  'Mitarbeiter sieht keine Nachweise und Mails');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}';
select is_empty('select 1 from public.nachweis union all select 1 from public.mail_protokoll',
  'B sieht nichts von A');
select throws_ok(
  $$insert into public.nachweis (betrieb_id, art, kunde_id, objekt_id, von, bis)
    select betrieb_id, 'monat', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007',
           '2026-09-01', '2026-09-30'
    from public.mitglied where user_id = auth.uid()$$,
  null, null, 'B kann keinen Nachweis anlegen');

select * from finish();
rollback;
