-- M4: Verträge mit Versionen und Leistungen (Serien), Einsätze, Bundesland für Feiertage,
-- Vertragsbedingungen und digitale Unterschrift.

alter table public.betrieb
  add column bundesland text not null default 'BW'
    check (bundesland in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH')),
  add column vertragsbedingungen text;

create type public.vertragsstatus as enum ('entwurf', 'aktiv', 'gekuendigt', 'beendet');
create type public.abrechnungsart as enum ('pauschale', 'aufwand', 'einzelauftrag');
create type public.frequenz as enum ('taeglich', 'woechentlich', 'monatlich', 'einmalig');
create type public.feiertagregel as enum ('auslassen', 'naechster_werktag', 'ignorieren');
create type public.einsatzstatus as enum ('geplant', 'zugewiesen', 'unterwegs', 'begonnen', 'erledigt', 'abgesagt');

-- ---------------------------------------------------------------------------
-- Vertrag
-- ---------------------------------------------------------------------------
create table public.vertrag (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  vertragsnummer bigint not null default 0,
  kunde_id uuid not null,
  objekt_id uuid not null,
  titel text not null check (length(trim(titel)) between 1 and 200),
  status public.vertragsstatus not null default 'entwurf',
  beginn date not null,
  -- 0 = unbefristet
  laufzeit_monate int not null default 12 check (laufzeit_monate between 0 and 240),
  verlaengerung_monate int not null default 12 check (verlaengerung_monate between 0 and 120),
  kuendigungsfrist_monate int not null default 3 check (kuendigungsfrist_monate between 0 and 24),
  frist_zum text not null default 'laufzeitende' check (frist_zum in ('laufzeitende', 'monatsende')),
  gekuendigt_am date,
  -- letzter Leistungstag nach Kündigung oder Ende
  endet_am date,
  notiz text,
  -- Digitale Unterschrift (Freigabe-Link für den Kunden)
  freigabe_token uuid not null unique default gen_random_uuid(),
  unterschrieben_am timestamptz,
  unterschrift_name text,
  unterschrift_bild text check (unterschrift_bild is null or length(unterschrift_bild) < 500000),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  unique (betrieb_id, vertragsnummer),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete restrict,
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete restrict,
  check (endet_am is null or endet_am >= beginn)
);

create index vertrag_betrieb_status_idx on public.vertrag (betrieb_id, status);
create index vertrag_objekt_idx on public.vertrag (objekt_id);

create function public.vertrag_nummer_vergeben()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.vertragsnummer, 0) = 0 then
    new.vertragsnummer := public.naechste_nummer(new.betrieb_id, 'vertrag');
  end if;
  return new;
end;
$$;
revoke all on function public.vertrag_nummer_vergeben() from public, anon, authenticated;

create trigger vertrag_nummer before insert on public.vertrag
for each row execute function public.vertrag_nummer_vergeben();
create trigger vertrag_aktualisiert_am before update on public.vertrag
for each row execute function public.setze_aktualisiert_am();

-- Objekt muss zum Kunden gehören
create function public.vertrag_objekt_pruefen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.objekt o where o.id = new.objekt_id and o.kunde_id = new.kunde_id) then
    raise exception 'Objekt gehört nicht zum Kunden' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger vertrag_objekt_pruefen before insert or update of kunde_id, objekt_id on public.vertrag
for each row execute function public.vertrag_objekt_pruefen();

-- ---------------------------------------------------------------------------
-- Vertragsversion
-- ---------------------------------------------------------------------------
create table public.vertragsversion (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  vertrag_id uuid not null,
  version int not null check (version >= 1),
  gueltig_ab date not null,
  abrechnungsart public.abrechnungsart not null default 'pauschale',
  -- Monatspauschale netto in Cent (bei Abrechnungsart pauschale)
  pauschale_cent int check (pauschale_cent is null or pauschale_cent >= 0),
  grund text,
  -- Herkunft: Büro oder Änderung vor Ort (M6)
  quelle text not null default 'buero' check (quelle in ('buero', 'vor_ort')),
  erstellt_von uuid references auth.users (id) on delete set null,
  erstellt_am timestamptz not null default now(),
  unique (id, betrieb_id),
  unique (vertrag_id, version),
  unique (vertrag_id, gueltig_ab),
  foreign key (vertrag_id, betrieb_id) references public.vertrag (id, betrieb_id) on delete cascade,
  check (abrechnungsart <> 'pauschale' or pauschale_cent is not null)
);

