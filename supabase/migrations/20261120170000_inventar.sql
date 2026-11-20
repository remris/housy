-- M8 Inventar und Prognose:
-- Lagerorte (Zentrallager, Fahrzeug, Putzkammer im Objekt), Bestand (per Trigger aus den
-- Bewegungen), Lagerbewegungen (unveränderlich), Verbrauch je Objekt, Werkzeuge mit Wechseln und
-- Prüfungen, Bestellungen. Mitarbeiter buchen nur über app_geladen / app_werkzeug_gewechselt.

-- ---------------------------------------------------------------------------
-- Lagerorte
-- ---------------------------------------------------------------------------
create type public.lagerortart as enum ('lager', 'fahrzeug', 'objekt');

-- Standardfahrer eines Fahrzeugs (wenn die Tour kein Fahrzeug hat)
alter table public.fahrzeug add column mitglied_id uuid,
  add constraint fahrzeug_mitglied_fk foreign key (mitglied_id, betrieb_id)
    references public.mitglied (id, betrieb_id) on delete set null (mitglied_id);

create table public.lagerort (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  art public.lagerortart not null default 'lager',
  name text not null check (length(trim(name)) between 1 and 100),
  fahrzeug_id uuid,
  objekt_id uuid,
  -- das Zentrallager (Ziel für Wareneingang, Quelle für „geladen“)
  standard boolean not null default false,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  unique (id, betrieb_id),
  check ((art = 'fahrzeug') = (fahrzeug_id is not null)),
  check ((art = 'objekt') = (objekt_id is not null)),
  check (not standard or art = 'lager'),
  foreign key (fahrzeug_id, betrieb_id) references public.fahrzeug (id, betrieb_id) on delete cascade,
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade
);
create unique index lagerort_fahrzeug_idx on public.lagerort (fahrzeug_id) where fahrzeug_id is not null;
create unique index lagerort_objekt_idx on public.lagerort (objekt_id) where objekt_id is not null;
create unique index lagerort_standard_idx on public.lagerort (betrieb_id) where standard;

-- ---------------------------------------------------------------------------
-- Bestand und Bewegungen
-- ---------------------------------------------------------------------------
create table public.bestand (
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  lagerort_id uuid not null,
  artikel_id uuid not null,
  -- Buchbestand; darf negativ werden (Sollabbuchung ≠ Regal), die Inventur korrigiert
  menge numeric(14, 4) not null default 0,
  aktualisiert_am timestamptz not null default now(),
  primary key (lagerort_id, artikel_id),
  foreign key (lagerort_id, betrieb_id) references public.lagerort (id, betrieb_id) on delete cascade,
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete cascade
);
create index bestand_artikel_idx on public.bestand (betrieb_id, artikel_id);

create type public.bewegungsart as enum ('zugang', 'abgang_einsatz', 'umbuchung', 'korrektur', 'wechsel');

create table public.bestellung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  artikel_id uuid not null,
  menge numeric(14, 4) not null check (menge > 0),
  lieferant text check (length(lieferant) <= 200),
  status text not null default 'offen' check (status in ('offen', 'geliefert', 'storniert')),
  bestellt_am date not null default current_date,
  geliefert_am timestamptz,
  notiz text check (length(notiz) <= 500),
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete cascade
);
create index bestellung_offen_idx on public.bestellung (betrieb_id, artikel_id) where status = 'offen';

create table public.lagerbewegung (
  -- ID vom Gerät bzw. Server, damit Wiederholungen nichts doppelt buchen
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  artikel_id uuid not null,
  art public.bewegungsart not null,
  menge numeric(14, 4) not null check (menge > 0),
  von_lagerort_id uuid,
  nach_lagerort_id uuid,
  einsatz_id uuid,
  bestellung_id uuid,
  notiz text check (length(notiz) <= 500),
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  check (
    case art
      when 'zugang' then von_lagerort_id is null and nach_lagerort_id is not null
      when 'abgang_einsatz' then von_lagerort_id is not null and nach_lagerort_id is null
      when 'wechsel' then von_lagerort_id is not null and nach_lagerort_id is null
      when 'umbuchung' then von_lagerort_id is not null and nach_lagerort_id is not null
        and von_lagerort_id <> nach_lagerort_id
      when 'korrektur' then (von_lagerort_id is null) <> (nach_lagerort_id is null)
    end
  ),
  check (art <> 'abgang_einsatz' or einsatz_id is not null),
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete cascade,
  foreign key (von_lagerort_id, betrieb_id) references public.lagerort (id, betrieb_id) on delete cascade,
  foreign key (nach_lagerort_id, betrieb_id) references public.lagerort (id, betrieb_id) on delete cascade,
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete set null (einsatz_id),
  foreign key (bestellung_id, betrieb_id) references public.bestellung (id, betrieb_id) on delete set null (bestellung_id)
);
create index lagerbewegung_artikel_idx on public.lagerbewegung (betrieb_id, artikel_id, erstellt_am desc);
-- je Einsatz und Artikel höchstens eine Abbuchung (Nachlauf und App dürfen beide anstoßen)
create unique index lagerbewegung_einsatz_eindeutig on public.lagerbewegung (einsatz_id, artikel_id)
  where art = 'abgang_einsatz';

