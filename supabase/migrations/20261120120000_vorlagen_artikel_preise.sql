-- M3: Artikel (Verbrauch, Verschleiß, Gerät), Auftragsvorlagen mit Tätigkeiten und Bedarf,
-- Preisliste für Leistungen und Sonderleistungen, Installation von Branchenpaketen.

create type public.artikelart as enum ('verbrauch', 'verschleiss', 'geraet');
create type public.bedarfsbezug as enum ('einsatz', 'm2', 'fenster', 'stunde');
create type public.preiseinheit as enum ('pauschal', 'stunde', 'm2', 'fenster', 'stueck', 'einsatz');

-- ---------------------------------------------------------------------------
-- Artikel
-- ---------------------------------------------------------------------------
create table public.artikel (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  art public.artikelart not null default 'verbrauch',
  -- Mengeneinheit für Bestand und Verbrauch, z. B. l, Stk, Rolle
  einheit text not null default 'Stk' check (length(einheit) between 1 and 20),
  -- Gebinde: z. B. "Kanister" mit 10 (Einheit l)
  gebinde_name text,
  gebinde_menge numeric(12, 3) not null default 1 check (gebinde_menge > 0),
  -- Einkaufspreis je Gebinde in Cent (netto)
  preis_cent int check (preis_cent is null or preis_cent >= 0),
  lieferant text,
  bestellnummer text,
  mindestbestand numeric(12, 3) not null default 0 check (mindestbestand >= 0),
  lieferzeit_tage int not null default 5 check (lieferzeit_tage between 0 and 365),
  -- Verschleiß: Lebensdauer als Empfehlung, gezählt in der Einheit
  lebensdauer numeric(12, 2) check (lebensdauer is null or lebensdauer > 0),
  lebensdauer_einheit text
    check (lebensdauer_einheit is null or lebensdauer_einheit in ('einsaetze', 'fenster', 'm2', 'stunden', 'waeschen', 'tage')),
  auto_wechsel boolean not null default false,
  -- Geräte mit Prüfpflicht
  pruefintervall_monate int check (pruefintervall_monate is null or pruefintervall_monate between 1 and 120),
  notiz text,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  check (art <> 'verschleiss' or (lebensdauer is not null and lebensdauer_einheit is not null))
);

create index artikel_betrieb_name_idx on public.artikel (betrieb_id, name);

create trigger artikel_aktualisiert_am
before update on public.artikel
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Auftragsvorlage
-- ---------------------------------------------------------------------------
create table public.auftragsvorlage (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  branche text check (branche is null or branche in ('gebaeudereinigung', 'hausmeister', 'fensterreinigung')),
  beschreibung text,
  -- Sollzeit je Einsatz in Minuten (Grundzeit) plus optional je m² bzw. je Fenster
  sollzeit_minuten int not null default 60 check (sollzeit_minuten between 0 and 10000),
  minuten_pro_100m2 numeric(8, 2) check (minuten_pro_100m2 is null or minuten_pro_100m2 >= 0),
  minuten_pro_fenster numeric(8, 2) check (minuten_pro_fenster is null or minuten_pro_fenster >= 0),
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id)
);

create unique index auftragsvorlage_name_idx on public.auftragsvorlage (betrieb_id, lower(name));

create trigger auftragsvorlage_aktualisiert_am
before update on public.auftragsvorlage
for each row execute function public.setze_aktualisiert_am();

create table public.vorlage_taetigkeit (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  vorlage_id uuid not null,
  text text not null check (length(trim(text)) between 1 and 500),
  reihenfolge int not null default 0,
  foto_pflicht boolean not null default false,
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete cascade
);

create index vorlage_taetigkeit_vorlage_idx on public.vorlage_taetigkeit (vorlage_id, reihenfolge);

create table public.vorlage_bedarf (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  vorlage_id uuid not null,
  artikel_id uuid not null,
  -- Menge in der Artikeleinheit je Bezugsgröße (z. B. 0,5 l je Einsatz, 0,02 l je Fenster)
  menge numeric(12, 4) not null check (menge > 0),
  bezug public.bedarfsbezug not null default 'einsatz',
  unique (vorlage_id, artikel_id, bezug),
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete cascade,
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete restrict
);

create index vorlage_bedarf_artikel_idx on public.vorlage_bedarf (artikel_id);

-- ---------------------------------------------------------------------------
-- Preisliste (Leistungen und Sonderleistungen)
-- ---------------------------------------------------------------------------
create table public.preisliste (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  beschreibung text,
  einheit public.preiseinheit not null default 'pauschal',
  preis_cent int not null check (preis_cent >= 0),
  ust_satz numeric(4, 2) not null default 19 check (ust_satz in (0, 7, 19)),
  sonderleistung boolean not null default false,
  vorlage_id uuid,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete set null (vorlage_id)
);

create unique index preisliste_name_idx on public.preisliste (betrieb_id, lower(name));

