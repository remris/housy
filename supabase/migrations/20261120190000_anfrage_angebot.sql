-- M10 Anfrage, Angebot, Online-Buchung:
-- Öffentliches Anfrageformular und Online-Buchung (Fensterreinigung privat) je Betrieb über eine
-- öffentliche Kennung, Angebote mit Annahme per Link. Bei Annahme bzw. Buchung entstehen Kunde,
-- Objekt und Vertrag ohne Abtippen. Öffentliche Zugriffe nur über SECURITY-DEFINER-Funktionen.

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
alter table public.betrieb
  add column oeffentlich_kennung text not null unique default substr(md5(gen_random_uuid()::text), 1, 10)
    check (oeffentlich_kennung ~ '^[a-z0-9-]{6,40}$'),
  add column anfrage_aktiv boolean not null default true,
  -- Online-Buchung (src/domain/preisrechner.ts, BuchungsEinstellungen); {} = nicht eingerichtet
  add column buchung jsonb not null default '{}'::jsonb,
  add column datenschutz_url text check (datenschutz_url is null or datenschutz_url ~ '^https?://'),
  add column impressum_url text check (impressum_url is null or impressum_url ~ '^https?://');

-- ---------------------------------------------------------------------------
-- Anfragen
-- ---------------------------------------------------------------------------
create type public.anfragestatus as enum ('neu', 'in_bearbeitung', 'angebot', 'gewonnen', 'verloren');

create table public.anfrage (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  quelle text not null default 'formular' check (quelle in ('formular', 'telefon', 'buchung')),
  status public.anfragestatus not null default 'neu',
  kundentyp public.kundentyp not null default 'privat',
  name text not null check (length(trim(name)) between 2 and 200),
  firma text check (length(firma) <= 200),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefon text check (length(telefon) <= 50),
  strasse text check (length(strasse) <= 200),
  plz text check (plz is null or plz ~ '^\d{5}$'),
  ort text check (length(ort) <= 100),
  leistung text check (length(leistung) <= 300),
  nachricht text check (length(nachricht) <= 4000),
  wunschtermin text check (length(wunschtermin) <= 200),
  datenschutz_am timestamptz,
  kunde_id uuid,
  objekt_id uuid,
  notiz_buero text check (length(notiz_buero) <= 2000),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  check (email is not null or telefon is not null),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete set null (kunde_id),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete set null (objekt_id)
);
create index anfrage_betrieb_idx on public.anfrage (betrieb_id, erstellt_am desc);
create trigger anfrage_aktualisiert_am before update on public.anfrage
for each row execute function public.setze_aktualisiert_am();

alter table public.anfrage enable row level security;
create policy anfrage_lesen on public.anfrage for select to authenticated using (public.ist_buero(betrieb_id));
create policy anfrage_anlegen on public.anfrage for insert to authenticated with check (public.ist_buero(betrieb_id));
create policy anfrage_aendern on public.anfrage for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy anfrage_loeschen on public.anfrage for delete to authenticated using (public.ist_buero(betrieb_id));

-- ---------------------------------------------------------------------------
-- Angebote
-- ---------------------------------------------------------------------------
create type public.angebotsstatus as enum ('entwurf', 'versendet', 'angenommen', 'abgelehnt');

