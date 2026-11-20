-- M9 Rechnung und E-Rechnung:
-- Rechnungen mit Positionen, lückenlos fortlaufende Nummern je Betrieb und Jahr, Festschreiben
-- (danach unveränderlich, GoBD), Storno als eigene Rechnung (Gutschrift) statt Löschen,
-- Verknüpfung abgerechneter Einsätze/Nachträge/Pauschalen gegen Doppelabrechnung, DATEV-Einstellungen.

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
alter table public.betrieb
  add column rechnung_praefix text not null default 'RE-' check (length(rechnung_praefix) <= 10),
  add column rechnung_kontakt text check (length(rechnung_kontakt) <= 100),
  add column rechnung_fusstext text check (length(rechnung_fusstext) <= 1000),
  add column datev_beraternummer int check (datev_beraternummer between 1000 and 9999999),
  add column datev_mandantennummer int check (datev_mandantennummer between 1 and 99999),
  add column kontenrahmen text not null default 'skr03' check (kontenrahmen in ('skr03', 'skr04'));

-- Format der E-Rechnung je Kunde: ZUGFeRD (PDF mit XML) oder zusätzlich XRechnung (XML)
alter table public.kunde
  add column erechnung text not null default 'zugferd' check (erechnung in ('zugferd', 'xrechnung'));

-- Nummern: vorhandener Nummernkreis (M2, naechste_nummer) mit Art 'rechnung-<Jahr>'

-- ---------------------------------------------------------------------------
-- Rechnungen
-- ---------------------------------------------------------------------------
create type public.rechnungsstatus as enum ('entwurf', 'offen', 'bezahlt', 'storniert');

create table public.rechnung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  kunde_id uuid not null,
  objekt_id uuid,
  art text not null default 'rechnung' check (art in ('rechnung', 'storno')),
  storno_von_id uuid,
  status public.rechnungsstatus not null default 'entwurf',
  -- Monatslauf "JJJJ-MM" (null: Einzelrechnung)
  monat text check (monat is null or monat ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  nummer text,
  laufnummer int,
  rechnungsdatum date,
  faellig_am date,
  leistung_von date not null,
  leistung_bis date not null,
  zahlungsziel_tage int not null default 14 check (zahlungsziel_tage between 0 and 365),
  kleinunternehmer boolean not null default false,
  netto_cent bigint not null default 0,
  ust_cent bigint not null default 0,
  brutto_cent bigint not null default 0,
  -- beim Festschreiben eingefrorene Angaben (Absender, Empfänger, Steuergruppen, Hinweise)
  daten jsonb,
  hinweise text[] not null default '{}',
  -- Hinweise des Monatslaufs (z. B. fehlender Preis), nur intern
  lauf_hinweise text[] not null default '{}',
  pdf_pfad text,
  xml_pfad text,
  festgeschrieben_am timestamptz,
  gesendet_am timestamptz,
  gesendet_an text[] not null default '{}',
  bezahlt_am date,
  datev_exportiert_am timestamptz,
  storno_grund text check (length(storno_grund) <= 500),
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (id, betrieb_id),
  unique (betrieb_id, nummer),
  check (leistung_bis >= leistung_von),
  check (status = 'entwurf' or (nummer is not null and rechnungsdatum is not null and daten is not null)),
  check ((art = 'storno') = (storno_von_id is not null)),
  check (art = 'rechnung' or status <> 'bezahlt'),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete restrict,
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete restrict,
  foreign key (storno_von_id, betrieb_id) references public.rechnung (id, betrieb_id) on delete restrict
);
create index rechnung_betrieb_idx on public.rechnung (betrieb_id, rechnungsdatum desc);
create index rechnung_monat_idx on public.rechnung (betrieb_id, monat);
-- je Rechnung höchstens ein Storno
create unique index rechnung_storno_eindeutig on public.rechnung (storno_von_id) where storno_von_id is not null;