-- ---------------------------------------------------------------------------
-- Vertragsleistung (Serie)
-- ---------------------------------------------------------------------------
create table public.vertragsleistung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  version_id uuid not null,
  vorlage_id uuid not null,
  preis_id uuid,
  bezeichnung text,
  frequenz public.frequenz not null default 'woechentlich',
  intervall int not null default 1 check (intervall between 1 and 104),
  wochentage int[] not null default '{}' check (wochentage <@ array[1, 2, 3, 4, 5, 6, 7]),
  monatstag int check (monatstag is null or monatstag between 1 and 31),
  -- Bezugsdatum der Serie (null = gültig_ab der Version)
  startdatum date,
  -- Reinigungsfenster
  zeitfenster_von time,
  zeitfenster_bis time,
  erlaubte_wochentage int[] not null default '{}' check (erlaubte_wochentage <@ array[1, 2, 3, 4, 5, 6, 7]),
  feiertag_regel public.feiertagregel not null default 'auslassen',
  -- Umfang abweichend vom Objekt (z. B. nur Kellerfenster)
  menge_m2 numeric(10, 2) check (menge_m2 is null or menge_m2 >= 0),
  menge_fenster int check (menge_fenster is null or menge_fenster >= 0),
  -- Einzelpreis abweichend von der Preisliste (Cent, je Einheit der Preisposition)
  preis_cent int check (preis_cent is null or preis_cent >= 0),
  reihenfolge int not null default 0,
  unique (id, betrieb_id),
  foreign key (version_id, betrieb_id) references public.vertragsversion (id, betrieb_id) on delete cascade,
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete restrict,
  foreign key (preis_id, betrieb_id) references public.preisliste (id, betrieb_id) on delete set null (preis_id),
  check (frequenz <> 'woechentlich' or cardinality(wochentage) > 0),
  check (zeitfenster_von is null or zeitfenster_bis is null or zeitfenster_von < zeitfenster_bis)
);

create index vertragsleistung_version_idx on public.vertragsleistung (version_id);

-- ---------------------------------------------------------------------------
-- Einsatz
-- ---------------------------------------------------------------------------
create table public.einsatz (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  vorlage_id uuid not null,
  vertrag_id uuid,
  vertragsleistung_id uuid,
  datum date not null,
  zeitfenster_von time,
  zeitfenster_bis time,
  sollzeit_minuten int not null default 60 check (sollzeit_minuten >= 0),
  status public.einsatzstatus not null default 'geplant',
  mitarbeiter_id uuid,
  quelle text not null default 'serie' check (quelle in ('serie', 'manuell')),
  verschoben_von date,
  notiz text,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete restrict,
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete restrict,
  foreign key (vertrag_id, betrieb_id) references public.vertrag (id, betrieb_id) on delete cascade,
  foreign key (vertragsleistung_id, betrieb_id) references public.vertragsleistung (id, betrieb_id) on delete set null (vertragsleistung_id),
  foreign key (mitarbeiter_id) references public.mitglied (id) on delete set null
);

create index einsatz_betrieb_datum_idx on public.einsatz (betrieb_id, datum);
create index einsatz_vertrag_datum_idx on public.einsatz (vertrag_id, datum);
create index einsatz_mitarbeiter_datum_idx on public.einsatz (mitarbeiter_id, datum);
-- höchstens ein Serien-Einsatz je Vertrag, Vorlage und Tag
create unique index einsatz_serie_eindeutig_idx on public.einsatz (vertrag_id, vorlage_id, datum)
  where quelle = 'serie';

create trigger einsatz_aktualisiert_am before update on public.einsatz
for each row execute function public.setze_aktualisiert_am();