create table public.angebot (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  nummer bigint not null default 0,
  anfrage_id uuid,
  -- bestehender Kunde/Objekt; sonst werden sie bei Annahme aus den Angaben unten angelegt
  kunde_id uuid,
  objekt_id uuid,
  kundentyp public.kundentyp not null default 'firma',
  empfaenger_name text not null check (length(trim(empfaenger_name)) between 2 and 200),
  empfaenger_firma text check (length(empfaenger_firma) <= 200),
  empfaenger_email text check (empfaenger_email is null or empfaenger_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  empfaenger_telefon text check (length(empfaenger_telefon) <= 50),
  strasse text,
  plz text check (plz is null or plz ~ '^\d{5}$'),
  ort text,
  objekt_name text,
  objekt_strasse text,
  objekt_plz text check (objekt_plz is null or objekt_plz ~ '^\d{5}$'),
  objekt_ort text,
  titel text not null check (length(trim(titel)) between 1 and 200),
  einleitung text check (length(einleitung) <= 4000),
  beginn date not null,
  gueltig_bis date,
  abrechnungsart public.abrechnungsart not null default 'pauschale',
  pauschale_cent int check (pauschale_cent is null or pauschale_cent >= 0),
  laufzeit_monate int not null default 12 check (laufzeit_monate between 0 and 240),
  kuendigungsfrist_monate int not null default 3 check (kuendigungsfrist_monate between 0 and 24),
  status public.angebotsstatus not null default 'entwurf',
  freigabe_token uuid not null unique default gen_random_uuid(),
  versendet_am timestamptz,
  angenommen_am timestamptz,
  angenommen_name text,
  unterschrift_bild text check (unterschrift_bild is null or length(unterschrift_bild) < 500000),
  abgelehnt_am timestamptz,
  ablehngrund text check (length(ablehngrund) <= 1000),
  vertrag_id uuid,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  unique (betrieb_id, nummer),
  foreign key (anfrage_id, betrieb_id) references public.anfrage (id, betrieb_id) on delete set null (anfrage_id),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete set null (kunde_id),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete set null (objekt_id),
  foreign key (vertrag_id, betrieb_id) references public.vertrag (id, betrieb_id) on delete set null (vertrag_id)
);
create index angebot_betrieb_idx on public.angebot (betrieb_id, erstellt_am desc);

create function public.angebot_vorbelegen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and coalesce(new.nummer, 0) = 0 then
    new.nummer := public.naechste_nummer(new.betrieb_id, 'angebot');
  end if;
  -- angenommene oder abgelehnte Angebote bleiben, wie sie sind (nur Vertragsbezug darf sich ändern)
  if tg_op = 'UPDATE' and old.status in ('angenommen', 'abgelehnt')
     and (new.status <> old.status or new.titel <> old.titel or new.pauschale_cent is distinct from old.pauschale_cent
          or new.abrechnungsart <> old.abrechnungsart or new.beginn <> old.beginn
          or new.empfaenger_name <> old.empfaenger_name) then
    raise exception 'Angenommene oder abgelehnte Angebote können nicht geändert werden' using errcode = 'P0001';
  end if;
  new.aktualisiert_am := now();
  return new;
end;
$$;
create trigger angebot_vorbelegen before insert or update on public.angebot
for each row execute function public.angebot_vorbelegen();

create table public.angebotsleistung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  angebot_id uuid not null,
  pos int not null default 0,
  vorlage_id uuid not null,
  preis_id uuid,
  bezeichnung text not null check (length(trim(bezeichnung)) between 1 and 200),
  beschreibung text check (length(beschreibung) <= 1000),
  frequenz public.frequenz not null default 'woechentlich',
  intervall int not null default 1 check (intervall between 1 and 104),
  wochentage int[] not null default '{}' check (wochentage <@ array[1, 2, 3, 4, 5, 6, 7]),
  monatstag int check (monatstag is null or monatstag between 1 and 31),
  menge_je_einsatz numeric(12, 3) not null default 1 check (menge_je_einsatz > 0),
  einheit public.preiseinheit not null default 'einsatz',
  preis_cent int check (preis_cent is null or preis_cent >= 0),
  menge_m2 numeric(10, 2) check (menge_m2 is null or menge_m2 >= 0),
  menge_fenster int check (menge_fenster is null or menge_fenster >= 0),
  check (frequenz <> 'woechentlich' or cardinality(wochentage) > 0),
  foreign key (angebot_id, betrieb_id) references public.angebot (id, betrieb_id) on delete cascade,
  foreign key (vorlage_id, betrieb_id) references public.auftragsvorlage (id, betrieb_id) on delete restrict,
  foreign key (preis_id, betrieb_id) references public.preisliste (id, betrieb_id) on delete set null (preis_id)
);
create index angebotsleistung_angebot_idx on public.angebotsleistung (angebot_id);

create function public.angebotsleistung_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.angebotsstatus;
begin
  select status into v_status from public.angebot where id = coalesce(new.angebot_id, old.angebot_id);
  if v_status in ('angenommen', 'abgelehnt') then
    raise exception 'Angenommene oder abgelehnte Angebote können nicht geändert werden' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger angebotsleistung_schuetzen before insert or update or delete on public.angebotsleistung
