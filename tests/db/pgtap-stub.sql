-- Vereinfachter pgTAP-Nachbau für PGlite: nur die in supabase/tests verwendeten Funktionen.
-- Ergebnisse landen in tap_ergebnis; maßgeblich bleibt echtes pgTAP in der CI.
create table extensions.tap_ergebnis (nr serial, ok boolean, text text);
grant all on extensions.tap_ergebnis to public;
grant all on sequence extensions.tap_ergebnis_nr_seq to public;

create function extensions.plan(int) returns text language sql as $$ select '1..' || $1 $$;

create function extensions.ok(boolean, text) returns text language plpgsql as $$
begin
  insert into extensions.tap_ergebnis (ok, text) values (coalesce($1, false), $2);
  return case when $1 then 'ok' else 'not ok' end || ' - ' || $2;
end $$;

create function extensions.is(anyelement, anyelement, text) returns text language sql as $$
  select extensions.ok($1 is not distinct from $2, $3 || ' (erhalten: ' || coalesce($1::text, 'NULL') || ', erwartet: ' || coalesce($2::text, 'NULL') || ')')
$$;

create function extensions.is_empty(text, text) returns text language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || $1 || ') x' into n;
  return extensions.ok(n = 0, $2 || ' (Zeilen: ' || n || ')');
end $$;

create function extensions.isnt_empty(text, text) returns text language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || $1 || ') x' into n;
  return extensions.ok(n > 0, $2);
end $$;

create function extensions.results_eq(text, anyarray, text) returns text language plpgsql as $$
declare ist text[];
begin
  execute 'select array_agg(x::text) from (' || $1 || ') t(x)' into ist;
  return extensions.ok(ist is not distinct from $2::text[], $3 || ' (erhalten: ' || coalesce(ist::text, 'NULL') || ')');
end $$;

create function extensions.throws_ok(text, text, text, text) returns text language plpgsql as $$
begin
  begin
    execute $1;
  exception when others then
    return extensions.ok($2 is null or sqlstate = $2, $4 || ' (sqlstate ' || sqlstate || ': ' || sqlerrm || ')');
  end;
  return extensions.ok(false, $4 || ' (keine Exception)');
end $$;

create function extensions.finish() returns setof text language sql as $$ select null::text where false $$;