-- Mitarbeiter muss zum selben Betrieb gehören
create function public.einsatz_mitarbeiter_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mitarbeiter_id is not null and not exists (
    select 1 from public.mitglied m where m.id = new.mitarbeiter_id and m.betrieb_id = new.betrieb_id
  ) then
    raise exception 'Mitarbeiter gehört nicht zum Betrieb' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.einsatz_mitarbeiter_pruefen() from public, anon, authenticated;

create trigger einsatz_mitarbeiter_pruefen before insert or update of mitarbeiter_id on public.einsatz
for each row execute function public.einsatz_mitarbeiter_pruefen();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Verträge und Versionen: nur Büro (Preise, Laufzeiten)
  foreach t in array array['vertrag', 'vertragsversion', 'vertragsleistung'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

-- Einsätze: Büro alles; Mitarbeiter sehen ihre eigenen (Statusänderungen folgen in M6)
alter table public.einsatz enable row level security;

create function public.mein_mitglied_id(p_betrieb_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.mitglied m
  where m.betrieb_id = p_betrieb_id and m.user_id = auth.uid() and m.aktiv;
$$;

create policy einsatz_lesen on public.einsatz for select to authenticated
  using (public.ist_buero(betrieb_id) or mitarbeiter_id = public.mein_mitglied_id(betrieb_id));
create policy einsatz_anlegen on public.einsatz for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy einsatz_aendern on public.einsatz for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy einsatz_loeschen on public.einsatz for delete to authenticated
  using (public.ist_buero(betrieb_id));

-- ---------------------------------------------------------------------------
-- Öffentliche Vertragsfreigabe (Kunde unterschreibt per Link)
-- ---------------------------------------------------------------------------
create function public.vertrag_freigabe_info(p_token uuid)
returns table (
  betrieb_name text,
  vertragsnummer bigint,
  titel text,
  kunde_name text,
  objekt_name text,
  beginn date,
  status public.vertragsstatus,
  unterschrieben_am timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.firmenname, b.name), v.vertragsnummer, v.titel, k.name, o.name, v.beginn, v.status,
         v.unterschrieben_am
  from public.vertrag v
  join public.betrieb b on b.id = v.betrieb_id
  join public.kunde k on k.id = v.kunde_id
  join public.objekt o on o.id = v.objekt_id
  where v.freigabe_token = p_token;
$$;

create function public.vertrag_unterschreiben(p_token uuid, p_name text, p_bild text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.vertrag;
begin
  select * into v from public.vertrag where freigabe_token = p_token for update;
  if not found then
    raise exception 'Vertrag nicht gefunden' using errcode = 'P0002';
  end if;
  if v.unterschrieben_am is not null then
    raise exception 'Vertrag ist bereits unterschrieben' using errcode = '23505';
  end if;
  if v.status <> 'entwurf' then
    raise exception 'Vertrag kann nicht mehr unterschrieben werden' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or p_bild is null or p_bild not like 'data:image/png;base64,%' then
    raise exception 'Name und Unterschrift sind erforderlich' using errcode = '22023';
  end if;
  update public.vertrag
  set unterschrieben_am = now(), unterschrift_name = trim(p_name), unterschrift_bild = p_bild
  where id = v.id;
end;
$$;

grant execute on function public.vertrag_freigabe_info(uuid) to anon, authenticated;
grant execute on function public.vertrag_unterschreiben(uuid, text, text) to anon, authenticated;

-- Vollständige Vertragsdaten für PDF und Freigabeseite (per Token, auch ohne Login)
create function public.vertrag_dokument(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'vertrag', to_jsonb(v) - 'unterschrift_bild' - 'freigabe_token',
    'unterschrift_bild', v.unterschrift_bild,
    'betrieb', jsonb_build_object(
      'name', coalesce(b.firmenname, b.name), 'strasse', b.strasse, 'plz', b.plz, 'ort', b.ort,
      'telefon', b.telefon, 'email', b.email, 'website', b.website, 'steuernummer', b.steuernummer,
      'ust_id', b.ust_id, 'logo_pfad', b.logo_pfad, 'vertragsbedingungen', b.vertragsbedingungen),
    'kunde', jsonb_build_object('name', k.name, 'zusatz', k.zusatz, 'strasse', k.strasse, 'plz', k.plz,
      'ort', k.ort, 'kundennummer', k.kundennummer),
    'objekt', jsonb_build_object('name', o.name, 'strasse', o.strasse, 'plz', o.plz, 'ort', o.ort),
    'versionen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', vv.version, 'gueltig_ab', vv.gueltig_ab, 'abrechnungsart', vv.abrechnungsart,
        'pauschale_cent', vv.pauschale_cent,
        'leistungen', coalesce((
          select jsonb_agg(jsonb_build_object(
            'bezeichnung', coalesce(l.bezeichnung, av.name), 'vorlage', av.name, 'frequenz', l.frequenz,
            'intervall', l.intervall, 'wochentage', l.wochentage, 'monatstag', l.monatstag,
            'zeitfenster_von', l.zeitfenster_von, 'zeitfenster_bis', l.zeitfenster_bis,
            'feiertag_regel', l.feiertag_regel,
            'preis_cent', coalesce(l.preis_cent, p.preis_cent), 'preis_einheit', p.einheit,
            'taetigkeiten', coalesce((select jsonb_agg(t.text order by t.reihenfolge)
                                      from public.vorlage_taetigkeit t where t.vorlage_id = av.id), '[]'))
            order by l.reihenfolge, av.name)
          from public.vertragsleistung l
          join public.auftragsvorlage av on av.id = l.vorlage_id
          left join public.preisliste p on p.id = l.preis_id
          where l.version_id = vv.id), '[]'))
        order by vv.version)
      from public.vertragsversion vv where vv.vertrag_id = v.id), '[]'))
  from public.vertrag v
  join public.betrieb b on b.id = v.betrieb_id
  join public.kunde k on k.id = v.kunde_id
  join public.objekt o on o.id = v.objekt_id
  where v.freigabe_token = p_token;