for each row execute function public.angebotsleistung_schuetzen();

do $$
declare
  t text;
begin
  foreach t in array array['angebot', 'angebotsleistung'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Öffentlich: Betriebsdaten für Anfrage- und Buchungsseite
-- ---------------------------------------------------------------------------
create function public.betrieb_oeffentlich(p_kennung text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(b.firmenname, b.name),
    'logo_pfad', b.logo_pfad,
    'email', b.email,
    'telefon', b.telefon,
    'ort', b.ort,
    'kleinunternehmer', b.kleinunternehmer,
    'bundesland', b.bundesland,
    'anfrage_aktiv', b.anfrage_aktiv,
    'buchung', case when (b.buchung ->> 'aktiv')::boolean is true then b.buchung else null end,
    'datenschutz_url', b.datenschutz_url,
    'impressum_url', b.impressum_url
  )
  from public.betrieb b
  where b.oeffentlich_kennung = lower(p_kennung);
$$;
revoke all on function public.betrieb_oeffentlich(text) from public;
grant execute on function public.betrieb_oeffentlich(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Öffentlich: Anfrage stellen (mit einfacher Begrenzung gegen Massenanfragen)
-- ---------------------------------------------------------------------------
create function public.anfrage_stellen(p_kennung text, p_daten jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid;
  v_email text := nullif(lower(trim(p_daten ->> 'email')), '');
  v_id uuid;
begin
  select id into v_betrieb from public.betrieb
  where oeffentlich_kennung = lower(p_kennung) and anfrage_aktiv;
  if v_betrieb is null then
    raise exception 'Anfragen sind nicht möglich' using errcode = 'P0002';
  end if;
  if coalesce((p_daten ->> 'datenschutz')::boolean, false) is not true then
    raise exception 'Bitte der Datenschutzerklärung zustimmen' using errcode = '22023';
  end if;
  if (select count(*) from public.anfrage where betrieb_id = v_betrieb
      and erstellt_am > now() - interval '1 hour' and quelle = 'formular') >= 30
     or (v_email is not null and (select count(*) from public.anfrage where betrieb_id = v_betrieb
      and lower(email) = v_email and erstellt_am > now() - interval '1 hour') >= 3) then
    raise exception 'Zu viele Anfragen – bitte später erneut versuchen' using errcode = '22023';
  end if;
  insert into public.anfrage (betrieb_id, quelle, kundentyp, name, firma, email, telefon, strasse, plz, ort,
    leistung, nachricht, wunschtermin, datenschutz_am)
  values (
    v_betrieb, 'formular',
    case when p_daten ->> 'kundentyp' in ('firma', 'verwaltung', 'privat', 'oeffentlich')
      then (p_daten ->> 'kundentyp')::public.kundentyp else 'privat' end,
    trim(p_daten ->> 'name'), nullif(trim(p_daten ->> 'firma'), ''), v_email,
    nullif(trim(p_daten ->> 'telefon'), ''), nullif(trim(p_daten ->> 'strasse'), ''),
    nullif(trim(p_daten ->> 'plz'), ''), nullif(trim(p_daten ->> 'ort'), ''),
    nullif(trim(p_daten ->> 'leistung'), ''), nullif(trim(p_daten ->> 'nachricht'), ''),
    nullif(trim(p_daten ->> 'wunschtermin'), ''), now())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.anfrage_stellen(text, jsonb) from public;
grant execute on function public.anfrage_stellen(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Öffentlich: Angebot ansehen, annehmen, ablehnen (per Token)
-- ---------------------------------------------------------------------------
create function public.angebot_info(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'angebot', to_jsonb(a) - 'unterschrift_bild' - 'freigabe_token' - 'betrieb_id',
    'abgelaufen', a.gueltig_bis is not null and a.gueltig_bis < current_date,
    'betrieb', jsonb_build_object(
      'name', coalesce(b.firmenname, b.name), 'strasse', b.strasse, 'plz', b.plz, 'ort', b.ort,
      'telefon', b.telefon, 'email', b.email, 'website', b.website, 'steuernummer', b.steuernummer,
      'ust_id', b.ust_id, 'logo_pfad', b.logo_pfad, 'kleinunternehmer', b.kleinunternehmer,
      'vertragsbedingungen', b.vertragsbedingungen, 'datenschutz_url', b.datenschutz_url),
    'leistungen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bezeichnung', l.bezeichnung, 'beschreibung', l.beschreibung, 'frequenz', l.frequenz,
        'intervall', l.intervall, 'wochentage', to_jsonb(l.wochentage), 'monatstag', l.monatstag,
        'menge_je_einsatz', l.menge_je_einsatz, 'einheit', l.einheit, 'preis_cent', l.preis_cent,
        'ust_satz', coalesce(p.ust_satz, 19),
        'taetigkeiten', coalesce((select jsonb_agg(t.text order by t.reihenfolge)
                                  from public.vorlage_taetigkeit t where t.vorlage_id = l.vorlage_id), '[]'::jsonb)
      ) order by l.pos)
      from public.angebotsleistung l left join public.preisliste p on p.id = l.preis_id
      where l.angebot_id = a.id), '[]'::jsonb)
  )
  from public.angebot a
  join public.betrieb b on b.id = a.betrieb_id
  where a.freigabe_token = p_token and a.status <> 'entwurf';
