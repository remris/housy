-- M2: Kunden, Ansprechpartner, Objekte, Bereiche (Raumbuch), Fensteraufmaß, Objektfotos.
--
-- Muster für Kind-Tabellen: zusammengesetzter Fremdschlüssel (parent_id, betrieb_id),
-- damit ein Datensatz nie an einem Elternteil eines anderen Betriebs hängen kann.

-- ---------------------------------------------------------------------------
-- Nummernkreise je Betrieb (Kunden, später Rechnungen, Verträge …)
-- ---------------------------------------------------------------------------
create table public.nummernkreis (
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  art text not null,
  naechste bigint not null default 1 check (naechste > 0),
  primary key (betrieb_id, art)
);

alter table public.nummernkreis enable row level security;
create policy nummernkreis_lesen on public.nummernkreis
  for select to authenticated using (public.ist_buero(betrieb_id));

-- Vergibt lückenlos die nächste Nummer (Zeilensperre durch UPDATE … RETURNING).
create function public.naechste_nummer(p_betrieb_id uuid, p_art text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nummer bigint;
begin
  insert into public.nummernkreis (betrieb_id, art, naechste)
  values (p_betrieb_id, p_art, 2)
  on conflict (betrieb_id, art) do update set naechste = public.nummernkreis.naechste + 1
  returning naechste - 1 into v_nummer;
  return v_nummer;
end;
$$;

revoke all on function public.naechste_nummer(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Kunde
-- ---------------------------------------------------------------------------
create type public.kundentyp as enum ('firma', 'verwaltung', 'privat', 'oeffentlich');

create table public.kunde (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  -- 0 = automatisch vergeben (Trigger); eigene Nummern (z. B. aus Import) bleiben erhalten
  kundennummer bigint not null default 0 check (kundennummer >= 0),
  typ public.kundentyp not null default 'firma',
  name text not null check (length(trim(name)) between 1 and 200),
  zusatz text,
  strasse text,
  plz text,
  ort text,
  land text not null default 'DE',
  email text,
  telefon text,
  rechnungs_email text,
  -- Leitweg-ID für XRechnung an öffentliche Auftraggeber, z. B. 04011000-1234512345-06
  leitweg_id text check (leitweg_id is null or leitweg_id ~ '^[0-9]{2,12}(-[0-9A-Za-z]{1,30})?-[0-9]{2}$'),
  ust_id text,
  zahlungsziel_tage int not null default 14 check (zahlungsziel_tage between 0 and 365),
  notiz text,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (betrieb_id, kundennummer),
  unique (id, betrieb_id)
);

create index kunde_betrieb_name_idx on public.kunde (betrieb_id, name);

create function public.kunde_nummer_vergeben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.kundennummer, 0) = 0 then
    new.kundennummer := public.naechste_nummer(new.betrieb_id, 'kunde');
  else
    -- Eigene Nummer: Nummernkreis dahinter fortsetzen
    insert into public.nummernkreis (betrieb_id, art, naechste)
    values (new.betrieb_id, 'kunde', new.kundennummer + 1)
    on conflict (betrieb_id, art) do update
      set naechste = greatest(public.nummernkreis.naechste, excluded.naechste);
  end if;
  return new;
end;
$$;
revoke all on function public.kunde_nummer_vergeben() from public, anon, authenticated;

create trigger kunde_nummer
before insert on public.kunde
for each row execute function public.kunde_nummer_vergeben();

create trigger kunde_aktualisiert_am
before update on public.kunde
for each row execute function public.setze_aktualisiert_am();


-- ---------------------------------------------------------------------------
-- Ansprechpartner
-- ---------------------------------------------------------------------------
create table public.ansprechpartner (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  kunde_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  funktion text,
  email text,
  telefon text,
  ist_hauptkontakt boolean not null default false,
  erstellt_am timestamptz not null default now(),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete cascade
);

create index ansprechpartner_kunde_idx on public.ansprechpartner (kunde_id);

-- ---------------------------------------------------------------------------
-- Objekt
-- ---------------------------------------------------------------------------
create table public.objekt (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  kunde_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  strasse text,
  plz text,
  ort text,
  land text not null default 'DE',
  breitengrad numeric(9, 6) check (breitengrad between -90 and 90),
  laengengrad numeric(9, 6) check (laengengrad between -180 and 180),
  zugangshinweise text,
  schluessel text,
  notiz text,
  -- Kennung für den QR-Code am Objekt (Check-in, M6)
  qr_kennung uuid not null unique default gen_random_uuid(),
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete restrict
);

create index objekt_betrieb_name_idx on public.objekt (betrieb_id, name);
create index objekt_kunde_idx on public.objekt (kunde_id);

create trigger objekt_aktualisiert_am
before update on public.objekt
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Bereich (Raumbuch)
-- ---------------------------------------------------------------------------
create table public.bereich (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  flaeche_m2 numeric(10, 2) check (flaeche_m2 is null or flaeche_m2 >= 0),
  bodenart text,
  etage text,
  reihenfolge int not null default 0,
  notiz text,
  erstellt_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade
);

create index bereich_objekt_idx on public.bereich (objekt_id);

-- ---------------------------------------------------------------------------
-- Fensteraufmaß
-- ---------------------------------------------------------------------------
create table public.fensteraufmass (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  bezeichnung text,
  typ text not null default 'standard'
    check (typ in ('standard', 'sprossen', 'dachfenster', 'schaufenster', 'glastuer', 'wintergarten', 'sonstiges')),
  anzahl int not null default 1 check (anzahl > 0),
  etage text,
  mit_rahmen boolean not null default false,
  hilfsmittel text[] not null default '{}'
    check (hilfsmittel <@ array['leiter', 'teleskopstange', 'hubsteiger', 'geruest', 'osmose']::text[]),
  notiz text,
  erstellt_am timestamptz not null default now(),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade
);

create index fensteraufmass_objekt_idx on public.fensteraufmass (objekt_id);

-- ---------------------------------------------------------------------------
-- Objektfotos (Storage-Bucket "objektfotos", Pfad <betrieb_id>/<objekt_id>/<datei>)
-- ---------------------------------------------------------------------------
create table public.objekt_foto (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  pfad text not null unique,
  beschreibung text,
  erstellt_von uuid references auth.users (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade
);

create index objekt_foto_objekt_idx on public.objekt_foto (objekt_id);

-- ---------------------------------------------------------------------------
-- RLS: alle Mitglieder lesen (Mitarbeiter brauchen Objekte für die App),
-- Büro (Inhaber/Disponent) schreibt. Fotos dürfen auch Mitarbeiter anlegen.
-- ---------------------------------------------------------------------------
alter table public.kunde enable row level security;
alter table public.ansprechpartner enable row level security;
alter table public.objekt enable row level security;
alter table public.bereich enable row level security;
alter table public.fensteraufmass enable row level security;
alter table public.objekt_foto enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['kunde', 'ansprechpartner', 'objekt', 'bereich', 'fensteraufmass'] loop
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_mitglied(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

create policy objekt_foto_lesen on public.objekt_foto
  for select to authenticated using (public.ist_mitglied(betrieb_id));
create policy objekt_foto_anlegen on public.objekt_foto
  for insert to authenticated
  with check (public.ist_mitglied(betrieb_id) and erstellt_von = auth.uid());
create policy objekt_foto_loeschen on public.objekt_foto
  for delete to authenticated
  using (public.ist_buero(betrieb_id) or erstellt_von = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket für Objektfotos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('objektfotos', 'objektfotos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy objektfotos_lesen on storage.objects
  for select to authenticated
  using (bucket_id = 'objektfotos' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));

create policy objektfotos_hochladen on storage.objects
  for insert to authenticated
  with check (bucket_id = 'objektfotos' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));

create policy objektfotos_loeschen on storage.objects
  for delete to authenticated
  using (bucket_id = 'objektfotos' and public.ist_buero(((storage.foldername(name))[1])::uuid));
