-- RLS Anfrage/Angebot (M10): Betrieb B sieht nichts von A; ohne Login nur über die Funktionen
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000aa', 'a10@test.de', '{"betrieb_name":"A10"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000bb', 'b10@test.de', '{"betrieb_name":"B10"}', 'authenticated', 'authenticated');

select set_config('test.kennung', (select b.oeffentlich_kennung from public.betrieb b
  join public.mitglied m on m.betrieb_id = b.id where m.user_id = '00000000-0000-0000-0000-0000000000aa'), true);

-- öffentliche Anfrage ohne Login
set local role anon;
select is((select public.anfrage_stellen(current_setting('test.kennung'),
  '{"name":"Erika","email":"e@test.de","datenschutz":true}'::jsonb)) is not null, true, 'Anfrage ohne Login möglich');
select is_empty('select 1 from public.anfrage', 'ohne Login keine Anfragen lesbar');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select is((select count(*)::int from public.anfrage), 1, 'Büro A sieht die Anfrage');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select is_empty('select 1 from public.anfrage union all select 1 from public.angebot
  union all select 1 from public.angebotsleistung', 'B sieht nichts von A');

select * from finish();
rollback;