$$;
revoke all on function public.angebot_info(uuid) from public;
grant execute on function public.angebot_info(uuid) to anon, authenticated;

create function public.angebot_annehmen(p_token uuid, p_name text, p_bild text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.angebot;
  v_kunde uuid;
  v_objekt uuid;
  v_vertrag uuid;
  v_version uuid;
  v_png boolean := coalesce(p_bild, '') like 'data:image/png;base64,%';
begin
  select * into a from public.angebot where freigabe_token = p_token for update;
  if not found or a.status = 'entwurf' then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0002';
  end if;
  if a.status <> 'versendet' then
    raise exception 'Dieses Angebot wurde bereits beantwortet' using errcode = '23505';
  end if;
  if a.gueltig_bis is not null and a.gueltig_bis < current_date then
    raise exception 'Das Angebot ist abgelaufen' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Bitte Ihren Namen angeben' using errcode = '22023';
  end if;
  if not exists (select 1 from public.angebotsleistung where angebot_id = a.id) then
    raise exception 'Angebot ohne Leistungen' using errcode = 'P0001';
  end if;

  -- Kunde
  v_kunde := a.kunde_id;
  if v_kunde is null then
    insert into public.kunde (betrieb_id, typ, name, strasse, plz, ort, email, telefon)
    values (a.betrieb_id, a.kundentyp, coalesce(nullif(trim(a.empfaenger_firma), ''), a.empfaenger_name),
      coalesce(a.strasse, a.objekt_strasse), coalesce(a.plz, a.objekt_plz), coalesce(a.ort, a.objekt_ort),
      a.empfaenger_email, a.empfaenger_telefon)
    returning id into v_kunde;
    if nullif(trim(a.empfaenger_firma), '') is not null then
      insert into public.ansprechpartner (betrieb_id, kunde_id, name, email, telefon, ist_hauptkontakt)
      values (a.betrieb_id, v_kunde, a.empfaenger_name, a.empfaenger_email, a.empfaenger_telefon, true);
    end if;
  end if;

  -- Objekt
  v_objekt := a.objekt_id;
  if v_objekt is null then
    insert into public.objekt (betrieb_id, kunde_id, name, strasse, plz, ort)
    values (a.betrieb_id, v_kunde,
      coalesce(nullif(trim(a.objekt_name), ''), nullif(trim(a.objekt_strasse), ''), a.titel),
      coalesce(a.objekt_strasse, a.strasse), coalesce(a.objekt_plz, a.plz), coalesce(a.objekt_ort, a.ort))
    returning id into v_objekt;
  end if;

  -- Vertragsentwurf mit Version 1 und den Leistungen; die Annahme gilt als Unterschrift
  insert into public.vertrag (betrieb_id, kunde_id, objekt_id, titel, beginn, laufzeit_monate,
    kuendigungsfrist_monate, notiz, unterschrieben_am, unterschrift_name, unterschrift_bild)
  values (a.betrieb_id, v_kunde, v_objekt, a.titel, greatest(a.beginn, current_date), a.laufzeit_monate,
    a.kuendigungsfrist_monate, 'Aus Angebot ' || a.nummer || ' (online angenommen)',
    case when v_png then now() end, case when v_png then trim(p_name) end, case when v_png then p_bild end)
  returning id into v_vertrag;
  insert into public.vertragsversion (betrieb_id, vertrag_id, version, gueltig_ab, abrechnungsart, pauschale_cent, grund)
  values (a.betrieb_id, v_vertrag, 1, greatest(a.beginn, current_date), a.abrechnungsart,
    case when a.abrechnungsart = 'pauschale' then coalesce(a.pauschale_cent, 0) end, 'Angebot ' || a.nummer)
  returning id into v_version;
  insert into public.vertragsleistung (betrieb_id, version_id, vorlage_id, preis_id, bezeichnung, frequenz,
    intervall, wochentage, monatstag, menge_m2, menge_fenster, preis_cent, reihenfolge)
  select a.betrieb_id, v_version, l.vorlage_id, l.preis_id, l.bezeichnung, l.frequenz, l.intervall,
    l.wochentage, l.monatstag, l.menge_m2, l.menge_fenster, l.preis_cent, l.pos
  from public.angebotsleistung l where l.angebot_id = a.id;

  update public.angebot
  set status = 'angenommen', angenommen_am = now(), angenommen_name = trim(p_name),
      unterschrift_bild = case when v_png then p_bild end,
      kunde_id = v_kunde, objekt_id = v_objekt, vertrag_id = v_vertrag
  where id = a.id;
  if a.anfrage_id is not null then
    update public.anfrage set status = 'gewonnen', kunde_id = v_kunde, objekt_id = v_objekt
    where id = a.anfrage_id;
  end if;
  return jsonb_build_object('vertrag_id', v_vertrag, 'kunde_id', v_kunde, 'objekt_id', v_objekt);
end;
$$;
revoke all on function public.angebot_annehmen(uuid, text, text) from public;
grant execute on function public.angebot_annehmen(uuid, text, text) to anon, authenticated;

create function public.angebot_ablehnen(p_token uuid, p_grund text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.angebot;
begin
  select * into a from public.angebot where freigabe_token = p_token for update;
  if not found or a.status = 'entwurf' then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0002';
  end if;
  if a.status <> 'versendet' then
    raise exception 'Dieses Angebot wurde bereits beantwortet' using errcode = '23505';
  end if;
  update public.angebot
  set status = 'abgelehnt', abgelehnt_am = now(), ablehngrund = left(nullif(trim(p_grund), ''), 1000)
  where id = a.id;
  if a.anfrage_id is not null then
    update public.anfrage set status = 'verloren' where id = a.anfrage_id;
  end if;
end;
$$;
revoke all on function public.angebot_ablehnen(uuid, text) from public;
grant execute on function public.angebot_ablehnen(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Öffentlich: Online-Buchung Fensterreinigung
-- ---------------------------------------------------------------------------
-- Belegung für die Terminsuche, ohne Namen (Mitarbeiter nur als Nummer)
create function public.buchung_kalender(p_kennung text, p_von date, p_bis date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select id from public.betrieb
    where oeffentlich_kennung = lower(p_kennung) and (buchung ->> 'aktiv')::boolean is true
  ),
  m as (
    select mg.id, row_number() over (order by mg.erstellt_am) as nr
    from public.mitglied mg join b on b.id = mg.betrieb_id
    where mg.aktiv and exists (select 1 from public.mitarbeiter_verfuegbarkeit v where v.mitglied_id = mg.id)
  )
  select jsonb_build_object(
    'mitarbeiter', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', 'm' || m.nr,
        'arbeitszeiten', (select coalesce(jsonb_agg(jsonb_build_object(
            'wochentag', v.wochentag, 'von', to_char(v.von, 'HH24:MI'), 'bis', to_char(v.bis, 'HH24:MI'))), '[]'::jsonb)
          from public.mitarbeiter_verfuegbarkeit v where v.mitglied_id = m.id),
        'abwesend', (select coalesce(jsonb_agg(distinct to_char(d, 'YYYY-MM-DD')), '[]'::jsonb)
          from public.abwesenheit ab,
               generate_series(greatest(ab.von, p_von), least(ab.bis, p_bis), interval '1 day') d
          where ab.mitglied_id = m.id and ab.bis >= p_von and ab.von <= p_bis)
      )) from m), '[]'::jsonb),
    'belegt', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mitarbeiterId', (select 'm' || m.nr from m where m.id = e.mitarbeiter_id),
        'datum', e.datum,
        'beginn', to_char(coalesce(e.geplanter_beginn, e.zeitfenster_von), 'HH24:MI'),
        'minuten', e.sollzeit_minuten))
      from public.einsatz e join b on b.id = e.betrieb_id
      where e.datum between p_von and p_bis and e.status not in ('abgesagt', 'erledigt')), '[]'::jsonb)
  )
  from b
  where p_bis >= p_von and p_bis - p_von <= 62;