create function public.bestand_buchen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.von_lagerort_id is not null then
    insert into public.bestand (betrieb_id, lagerort_id, artikel_id, menge)
    values (new.betrieb_id, new.von_lagerort_id, new.artikel_id, -new.menge)
    on conflict (lagerort_id, artikel_id)
    do update set menge = public.bestand.menge - new.menge, aktualisiert_am = now();
  end if;
  if new.nach_lagerort_id is not null then
    insert into public.bestand (betrieb_id, lagerort_id, artikel_id, menge)
    values (new.betrieb_id, new.nach_lagerort_id, new.artikel_id, new.menge)
    on conflict (lagerort_id, artikel_id)
    do update set menge = public.bestand.menge + new.menge, aktualisiert_am = now();
  end if;
  return new;
end;
$$;
create trigger lagerbewegung_bestand after insert on public.lagerbewegung
for each row execute function public.bestand_buchen();

-- Abbuchung für einen Einsatz erledigt (Nachlauf erkennt so, was noch fehlt)
alter table public.einsatz add column material_gebucht_am timestamptz;

-- ---------------------------------------------------------------------------
-- Verbrauch je Objekt (überschreibt die Vorlage für gleichen Artikel und Bezug)
-- ---------------------------------------------------------------------------
create table public.objekt_bedarf (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  artikel_id uuid not null,
  menge numeric(12, 4) not null check (menge > 0),
  bezug public.bedarfsbezug not null default 'einsatz',
  -- woher der Wert stammt, z. B. „Ist-Korrektur aus Leer-Meldung“
  notiz text check (length(notiz) <= 300),
  erstellt_am timestamptz not null default now(),
  unique (objekt_id, artikel_id, bezug),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade,
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Werkzeuge (je Stück ein Zähler bzw. Prüftermin) mit Wechseln und Prüfungen
-- ---------------------------------------------------------------------------
create table public.werkzeug (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  artikel_id uuid not null,
  bezeichnung text not null check (length(trim(bezeichnung)) between 1 and 100),
  -- Besitzer: Mitarbeiter oder Fahrzeug (damit zwei Leute nicht denselben Zähler teilen)
  mitglied_id uuid,
  fahrzeug_id uuid,
  -- Zählerstand beim Anlegen (z. B. seit dem letzten Wechsel schon 380 Fenster)
  startstand numeric(12, 2) not null default 0 check (startstand >= 0),
  letzter_wechsel_am timestamptz,
  naechste_pruefung date,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete cascade,
  foreign key (mitglied_id, betrieb_id) references public.mitglied (id, betrieb_id) on delete set null (mitglied_id),
  foreign key (fahrzeug_id, betrieb_id) references public.fahrzeug (id, betrieb_id) on delete set null (fahrzeug_id)
);
create index werkzeug_betrieb_idx on public.werkzeug (betrieb_id) where aktiv;

create table public.werkzeug_wechsel (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  werkzeug_id uuid not null,
  -- wann gewechselt wurde (auch nachträglich datiert)
  am timestamptz not null,
  -- Zählerstand beim Wechsel (für „Lebensdauer lernt mit“)
  stand numeric(12, 2) not null default 0 check (stand >= 0),
  grund text not null default 'verschleiss' check (grund in ('verschleiss', 'defekt', 'auto')),
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  foreign key (werkzeug_id, betrieb_id) references public.werkzeug (id, betrieb_id) on delete cascade
);
create index werkzeug_wechsel_idx on public.werkzeug_wechsel (werkzeug_id, am desc);

create function public.werkzeug_wechsel_uebernehmen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.werkzeug
  set letzter_wechsel_am = greatest(coalesce(letzter_wechsel_am, new.am), new.am)
  where id = new.werkzeug_id;
  return new;
end;
$$;
create trigger werkzeug_wechsel_nach after insert on public.werkzeug_wechsel
for each row execute function public.werkzeug_wechsel_uebernehmen();

create table public.werkzeug_pruefung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  werkzeug_id uuid not null,
  am date not null,
  bestanden boolean not null default true,
  notiz text check (length(notiz) <= 500),
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  foreign key (werkzeug_id, betrieb_id) references public.werkzeug (id, betrieb_id) on delete cascade
);

