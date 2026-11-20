-- M5 Planung und Touren:
-- Arbeitszeiten und Abwesenheiten je Mitarbeiter, Fahrzeuge, Tagestouren, Tourdaten am Einsatz,
-- Standort des Betriebs als Tourstart und Seriendatum für von Hand verschobene Einsätze.

-- ---------------------------------------------------------------------------
-- Betrieb: Tourstart
-- ---------------------------------------------------------------------------
alter table public.betrieb
  add column breitengrad numeric(9, 6) check (breitengrad between -90 and 90),
  add column laengengrad numeric(9, 6) check (laengengrad between -180 and 180),
  add column tour_start time not null default '07:00';

-- zusammengesetzte Fremdschlüssel auf mitglied
alter table public.mitglied add constraint mitglied_id_betrieb_key unique (id, betrieb_id);

-- ---------------------------------------------------------------------------
-- Regelmäßige Arbeitszeiten (eine Zeile je Wochentag)
-- ---------------------------------------------------------------------------
create table public.mitarbeiter_verfuegbarkeit (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  mitglied_id uuid not null,
  wochentag smallint not null check (wochentag between 1 and 7),
  von time not null,
  bis time not null,
  check (von < bis),
  unique (mitglied_id, wochentag),
  foreign key (mitglied_id, betrieb_id) references public.mitglied (id, betrieb_id) on delete cascade
);
create index mitarbeiter_verfuegbarkeit_betrieb_idx on public.mitarbeiter_verfuegbarkeit (betrieb_id);

-- ---------------------------------------------------------------------------
-- Abwesenheiten: Urlaub, Krankheit, Sonstiges
-- ---------------------------------------------------------------------------
create type public.abwesenheitsart as enum ('urlaub', 'krank', 'sonstiges');

create table public.abwesenheit (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  mitglied_id uuid not null,
  art public.abwesenheitsart not null default 'urlaub',
  von date not null,
  bis date not null,
  notiz text check (length(notiz) <= 500),
  erstellt_am timestamptz not null default now(),
  check (von <= bis),
  foreign key (mitglied_id, betrieb_id) references public.mitglied (id, betrieb_id) on delete cascade
);
create index abwesenheit_betrieb_zeitraum_idx on public.abwesenheit (betrieb_id, von, bis);

-- ---------------------------------------------------------------------------
-- Fahrzeuge
-- ---------------------------------------------------------------------------
create table public.fahrzeug (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  kennzeichen text check (length(kennzeichen) <= 20),
  aktiv boolean not null default true,
  notiz text check (length(notiz) <= 1000),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id)
);

create trigger fahrzeug_aktualisiert_am before update on public.fahrzeug
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Tagestour je Mitarbeiter
-- ---------------------------------------------------------------------------
create table public.tour (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  mitarbeiter_id uuid not null,
  datum date not null,
  fahrzeug_id uuid,
  startzeit time not null default '07:00',
  rueckfahrt_minuten int check (rueckfahrt_minuten >= 0),
  rueckkehr time,
  -- woher die Fahrzeiten stammen: Routing-Dienst oder Luftlinien-Schätzung
  fahrzeit_quelle text check (fahrzeit_quelle in ('mapbox', 'schaetzung')),
  berechnet_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (mitarbeiter_id, datum),
  foreign key (mitarbeiter_id, betrieb_id) references public.mitglied (id, betrieb_id) on delete cascade,
  foreign key (fahrzeug_id, betrieb_id) references public.fahrzeug (id, betrieb_id) on delete set null (fahrzeug_id)
);
create index tour_betrieb_datum_idx on public.tour (betrieb_id, datum);

create trigger tour_aktualisiert_am before update on public.tour
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Einsatz: Tourdaten und Seriendatum
-- ---------------------------------------------------------------------------
alter table public.einsatz
  add column serien_datum date,
  add column reihenfolge int check (reihenfolge >= 0),
  add column fahrzeit_minuten int check (fahrzeit_minuten >= 0),
  add column geplanter_beginn time;

update public.einsatz set serien_datum = datum where quelle = 'serie';

-- Serien-Einsätze werden über ihren Serientermin erkannt, nicht über das (verschiebbare) Datum
drop index public.einsatz_serie_eindeutig_idx;
create unique index einsatz_serie_eindeutig_idx on public.einsatz (vertrag_id, vorlage_id, serien_datum)
  where quelle = 'serie';

-- Seriendatum vorbelegen; Status folgt der Zuweisung, solange der Einsatz nicht begonnen ist
create function public.einsatz_vorbelegen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quelle = 'serie' and new.serien_datum is null then
    new.serien_datum := new.datum;
  end if;
  if new.status in ('geplant', 'zugewiesen') then
    new.status := case when new.mitarbeiter_id is null then 'geplant' else 'zugewiesen' end;
  end if;
  return new;
end;
$$;

create trigger einsatz_vorbelegen before insert or update on public.einsatz
for each row execute function public.einsatz_vorbelegen();

alter table public.einsatz add constraint einsatz_serie_hat_seriendatum
  check (quelle <> 'serie' or serien_datum is not null);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Arbeitszeiten und Abwesenheiten: Büro alles, Mitarbeiter sehen ihre eigenen
do $$
declare
  t text;
begin
  foreach t in array array['mitarbeiter_verfuegbarkeit', 'abwesenheit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_buero(betrieb_id) or mitglied_id = public.mein_mitglied_id(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

-- Fahrzeuge: alle Mitglieder lesen, Büro schreibt
alter table public.fahrzeug enable row level security;
create policy fahrzeug_lesen on public.fahrzeug for select to authenticated
  using (public.ist_mitglied(betrieb_id));
create policy fahrzeug_anlegen on public.fahrzeug for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy fahrzeug_aendern on public.fahrzeug for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy fahrzeug_loeschen on public.fahrzeug for delete to authenticated
  using (public.ist_buero(betrieb_id));

-- Touren: Büro alles, Mitarbeiter sehen ihre eigenen
alter table public.tour enable row level security;
create policy tour_lesen on public.tour for select to authenticated
  using (public.ist_buero(betrieb_id) or mitarbeiter_id = public.mein_mitglied_id(betrieb_id));
create policy tour_anlegen on public.tour for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy tour_aendern on public.tour for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy tour_loeschen on public.tour for delete to authenticated
  using (public.ist_buero(betrieb_id));
