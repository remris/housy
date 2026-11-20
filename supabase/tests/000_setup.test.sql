-- Grundtest: pgTAP ist verfügbar und die Datenbank antwortet.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select ok(true, 'pgTAP läuft');
select * from finish();
rollback;