-- bestandene Prüfung setzt den nächsten Termin nach dem Prüfintervall des Artikels
create function public.werkzeug_pruefung_uebernehmen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_monate int;
begin
  if not new.bestanden then
    return new;
  end if;
  select a.pruefintervall_monate into v_monate
  from public.werkzeug w join public.artikel a on a.id = w.artikel_id
  where w.id = new.werkzeug_id;
  if v_monate is not null then
    update public.werkzeug
    set naechste_pruefung = (new.am + make_interval(months => v_monate))::date
    where id = new.werkzeug_id
      and (naechste_pruefung is null or naechste_pruefung < (new.am + make_interval(months => v_monate))::date);
  end if;
  return new;
end;
$$;
create trigger werkzeug_pruefung_nach after insert on public.werkzeug_pruefung
for each row execute function public.werkzeug_pruefung_uebernehmen();

-- ---------------------------------------------------------------------------
-- RLS: lesen alle Mitglieder (App braucht Fahrzeugbestand und Werkzeuge), schreiben das Büro.
-- Bewegungen, Wechsel und Prüfungen werden nie geändert oder gelöscht.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['lagerort', 'objekt_bedarf', 'werkzeug'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_mitglied(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
  foreach t in array array['lagerbewegung', 'werkzeug_wechsel', 'werkzeug_pruefung'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_mitglied(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

alter table public.bestand enable row level security;
create policy bestand_lesen on public.bestand for select to authenticated
  using (public.ist_mitglied(betrieb_id));

alter table public.bestellung enable row level security;
create policy bestellung_lesen on public.bestellung for select to authenticated
  using (public.ist_buero(betrieb_id));
create policy bestellung_anlegen on public.bestellung for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy bestellung_aendern on public.bestellung for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));

-- ---------------------------------------------------------------------------
-- App-Funktionen (Mitarbeiter)
-- ---------------------------------------------------------------------------
-- Fahrzeug, das der angemeldete Mitarbeiter heute fährt (Tour) oder als Standard hat
create function public.app_mein_fahrzeug_ort(p_lagerort_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid;
begin
  select l.betrieb_id into v_betrieb
  from public.lagerort l
  join public.fahrzeug f on f.id = l.fahrzeug_id
  where l.id = p_lagerort_id and l.art = 'fahrzeug'
    and (
      f.mitglied_id = public.mein_mitglied_id(l.betrieb_id)
      or exists (
        select 1 from public.tour t
        where t.fahrzeug_id = f.id and t.mitarbeiter_id = public.mein_mitglied_id(l.betrieb_id)
          and t.datum between current_date - 1 and current_date + 1
      )
    );
  if v_betrieb is null then
    raise exception 'Nicht dein Fahrzeug' using errcode = '42501';
  end if;
  return v_betrieb;
end;
$$;
revoke all on function public.app_mein_fahrzeug_ort(uuid) from public, anon;
grant execute on function public.app_mein_fahrzeug_ort(uuid) to authenticated;

-- „Geladen“ auf der Packliste: Zentrallager → eigenes Fahrzeug
create function public.app_geladen(p_id uuid, p_artikel_id uuid, p_menge numeric, p_nach_lagerort_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_fahrzeug_ort(p_nach_lagerort_id);
  v_lager uuid;
begin
  if not (p_menge > 0 and p_menge <= 10000) then
    raise exception 'Ungültige Menge' using errcode = '22023';
  end if;
  select id into v_lager from public.lagerort
  where betrieb_id = v_betrieb and standard and aktiv;
  if v_lager is null then
    raise exception 'Kein Zentrallager angelegt' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.artikel where id = p_artikel_id and betrieb_id = v_betrieb) then
    raise exception 'Artikel unbekannt' using errcode = '22023';
  end if;
  insert into public.lagerbewegung (id, betrieb_id, artikel_id, art, menge, von_lagerort_id, nach_lagerort_id, notiz)
  values (p_id, v_betrieb, p_artikel_id, 'umbuchung', p_menge, v_lager, p_nach_lagerort_id, 'geladen (App)')
  on conflict (id) do nothing;
end;
$$;
revoke all on function public.app_geladen(uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.app_geladen(uuid, uuid, numeric, uuid) to authenticated;

-- „Gewechselt“ für ein eigenes Werkzeug; Ersatzteil wird vom Fahrzeug (oder Zentrallager) abgebucht
create function public.app_werkzeug_gewechselt(
  p_id uuid,
  p_werkzeug_id uuid,
  p_am timestamptz,
  p_stand numeric,
  p_grund text default 'verschleiss',
  p_lagerort_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w public.werkzeug;
  v_ort uuid;
begin
  select * into v_w from public.werkzeug w
  where w.id = p_werkzeug_id and w.aktiv and (
    w.mitglied_id = public.mein_mitglied_id(w.betrieb_id)
    or exists (select 1 from public.fahrzeug f where f.id = w.fahrzeug_id
               and f.mitglied_id = public.mein_mitglied_id(w.betrieb_id))
  );
  if v_w.id is null then
    raise exception 'Nicht dein Werkzeug' using errcode = '42501';
  end if;
  if p_grund not in ('verschleiss', 'defekt') then
    raise exception 'Ungültiger Grund' using errcode = '22023';
  end if;
  if p_am > now() + interval '10 minutes' then
    raise exception 'Zeitpunkt liegt in der Zukunft' using errcode = '22023';
  end if;
  insert into public.werkzeug_wechsel (id, betrieb_id, werkzeug_id, am, stand, grund)
  values (p_id, v_w.betrieb_id, v_w.id, p_am, greatest(coalesce(p_stand, 0), 0), p_grund)
  on conflict (id) do nothing;
  if not found then
    return;
  end if;
  -- Ersatzteil abbuchen: angegebenes eigenes Fahrzeug, sonst Zentrallager
  if p_lagerort_id is not null then
    perform public.app_mein_fahrzeug_ort(p_lagerort_id);
    v_ort := p_lagerort_id;
  else
    select id into v_ort from public.lagerort where betrieb_id = v_w.betrieb_id and standard and aktiv;
  end if;
  if v_ort is not null then
    insert into public.lagerbewegung (betrieb_id, artikel_id, art, menge, von_lagerort_id, notiz)
    values (v_w.betrieb_id, v_w.artikel_id, 'wechsel', 1, v_ort, 'Wechsel ' || v_w.bezeichnung);
  end if;
end;
$$;
revoke all on function public.app_werkzeug_gewechselt(uuid, uuid, timestamptz, numeric, text, uuid) from public, anon;
grant execute on function public.app_werkzeug_gewechselt(uuid, uuid, timestamptz, numeric, text, uuid) to authenticated;

-- Jeder Betrieb bekommt ein Zentrallager
insert into public.lagerort (betrieb_id, art, name, standard)
select id, 'lager', 'Zentrallager', true from public.betrieb;

create function public.betrieb_zentrallager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lagerort (betrieb_id, art, name, standard) values (new.id, 'lager', 'Zentrallager', true);
  return new;
end;
$$;
create trigger betrieb_zentrallager after insert on public.betrieb
for each row execute function public.betrieb_zentrallager();

-- Fahrzeuge bekommen automatisch ihren Lagerort
insert into public.lagerort (betrieb_id, art, name, fahrzeug_id)
select betrieb_id, 'fahrzeug', name, id from public.fahrzeug;

create function public.fahrzeug_lagerort()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lagerort (betrieb_id, art, name, fahrzeug_id)
    values (new.betrieb_id, 'fahrzeug', new.name, new.id);
  elsif new.name is distinct from old.name or new.aktiv is distinct from old.aktiv then
    update public.lagerort set name = new.name, aktiv = new.aktiv where fahrzeug_id = new.id;
  end if;
  return new;
end;
$$;
create trigger fahrzeug_lagerort after insert or update on public.fahrzeug
for each row execute function public.fahrzeug_lagerort();