create trigger preisliste_aktualisiert_am
before update on public.preisliste
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- RLS: Mitglieder lesen (App braucht Checklisten, Preise für Vor-Ort-Leistungen), Büro schreibt
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['artikel', 'auftragsvorlage', 'vorlage_taetigkeit', 'vorlage_bedarf', 'preisliste'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_mitglied(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Branchenpaket installieren (eine Transaktion, idempotent über Namen)
-- p_paket: { artikel: [...], vorlagen: [{..., taetigkeiten: [..], bedarf: [{artikel, menge, bezug}]}], preise: [...] }
-- ---------------------------------------------------------------------------
create function public.paket_installieren(p_betrieb_id uuid, p_paket jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a jsonb;
  v jsonb;
  t jsonb;
  b jsonb;
  p jsonb;
  v_vorlage uuid;
  v_artikel uuid;
  n_artikel int := 0;
  n_vorlagen int := 0;
  n_preise int := 0;
  i int;
begin
  if not public.ist_buero(p_betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;

  for a in select * from jsonb_array_elements(coalesce(p_paket -> 'artikel', '[]')) loop
    if not exists (select 1 from public.artikel x
                   where x.betrieb_id = p_betrieb_id and lower(x.name) = lower(a ->> 'name')) then
      insert into public.artikel (betrieb_id, name, art, einheit, gebinde_name, gebinde_menge, preis_cent,
        mindestbestand, lieferzeit_tage, lebensdauer, lebensdauer_einheit, auto_wechsel, pruefintervall_monate)
      values (p_betrieb_id, a ->> 'name', (a ->> 'art')::public.artikelart, a ->> 'einheit',
        a ->> 'gebinde_name', coalesce((a ->> 'gebinde_menge')::numeric, 1), (a ->> 'preis_cent')::int,
        coalesce((a ->> 'mindestbestand')::numeric, 0), coalesce((a ->> 'lieferzeit_tage')::int, 5),
        (a ->> 'lebensdauer')::numeric, a ->> 'lebensdauer_einheit',
        coalesce((a ->> 'auto_wechsel')::boolean, false), (a ->> 'pruefintervall_monate')::int);
      n_artikel := n_artikel + 1;
    end if;
  end loop;

  for v in select * from jsonb_array_elements(coalesce(p_paket -> 'vorlagen', '[]')) loop
    if exists (select 1 from public.auftragsvorlage x
               where x.betrieb_id = p_betrieb_id and lower(x.name) = lower(v ->> 'name')) then
      continue;
    end if;
    insert into public.auftragsvorlage (betrieb_id, name, branche, beschreibung, sollzeit_minuten,
      minuten_pro_100m2, minuten_pro_fenster)
    values (p_betrieb_id, v ->> 'name', v ->> 'branche', v ->> 'beschreibung',
      coalesce((v ->> 'sollzeit_minuten')::int, 60), (v ->> 'minuten_pro_100m2')::numeric,
      (v ->> 'minuten_pro_fenster')::numeric)
    returning id into v_vorlage;
    n_vorlagen := n_vorlagen + 1;

    i := 0;
    for t in select * from jsonb_array_elements(coalesce(v -> 'taetigkeiten', '[]')) loop
      i := i + 1;
      insert into public.vorlage_taetigkeit (betrieb_id, vorlage_id, text, reihenfolge)
      values (p_betrieb_id, v_vorlage, t #>> '{}', i);
    end loop;

    for b in select * from jsonb_array_elements(coalesce(v -> 'bedarf', '[]')) loop
      select x.id into v_artikel from public.artikel x
      where x.betrieb_id = p_betrieb_id and lower(x.name) = lower(b ->> 'artikel')
      order by x.erstellt_am limit 1;
      if v_artikel is null then
        raise exception 'Artikel % fehlt im Paket', b ->> 'artikel';
      end if;
      insert into public.vorlage_bedarf (betrieb_id, vorlage_id, artikel_id, menge, bezug)
      values (p_betrieb_id, v_vorlage, v_artikel, (b ->> 'menge')::numeric,
        coalesce(b ->> 'bezug', 'einsatz')::public.bedarfsbezug)
      on conflict do nothing;
    end loop;
  end loop;

  for p in select * from jsonb_array_elements(coalesce(p_paket -> 'preise', '[]')) loop
    if not exists (select 1 from public.preisliste x
                   where x.betrieb_id = p_betrieb_id and lower(x.name) = lower(p ->> 'name')) then
      insert into public.preisliste (betrieb_id, name, beschreibung, einheit, preis_cent, sonderleistung, vorlage_id)
      values (p_betrieb_id, p ->> 'name', p ->> 'beschreibung', (p ->> 'einheit')::public.preiseinheit,
        (p ->> 'preis_cent')::int, coalesce((p ->> 'sonderleistung')::boolean, false),
        (select x.id from public.auftragsvorlage x
         where x.betrieb_id = p_betrieb_id and lower(x.name) = lower(p ->> 'vorlage') limit 1));
      n_preise := n_preise + 1;
    end if;
  end loop;

  return jsonb_build_object('artikel', n_artikel, 'vorlagen', n_vorlagen, 'preise', n_preise);
end;
$$;