$$;

grant execute on function public.vertrag_dokument(uuid) to anon, authenticated;

-- Neue Vertragsversion ab Stichtag: übernimmt die Leistungen der zuletzt gültigen Version
create function public.vertragsversion_anlegen(
  p_vertrag_id uuid,
  p_gueltig_ab date,
  p_abrechnungsart public.abrechnungsart,
  p_pauschale_cent int,
  p_grund text,
  p_quelle text default 'buero'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.vertrag;
  v_vorher public.vertragsversion;
  v_neu uuid;
begin
  select * into v from public.vertrag where id = p_vertrag_id;
  if not found or not public.ist_buero(v.betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_gueltig_ab < v.beginn then
    raise exception 'Version darf nicht vor Vertragsbeginn gelten' using errcode = '22023';
  end if;
  select * into v_vorher from public.vertragsversion
  where vertrag_id = v.id and gueltig_ab <= p_gueltig_ab
  order by gueltig_ab desc limit 1;

  insert into public.vertragsversion (betrieb_id, vertrag_id, version, gueltig_ab, abrechnungsart,
    pauschale_cent, grund, quelle, erstellt_von)
  values (v.betrieb_id, v.id,
    (select coalesce(max(version), 0) + 1 from public.vertragsversion where vertrag_id = v.id),
    p_gueltig_ab, p_abrechnungsart, p_pauschale_cent, p_grund, p_quelle, auth.uid())
  returning id into v_neu;

  if v_vorher.id is not null then
    insert into public.vertragsleistung (betrieb_id, version_id, vorlage_id, preis_id, bezeichnung,
      frequenz, intervall, wochentage, monatstag, startdatum, zeitfenster_von, zeitfenster_bis,
      erlaubte_wochentage, feiertag_regel, menge_m2, menge_fenster, preis_cent, reihenfolge)
    select betrieb_id, v_neu, vorlage_id, preis_id, bezeichnung, frequenz, intervall, wochentage,
      monatstag, startdatum, zeitfenster_von, zeitfenster_bis, erlaubte_wochentage, feiertag_regel,
      menge_m2, menge_fenster, preis_cent, reihenfolge
    from public.vertragsleistung where version_id = v_vorher.id;
  end if;
  return v_neu;
end;
$$;