create trigger rechnung_aktualisiert_am before update on public.rechnung
for each row execute function public.setze_aktualisiert_am();

create table public.rechnungsposition (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  rechnung_id uuid not null,
  pos int not null,
  bezeichnung text not null check (length(trim(bezeichnung)) between 1 and 300),
  beschreibung text check (length(beschreibung) <= 1000),
  menge numeric(14, 4) not null check (menge > 0),
  einheit text not null check (einheit in ('pauschal', 'stunde', 'm2', 'fenster', 'stueck', 'einsatz', 'monat')),
  einzelpreis_cent int not null check (einzelpreis_cent >= 0),
  netto_cent int not null check (netto_cent >= 0),
  ust_satz numeric(4, 2) not null check (ust_satz in (0, 7, 19)),
  von date,
  bis date,
  quelle text not null default 'manuell' check (quelle in ('pauschale', 'aufwand', 'nachtrag', 'manuell')),
  vertrag_id uuid,
  version_id uuid,
  einsatz_position_id uuid,
  unique (rechnung_id, pos),
  foreign key (rechnung_id, betrieb_id) references public.rechnung (id, betrieb_id) on delete cascade,
  foreign key (vertrag_id, betrieb_id) references public.vertrag (id, betrieb_id) on delete set null (vertrag_id),
  foreign key (version_id, betrieb_id) references public.vertragsversion (id, betrieb_id) on delete set null (version_id)
);
create index rechnungsposition_rechnung_idx on public.rechnungsposition (rechnung_id);

-- Was abgerechnet ist (gegen Doppelabrechnung). Aktiv, solange die Rechnung nicht storniert ist;
-- Entwürfe zählen mit, damit zwei Läufe nichts doppelt anlegen.
create table public.abrechnung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  rechnung_id uuid not null,
  einsatz_id uuid,
  einsatz_position_id uuid,
  -- Pauschale: Version und Monat
  version_id uuid,
  monat text,
  aktiv boolean not null default true,
  check (num_nonnulls(einsatz_id, einsatz_position_id, version_id) = 1),
  check (version_id is null or monat is not null),
  foreign key (rechnung_id, betrieb_id) references public.rechnung (id, betrieb_id) on delete cascade,
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade,
  foreign key (einsatz_position_id) references public.einsatz_position (id) on delete cascade,
  foreign key (version_id, betrieb_id) references public.vertragsversion (id, betrieb_id) on delete cascade
);
create unique index abrechnung_einsatz_idx on public.abrechnung (einsatz_id) where aktiv and einsatz_id is not null;
create unique index abrechnung_nachtrag_idx on public.abrechnung (einsatz_position_id) where aktiv and einsatz_position_id is not null;
create unique index abrechnung_pauschale_idx on public.abrechnung (version_id, monat) where aktiv and version_id is not null;
create index abrechnung_rechnung_idx on public.abrechnung (rechnung_id);

-- ---------------------------------------------------------------------------
-- Schutz: festgeschriebene Rechnungen sind unveränderlich (nur Zahlung, Versand, Export, Storno)
-- ---------------------------------------------------------------------------
create function public.rechnung_schuetzen()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'entwurf' then
      raise exception 'Festgeschriebene Rechnungen werden nicht gelöscht, sondern storniert' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.status = 'entwurf' then
    return new;
  end if;
  if new.nummer is distinct from old.nummer or new.laufnummer is distinct from old.laufnummer
     or new.rechnungsdatum is distinct from old.rechnungsdatum or new.faellig_am is distinct from old.faellig_am
     or new.kunde_id is distinct from old.kunde_id or new.objekt_id is distinct from old.objekt_id
     or new.netto_cent <> old.netto_cent or new.ust_cent <> old.ust_cent or new.brutto_cent <> old.brutto_cent
     or new.daten is distinct from old.daten or new.hinweise is distinct from old.hinweise
     or new.leistung_von <> old.leistung_von or new.leistung_bis <> old.leistung_bis
     or new.art <> old.art or new.kleinunternehmer <> old.kleinunternehmer
     or new.zahlungsziel_tage <> old.zahlungsziel_tage or new.monat is distinct from old.monat
     or (old.pdf_pfad is not null and new.pdf_pfad is distinct from old.pdf_pfad)
     or (old.xml_pfad is not null and new.xml_pfad is distinct from old.xml_pfad)
     or new.status = 'entwurf'
     or (old.status = 'storniert' and new.status <> 'storniert') then
    raise exception 'Festgeschriebene Rechnung kann nicht geändert werden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger rechnung_schuetzen before update or delete on public.rechnung
