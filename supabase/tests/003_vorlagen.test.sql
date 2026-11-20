-- RLS: Artikel, Vorlagen und Preisliste je Betrieb getrennt; Paket-Installation nur fürs Büro (M3)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test.de', '{"betrieb_name":"A3"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'b3@test.de', '{"betrieb_name":"B3"}', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select is(
  (select public.paket_installieren(
     (select betrieb_id from public.mitglied where user_id = auth.uid()),
     '{"artikel":[{"name":"Reiniger","art":"verbrauch","einheit":"l","gebinde_menge":10}],
       "vorlagen":[{"name":"Büro","branche":"gebaeudereinigung","sollzeit_minuten":30,
                    "taetigkeiten":["Wischen"],"bedarf":[{"artikel":"Reiniger","menge":0.5,"bezug":"einsatz"}]}],
       "preise":[{"name":"Stunde","einheit":"stunde","preis_cent":3500,"vorlage":"Büro"}]}'::jsonb)),
  '{"artikel": 1, "preise": 1, "vorlagen": 1}'::jsonb,
  'Paket wird installiert');

select is((select count(*)::int from public.vorlage_bedarf), 1, 'Bedarf angelegt');
select set_config('test.betrieb_a', (select betrieb_id::text from public.mitglied where user_id = auth.uid()), true);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select is_empty('select 1 from public.artikel', 'B sieht keine Artikel von A');
select is_empty('select 1 from public.auftragsvorlage', 'B sieht keine Vorlagen von A');
select is_empty('select 1 from public.vorlage_bedarf', 'B sieht keinen Bedarf von A');
select is_empty('select 1 from public.preisliste', 'B sieht keine Preise von A');

select throws_ok(
  $$select public.paket_installieren(current_setting('test.betrieb_a')::uuid, '{}'::jsonb)$$,
  '42501', null, 'B kann kein Paket in A installieren');

select * from finish();
rollback;