$$;
revoke all on function public.buchung_kalender(text, date, date) from public;
grant execute on function public.buchung_kalender(text, date, date) to anon, authenticated;

-- Preis wie src/domain/preisrechner.ts (Tests vergleichen beides)
create function public.buchung_preis(p_einstellungen jsonb, p_anzahl jsonb, p_rahmen boolean, p_kleinunternehmer boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_arbeit bigint := 0;
  v_minuten numeric := 0;
  v_fenster int := 0;
  v_pos jsonb;
  v_n int;
  v_rahmen bigint := 0;
  v_anfahrt bigint := coalesce((p_einstellungen ->> 'anfahrtCent')::bigint, 0);
  v_mindest bigint := coalesce((p_einstellungen ->> 'mindestpreisCent')::bigint, 0);
  v_netto bigint := 0;
  v_ust bigint := 0;
begin
  for v_pos in select * from jsonb_array_elements(coalesce(p_einstellungen -> 'positionen', '[]'::jsonb)) loop
    v_n := greatest(0, least(500, floor(coalesce((p_anzahl ->> (v_pos ->> 'id'))::numeric, 0))))::int;
    v_arbeit := v_arbeit + v_n * (v_pos ->> 'preisCent')::bigint;
    v_minuten := v_minuten + v_n * coalesce((v_pos ->> 'minuten')::numeric, 0);
    v_fenster := v_fenster + v_n;
  end loop;
  if v_arbeit > 0 then
    if p_rahmen then
      v_rahmen := round(v_arbeit * coalesce((p_einstellungen ->> 'rahmenProzent')::numeric, 0) / 100);
    end if;
    v_netto := greatest(v_arbeit + v_rahmen + v_anfahrt, v_mindest);
    if not p_kleinunternehmer then
      v_ust := round(v_netto * coalesce((p_einstellungen ->> 'ustSatz')::numeric, 19) / 100);
    end if;
    v_minuten := ceil((v_minuten * case when p_rahmen then 1.3 else 1 end
                       + coalesce((p_einstellungen ->> 'ruestMinuten')::numeric, 0)) / 15) * 15;
  else
    v_minuten := 0;
  end if;
  return jsonb_build_object('netto_cent', v_netto, 'ust_cent', v_ust, 'brutto_cent', v_netto + v_ust,
    'minuten', v_minuten::int, 'fenster', v_fenster);
end;
$$;
grant execute on function public.buchung_preis(jsonb, jsonb, boolean, boolean) to anon, authenticated;

create function public.buchung_anlegen(p_kennung text, p_daten jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.betrieb;
  e jsonb;
  v_preis jsonb;
  v_email text := nullif(lower(trim(p_daten ->> 'email')), '');
  v_name text := trim(coalesce(p_daten ->> 'name', ''));
  v_datum date := (p_daten ->> 'datum')::date;
  v_halbtag text := p_daten ->> 'halbtag';
  v_rahmen boolean := coalesce((p_daten ->> 'rahmen')::boolean, false);
  v_von time;
  v_bis time;
  v_vorlage uuid;
  v_kunde uuid;
  v_objekt uuid;
  v_vertrag uuid;
  v_version uuid;
  v_leistung uuid;
  v_einsatz uuid;
  v_pos jsonb;
  v_n int;
  v_text text := '';
begin
  select * into b from public.betrieb where oeffentlich_kennung = lower(p_kennung) for share;
  e := b.buchung;
  if b.id is null or (e ->> 'aktiv')::boolean is not true then
    raise exception 'Online-Buchung ist nicht möglich' using errcode = 'P0002';
  end if;
  begin
    v_vorlage := (e ->> 'vorlageId')::uuid;
  exception when others then
    v_vorlage := null;
  end;
  if v_vorlage is null or not exists (select 1 from public.auftragsvorlage where id = v_vorlage and betrieb_id = b.id) then
    raise exception 'Online-Buchung ist nicht eingerichtet' using errcode = 'P0001';
  end if;
  if coalesce((p_daten ->> 'datenschutz')::boolean, false) is not true then
    raise exception 'Bitte der Datenschutzerklärung zustimmen' using errcode = '22023';
  end if;
  if length(v_name) < 2 or v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce(p_daten ->> 'plz', '') !~ '^\d{5}$' or length(trim(coalesce(p_daten ->> 'strasse', ''))) < 3
     or length(trim(coalesce(p_daten ->> 'ort', ''))) < 2 then
    raise exception 'Bitte Name, E-Mail und Adresse vollständig angeben' using errcode = '22023';
  end if;
  if v_datum is null or v_datum < current_date + greatest(1, coalesce((e ->> 'vorlaufTage')::int, 1))
     or v_datum > current_date + coalesce((e ->> 'horizontTage')::int, 28) then
    raise exception 'Dieser Termin ist nicht buchbar' using errcode = '22023';
  end if;
  if v_halbtag = 'vormittag' then
    v_von := '08:00'; v_bis := '12:00';
  elsif v_halbtag = 'nachmittag' then
    v_von := '12:00'; v_bis := '17:00';
  else
    raise exception 'Bitte vormittags oder nachmittags wählen' using errcode = '22023';
  end if;
  if (select count(*) from public.anfrage where betrieb_id = b.id and quelle = 'buchung'
      and erstellt_am > now() - interval '1 hour') >= 20
     or (select count(*) from public.anfrage where betrieb_id = b.id and quelle = 'buchung'
      and lower(email) = v_email and erstellt_am > now() - interval '1 day') >= 3 then
    raise exception 'Zu viele Buchungen – bitte rufen Sie uns an' using errcode = '22023';
  end if;

  v_preis := public.buchung_preis(e, coalesce(p_daten -> 'anzahl', '{}'::jsonb), v_rahmen, b.kleinunternehmer);
  if (v_preis ->> 'netto_cent')::bigint <= 0 then
    raise exception 'Bitte mindestens ein Fenster angeben' using errcode = '22023';
  end if;

  -- Kunde (Privat) wiederverwenden, wenn die E-Mail schon bekannt ist
  select id into v_kunde from public.kunde
  where betrieb_id = b.id and lower(email) = v_email and typ = 'privat' order by erstellt_am limit 1;
  if v_kunde is null then
    insert into public.kunde (betrieb_id, typ, name, strasse, plz, ort, email, telefon, notiz)
    values (b.id, 'privat', v_name, trim(p_daten ->> 'strasse'), p_daten ->> 'plz', trim(p_daten ->> 'ort'),
      v_email, nullif(trim(p_daten ->> 'telefon'), ''), 'Online-Buchung')
    returning id into v_kunde;
  end if;
  select id into v_objekt from public.objekt
  where kunde_id = v_kunde and lower(coalesce(strasse, '')) = lower(trim(p_daten ->> 'strasse'))
    and plz = p_daten ->> 'plz' limit 1;
  if v_objekt is null then
    insert into public.objekt (betrieb_id, kunde_id, name, strasse, plz, ort)
    values (b.id, v_kunde, trim(p_daten ->> 'strasse'), trim(p_daten ->> 'strasse'), p_daten ->> 'plz',
      trim(p_daten ->> 'ort'))
    returning id into v_objekt;
    for v_pos in select * from jsonb_array_elements(coalesce(e -> 'positionen', '[]'::jsonb)) loop
      v_n := greatest(0, least(500, floor(coalesce((p_daten -> 'anzahl' ->> (v_pos ->> 'id'))::numeric, 0))))::int;
      if v_n > 0 then
        insert into public.fensteraufmass (betrieb_id, objekt_id, bezeichnung, anzahl, mit_rahmen)
        values (b.id, v_objekt, v_pos ->> 'name', v_n, v_rahmen);
      end if;
    end loop;
  end if;
  for v_pos in select * from jsonb_array_elements(coalesce(e -> 'positionen', '[]'::jsonb)) loop
    v_n := greatest(0, least(500, floor(coalesce((p_daten -> 'anzahl' ->> (v_pos ->> 'id'))::numeric, 0))))::int;
    if v_n > 0 then
      v_text := v_text || v_n || ' × ' || (v_pos ->> 'name') || '; ';
    end if;
  end loop;
  v_text := v_text || case when v_rahmen then 'mit Rahmen' else 'ohne Rahmen' end;

  -- Einzelauftrag: Vertrag (aktiv, ein Tag), Version, Leistung und der eine Einsatz
  insert into public.vertrag (betrieb_id, kunde_id, objekt_id, titel, status, beginn, endet_am, laufzeit_monate,
    verlaengerung_monate, notiz)
  values (b.id, v_kunde, v_objekt, 'Fensterreinigung (Online-Buchung)', 'aktiv', v_datum, v_datum, 0, 0, v_text)
  returning id into v_vertrag;
  insert into public.vertragsversion (betrieb_id, vertrag_id, version, gueltig_ab, abrechnungsart, grund)
  values (b.id, v_vertrag, 1, v_datum, 'einzelauftrag', 'Online-Buchung')
  returning id into v_version;
  insert into public.vertragsleistung (betrieb_id, version_id, vorlage_id, bezeichnung, frequenz, startdatum,
    zeitfenster_von, zeitfenster_bis, menge_fenster, preis_cent)
  values (b.id, v_version, v_vorlage, 'Fensterreinigung lt. Online-Buchung', 'einmalig', v_datum, v_von, v_bis,
    (v_preis ->> 'fenster')::int, (v_preis ->> 'netto_cent')::int)
  returning id into v_leistung;
  insert into public.einsatz (betrieb_id, objekt_id, vorlage_id, vertrag_id, vertragsleistung_id, datum,
    zeitfenster_von, zeitfenster_bis, sollzeit_minuten, quelle, notiz)
  values (b.id, v_objekt, v_vorlage, v_vertrag, v_leistung, v_datum, v_von, v_bis,
    (v_preis ->> 'minuten')::int, 'serie',
    'Online-Buchung: ' || v_text || coalesce(' · ' || nullif(trim(p_daten ->> 'nachricht'), ''), ''))
  returning id into v_einsatz;

  insert into public.anfrage (betrieb_id, quelle, status, kundentyp, name, email, telefon, strasse, plz, ort,
    leistung, nachricht, wunschtermin, datenschutz_am, kunde_id, objekt_id)
  values (b.id, 'buchung', 'gewonnen', 'privat', v_name, v_email, nullif(trim(p_daten ->> 'telefon'), ''),
    trim(p_daten ->> 'strasse'), p_daten ->> 'plz', trim(p_daten ->> 'ort'), 'Fensterreinigung: ' || v_text,
    nullif(trim(p_daten ->> 'nachricht'), ''), to_char(v_datum, 'DD.MM.YYYY') || ' ' || v_halbtag, now(),
    v_kunde, v_objekt);

  return v_preis || jsonb_build_object('vertragsnummer', (select vertragsnummer from public.vertrag where id = v_vertrag),
    'datum', v_datum, 'halbtag', v_halbtag, 'einsatz_id', v_einsatz, 'leistung', v_text);
end;
$$;
revoke all on function public.buchung_anlegen(text, jsonb) from public;
grant execute on function public.buchung_anlegen(text, jsonb) to anon, authenticated;