for each row execute function public.rechnung_schuetzen();

create function public.rechnungsposition_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.rechnungsstatus;
begin
  select status into v_status from public.rechnung
  where id = coalesce(new.rechnung_id, old.rechnung_id);
  -- Löschen der ganzen Rechnung (Entwurf) kaskadiert; Rechnung existiert dann nicht mehr
  if v_status is not null and v_status <> 'entwurf' then
    raise exception 'Positionen festgeschriebener Rechnungen sind unveränderlich' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger rechnungsposition_schuetzen before insert or update or delete on public.rechnungsposition
for each row execute function public.rechnungsposition_schuetzen();

-- ---------------------------------------------------------------------------
-- Festschreiben: Nummer vergeben (lückenlos), Daten einfrieren
-- ---------------------------------------------------------------------------
create function public.rechnung_festschreiben(p_id uuid, p_datum date, p_daten jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rechnung;
  v_praefix text;
  v_jahr int := extract(year from p_datum)::int;
  v_nr int;
  v_nummer text;
begin
  select * into v_r from public.rechnung where id = p_id for update;
  if v_r.id is null or not public.ist_buero(v_r.betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_r.status <> 'entwurf' then
    return v_r.nummer; -- schon festgeschrieben
  end if;
  if not exists (select 1 from public.rechnungsposition where rechnung_id = p_id) then
    raise exception 'Rechnung ohne Positionen' using errcode = 'P0001';
  end if;
  select rechnung_praefix into v_praefix from public.betrieb where id = v_r.betrieb_id;
  v_nr := public.naechste_nummer(v_r.betrieb_id, 'rechnung-' || v_jahr);
  v_nummer := v_praefix || v_jahr || '-' || lpad(v_nr::text, 4, '0');
  update public.rechnung
  set status = 'offen', nummer = v_nummer, laufnummer = v_nr, rechnungsdatum = p_datum,
      faellig_am = p_datum + zahlungsziel_tage, daten = p_daten, festgeschrieben_am = now()
  where id = p_id;
  return v_nummer;
end;
$$;
revoke all on function public.rechnung_festschreiben(uuid, date, jsonb) from public, anon;
grant execute on function public.rechnung_festschreiben(uuid, date, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storno: Gutschrift mit denselben Positionen anlegen; Abgerechnetes wird wieder frei
-- ---------------------------------------------------------------------------
create function public.rechnung_stornieren(p_id uuid, p_grund text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.rechnung;
  v_neu uuid := gen_random_uuid();
begin
  select * into v_r from public.rechnung where id = p_id for update;
  if v_r.id is null or not public.ist_buero(v_r.betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_r.art <> 'rechnung' or v_r.status not in ('offen', 'bezahlt') then
    raise exception 'Nur festgeschriebene Rechnungen können storniert werden' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_grund, ''))) < 3 then
    raise exception 'Grund angeben' using errcode = '22023';
  end if;
  insert into public.rechnung (id, betrieb_id, kunde_id, objekt_id, art, storno_von_id, monat,
    leistung_von, leistung_bis, zahlungsziel_tage, kleinunternehmer, netto_cent, ust_cent, brutto_cent,
    hinweise, storno_grund)
  values (v_neu, v_r.betrieb_id, v_r.kunde_id, v_r.objekt_id, 'storno', v_r.id, v_r.monat,
    v_r.leistung_von, v_r.leistung_bis, 0, v_r.kleinunternehmer, v_r.netto_cent, v_r.ust_cent, v_r.brutto_cent,
    v_r.hinweise, trim(p_grund));
  insert into public.rechnungsposition (betrieb_id, rechnung_id, pos, bezeichnung, beschreibung, menge,
    einheit, einzelpreis_cent, netto_cent, ust_satz, von, bis, quelle, vertrag_id, version_id, einsatz_position_id)
  select betrieb_id, v_neu, pos, bezeichnung, beschreibung, menge, einheit, einzelpreis_cent, netto_cent,
    ust_satz, von, bis, quelle, vertrag_id, version_id, einsatz_position_id
  from public.rechnungsposition where rechnung_id = p_id;
  update public.abrechnung set aktiv = false where rechnung_id = p_id;
  update public.rechnung set status = 'storniert', storno_grund = trim(p_grund) where id = p_id;
  return v_neu;
end;
$$;
revoke all on function public.rechnung_stornieren(uuid, text) from public, anon;
grant execute on function public.rechnung_stornieren(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: nur das Büro
-- ---------------------------------------------------------------------------
alter table public.rechnung enable row level security;
create policy rechnung_lesen on public.rechnung for select to authenticated using (public.ist_buero(betrieb_id));
create policy rechnung_anlegen on public.rechnung for insert to authenticated
  with check (public.ist_buero(betrieb_id) and status = 'entwurf' and art = 'rechnung');
create policy rechnung_aendern on public.rechnung for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy rechnung_loeschen on public.rechnung for delete to authenticated
  using (public.ist_buero(betrieb_id) and status = 'entwurf' and art = 'rechnung');

alter table public.rechnungsposition enable row level security;
create policy rechnungsposition_lesen on public.rechnungsposition for select to authenticated
  using (public.ist_buero(betrieb_id));
create policy rechnungsposition_anlegen on public.rechnungsposition for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy rechnungsposition_aendern on public.rechnungsposition for update to authenticated
  using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id));
create policy rechnungsposition_loeschen on public.rechnungsposition for delete to authenticated
  using (public.ist_buero(betrieb_id));

alter table public.abrechnung enable row level security;
create policy abrechnung_lesen on public.abrechnung for select to authenticated using (public.ist_buero(betrieb_id));
create policy abrechnung_anlegen on public.abrechnung for insert to authenticated
  with check (public.ist_buero(betrieb_id));
create policy abrechnung_loeschen on public.abrechnung for delete to authenticated
  using (public.ist_buero(betrieb_id) and exists (
    select 1 from public.rechnung r where r.id = rechnung_id and r.status = 'entwurf'));

-- Ablage: PDF (ZUGFeRD) und XRechnung; nur anlegen, nie überschreiben oder löschen (GoBD)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rechnungen', 'rechnungen', false, 20971520, array['application/pdf', 'application/xml'])
on conflict (id) do nothing;

create policy rechnungen_lesen on storage.objects for select to authenticated
  using (bucket_id = 'rechnungen' and public.ist_buero(((storage.foldername(name))[1])::uuid));
create policy rechnungen_anlegen on storage.objects for insert to authenticated
  with check (bucket_id = 'rechnungen' and public.ist_buero(((storage.foldername(name))[1])::uuid));

-- Mail-Protokoll: auch Rechnungen; das Büro protokolliert eigene Versände
alter table public.mail_protokoll drop constraint mail_protokoll_art_check;
alter table public.mail_protokoll add constraint mail_protokoll_art_check
  check (art in ('nachweis', 'bestaetigung', 'rechnung'));
create policy mail_protokoll_anlegen on public.mail_protokoll for insert to authenticated
  with check (public.ist_buero(betrieb_id));
