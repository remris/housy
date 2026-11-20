-- M6 Mitarbeiter-App:
-- Zeitbuchungen (Check-in/-out, Pausen) mit Korrekturprotokoll, Checkliste je Einsatz, Fotos,
-- Meldungen (Mängel, Material leer), Vor-Ort-Positionen, Notizen und Stammdaten-Verlauf.
-- Mitarbeiter schreiben ausschließlich über die app_*-Funktionen (prüfen die Zuweisung,
-- sind idempotent über die vom Gerät vergebene ID und setzen „letzte Änderung gewinnt“ um).

-- ---------------------------------------------------------------------------
-- Einsatz: Notiz des Mitarbeiters
-- ---------------------------------------------------------------------------
alter table public.einsatz
  add column notiz_mitarbeiter text check (length(notiz_mitarbeiter) <= 4000),
  add column notiz_mitarbeiter_am timestamptz;

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: Einsatz gehört dem angemeldeten Mitarbeiter → betrieb_id, sonst Fehler
-- ---------------------------------------------------------------------------
create function public.app_mein_einsatz(p_einsatz_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid;
begin
  select e.betrieb_id into v_betrieb
  from public.einsatz e
  where e.id = p_einsatz_id
    and e.mitarbeiter_id is not null
    and e.mitarbeiter_id = public.mein_mitglied_id(e.betrieb_id);
  if v_betrieb is null then
    raise exception 'Einsatz nicht zugewiesen' using errcode = '42501';
  end if;
  return v_betrieb;
end;
$$;
revoke all on function public.app_mein_einsatz(uuid) from public, anon;
grant execute on function public.app_mein_einsatz(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Zeitbuchungen
-- ---------------------------------------------------------------------------
create type public.zeitbuchungsart as enum ('checkin', 'checkout', 'pause_beginn', 'pause_ende');

create table public.zeitbuchung (
  -- ID vergibt das Gerät, damit Wiederholungen beim Synchronisieren nichts doppelt anlegen
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  mitglied_id uuid not null,
  einsatz_id uuid,
  art public.zeitbuchungsart not null,
  zeitpunkt timestamptz not null,
  quelle text not null default 'app' check (quelle in ('qr', 'app', 'buero')),
  storniert_am timestamptz,
  erstellt_am timestamptz not null default now(),
  check (art in ('pause_beginn', 'pause_ende') or einsatz_id is not null),
  foreign key (mitglied_id, betrieb_id) references public.mitglied (id, betrieb_id) on delete cascade,
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete no action
);
create index zeitbuchung_mitglied_zeit_idx on public.zeitbuchung (mitglied_id, zeitpunkt);
create index zeitbuchung_betrieb_zeit_idx on public.zeitbuchung (betrieb_id, zeitpunkt);

create table public.zeitbuchung_protokoll (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  zeitbuchung_id uuid not null references public.zeitbuchung (id) on delete cascade,
  aktion text not null check (aktion in ('nachgetragen', 'geaendert', 'storniert')),
  alt timestamptz,
  neu timestamptz,
  grund text not null check (length(trim(grund)) between 3 and 500),
  geaendert_von uuid not null default auth.uid(),
  geaendert_am timestamptz not null default now()
);
create index zeitbuchung_protokoll_buchung_idx on public.zeitbuchung_protokoll (zeitbuchung_id);

-- ---------------------------------------------------------------------------
-- Checkliste je Einsatz (Haken zu den Tätigkeiten der Vorlage)
-- ---------------------------------------------------------------------------
create table public.einsatz_aufgabe (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  einsatz_id uuid not null,
  taetigkeit_id uuid not null references public.vorlage_taetigkeit (id) on delete cascade,
  erledigt boolean not null default false,
  geaendert_am timestamptz not null,
  geaendert_von uuid,
  unique (einsatz_id, taetigkeit_id),
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Meldungen: Mängel und „Material leer“
-- ---------------------------------------------------------------------------
create type public.meldungsart as enum ('mangel', 'material_leer');

create table public.einsatz_meldung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  einsatz_id uuid not null,
  objekt_id uuid not null,
  art public.meldungsart not null,
  text text check (length(text) <= 2000),
  artikel_id uuid,
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  erledigt_am timestamptz,
  erledigt_von uuid,
  unique (id, betrieb_id),
  check (art <> 'material_leer' or artikel_id is not null),
  check (art <> 'mangel' or length(trim(coalesce(text, ''))) > 0),
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade,
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade,
  foreign key (artikel_id, betrieb_id) references public.artikel (id, betrieb_id) on delete set null (artikel_id)
);
create index einsatz_meldung_offen_idx on public.einsatz_meldung (betrieb_id) where erledigt_am is null;

-- ---------------------------------------------------------------------------
-- Fotos zum Einsatz (Nachweis oder zu einem Mangel)
-- ---------------------------------------------------------------------------
create table public.einsatz_foto (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  einsatz_id uuid not null,
  meldung_id uuid,
  pfad text not null unique,
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade,
  foreign key (meldung_id, betrieb_id) references public.einsatz_meldung (id, betrieb_id) on delete set null (meldung_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('einsatzfotos', 'einsatzfotos', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Pfad: <betrieb_id>/<einsatz_id>/<datei>
create function public.darf_einsatzfoto(p_name text, p_schreiben boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_teile text[] := storage.foldername(p_name);
  v_betrieb uuid;
  v_einsatz uuid;
begin
  begin
    v_betrieb := v_teile[1]::uuid;
    v_einsatz := v_teile[2]::uuid;
  exception when others then
    return false;
  end;
  if public.ist_buero(v_betrieb) then
    return true;
  end if;
  return exists (
    select 1 from public.einsatz e
    where e.id = v_einsatz and e.betrieb_id = v_betrieb
      and e.mitarbeiter_id = public.mein_mitglied_id(v_betrieb)
  );
end;
$$;
revoke all on function public.darf_einsatzfoto(text, boolean) from public, anon;
grant execute on function public.darf_einsatzfoto(text, boolean) to authenticated;

create policy einsatzfotos_lesen on storage.objects
  for select to authenticated
  using (bucket_id = 'einsatzfotos' and public.darf_einsatzfoto(name, false));
create policy einsatzfotos_hochladen on storage.objects
  for insert to authenticated
  with check (bucket_id = 'einsatzfotos' and public.darf_einsatzfoto(name, true));
create policy einsatzfotos_loeschen on storage.objects
  for delete to authenticated
  using (bucket_id = 'einsatzfotos' and public.ist_buero(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Vor-Ort-Positionen (Zusatzleistungen)
-- ---------------------------------------------------------------------------
create type public.positionsstatus as enum ('vorgeschlagen', 'bestaetigt', 'abgelehnt');

create table public.einsatz_position (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  einsatz_id uuid not null,
  preis_id uuid,
  bezeichnung text not null check (length(trim(bezeichnung)) between 1 and 300),
  menge numeric(12, 3) not null default 1 check (menge > 0),
  einheit public.preiseinheit,
  -- Einzelpreis netto in Cent; bei freien Positionen erst nach Prüfung im Büro
  preis_cent int check (preis_cent is null or preis_cent >= 0),
  ust_satz numeric(4, 2) check (ust_satz is null or ust_satz in (0, 7, 19)),
  dauer text not null default 'heute' check (dauer in ('heute', 'dauerhaft')),
  status public.positionsstatus not null default 'vorgeschlagen',
  -- Zustimmung des Kunden: Unterschrift auf dem Handy oder mündlich (Bestätigungs-Mail)
  zustimmung text not null default 'muendlich' check (zustimmung in ('unterschrift', 'muendlich')),
  unterschrift_name text,
  unterschrift_bild text check (length(unterschrift_bild) <= 300000),
  bestaetigung_gesendet_am timestamptz,
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  geprueft_von uuid,
  geprueft_am timestamptz,
  -- „dauerhaft“: Büro übernimmt in eine neue Vertragsversion
  vertrag_uebernommen_am timestamptz,
  notiz_buero text check (length(notiz_buero) <= 1000),
  check (status <> 'bestaetigt' or preis_cent is not null),
  check (zustimmung <> 'unterschrift' or (unterschrift_bild is not null and unterschrift_name is not null)),
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade,
  foreign key (preis_id, betrieb_id) references public.preisliste (id, betrieb_id) on delete set null (preis_id)
);
create index einsatz_position_einsatz_idx on public.einsatz_position (einsatz_id);
create index einsatz_position_offen_idx on public.einsatz_position (betrieb_id)
  where status = 'vorgeschlagen' or (dauer = 'dauerhaft' and vertrag_uebernommen_am is null and status = 'bestaetigt');

-- ---------------------------------------------------------------------------
-- Verlauf von Stammdaten-Korrekturen aus der App
-- ---------------------------------------------------------------------------
create table public.stammdaten_verlauf (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  objekt_id uuid not null,
  einsatz_id uuid,
  feld text not null,
  alt text,
  neu text,
  geaendert_von uuid,
  geaendert_am timestamptz not null default now(),
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade,
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete set null (einsatz_id)
);
create index stammdaten_verlauf_objekt_idx on public.stammdaten_verlauf (objekt_id, geaendert_am desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create function public.sieht_einsatz(p_einsatz_id uuid, p_betrieb_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.ist_buero(p_betrieb_id) or exists (
    select 1 from public.einsatz e
    where e.id = p_einsatz_id and e.betrieb_id = p_betrieb_id
      and e.mitarbeiter_id = public.mein_mitglied_id(p_betrieb_id)
  );
$$;
revoke all on function public.sieht_einsatz(uuid, uuid) from public, anon;
grant execute on function public.sieht_einsatz(uuid, uuid) to authenticated;

do $$
declare
  t text;
begin
  -- lesen: Büro oder der zugewiesene Mitarbeiter; schreiben: Büro (Mitarbeiter über app_*)
  foreach t in array array['einsatz_aufgabe', 'einsatz_meldung', 'einsatz_foto', 'einsatz_position'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_lesen on public.%1$I for select to authenticated using (public.sieht_einsatz(einsatz_id, betrieb_id))', t);
    execute format('create policy %1$s_anlegen on public.%1$I for insert to authenticated with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_aendern on public.%1$I for update to authenticated using (public.ist_buero(betrieb_id)) with check (public.ist_buero(betrieb_id))', t);
    execute format('create policy %1$s_loeschen on public.%1$I for delete to authenticated using (public.ist_buero(betrieb_id))', t);
  end loop;
end;
$$;

-- Zeitbuchungen: lesen Büro oder eigene; schreiben nur über Funktionen (Protokoll)
alter table public.zeitbuchung enable row level security;
create policy zeitbuchung_lesen on public.zeitbuchung for select to authenticated
  using (public.ist_buero(betrieb_id) or mitglied_id = public.mein_mitglied_id(betrieb_id));

alter table public.zeitbuchung_protokoll enable row level security;
create policy zeitbuchung_protokoll_lesen on public.zeitbuchung_protokoll for select to authenticated
  using (
    public.ist_buero(betrieb_id) or exists (
      select 1 from public.zeitbuchung z
      where z.id = zeitbuchung_id and z.mitglied_id = public.mein_mitglied_id(z.betrieb_id)
    )
  );

alter table public.stammdaten_verlauf enable row level security;
create policy stammdaten_verlauf_lesen on public.stammdaten_verlauf for select to authenticated
  using (public.ist_buero(betrieb_id));

-- ---------------------------------------------------------------------------
-- App-Funktionen (Mitarbeiter)
-- ---------------------------------------------------------------------------

-- Zeit buchen. Pausen ohne Einsatz brauchen p_betrieb_id.
create function public.app_zeit_buchen(
  p_id uuid,
  p_art public.zeitbuchungsart,
  p_zeitpunkt timestamptz,
  p_einsatz_id uuid default null,
  p_betrieb_id uuid default null,
  p_quelle text default 'app'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid;
  v_mitglied uuid;
begin
  if p_einsatz_id is not null then
    v_betrieb := public.app_mein_einsatz(p_einsatz_id);
  else
    v_betrieb := p_betrieb_id;
  end if;
  v_mitglied := public.mein_mitglied_id(v_betrieb);
  if v_mitglied is null then
    raise exception 'Kein Mitglied dieses Betriebs' using errcode = '42501';
  end if;
  if p_quelle not in ('qr', 'app') then
    raise exception 'Ungültige Quelle' using errcode = '22023';
  end if;
  if p_zeitpunkt > now() + interval '10 minutes' then
    raise exception 'Zeitpunkt liegt in der Zukunft' using errcode = '22023';
  end if;

  insert into public.zeitbuchung (id, betrieb_id, mitglied_id, einsatz_id, art, zeitpunkt, quelle)
  values (p_id, v_betrieb, v_mitglied, p_einsatz_id, p_art, p_zeitpunkt, p_quelle)
  on conflict (id) do nothing;
  if not found then
    return; -- schon verarbeitet
  end if;

  if p_art = 'checkin' then
    update public.einsatz set status = 'begonnen'
    where id = p_einsatz_id and status in ('geplant', 'zugewiesen', 'unterwegs');
  elsif p_art = 'checkout' then
    update public.einsatz set status = 'erledigt'
    where id = p_einsatz_id and status in ('zugewiesen', 'unterwegs', 'begonnen');
  end if;
end;
$$;

-- Haken in der Checkliste; ältere Änderungen verlieren gegen neuere
create function public.app_aufgabe_setzen(
  p_einsatz_id uuid,
  p_taetigkeit_id uuid,
  p_erledigt boolean,
  p_zeit timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
begin
  if not exists (
    select 1 from public.vorlage_taetigkeit t
    join public.einsatz e on e.vorlage_id = t.vorlage_id
    where t.id = p_taetigkeit_id and e.id = p_einsatz_id
  ) then
    raise exception 'Tätigkeit gehört nicht zum Einsatz' using errcode = '22023';
  end if;
  insert into public.einsatz_aufgabe (betrieb_id, einsatz_id, taetigkeit_id, erledigt, geaendert_am, geaendert_von)
  values (v_betrieb, p_einsatz_id, p_taetigkeit_id, p_erledigt, p_zeit, auth.uid())
  on conflict (einsatz_id, taetigkeit_id) do update
    set erledigt = excluded.erledigt, geaendert_am = excluded.geaendert_am, geaendert_von = excluded.geaendert_von
    where public.einsatz_aufgabe.geaendert_am < excluded.geaendert_am;
end;
$$;

-- Notiz zum Einsatz; letzte Änderung gewinnt
create function public.app_notiz_setzen(p_einsatz_id uuid, p_text text, p_zeit timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.app_mein_einsatz(p_einsatz_id);
  update public.einsatz
  set notiz_mitarbeiter = nullif(trim(p_text), ''), notiz_mitarbeiter_am = p_zeit
  where id = p_einsatz_id
    and (notiz_mitarbeiter_am is null or notiz_mitarbeiter_am < p_zeit);
end;
$$;

-- Mangel oder „Material leer“ melden
create function public.app_meldung(
  p_id uuid,
  p_einsatz_id uuid,
  p_art public.meldungsart,
  p_text text default null,
  p_artikel_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
begin
  insert into public.einsatz_meldung (id, betrieb_id, einsatz_id, objekt_id, art, text, artikel_id, erstellt_von)
  select p_id, v_betrieb, e.id, e.objekt_id, p_art, nullif(trim(p_text), ''), p_artikel_id, auth.uid()
  from public.einsatz e where e.id = p_einsatz_id
  on conflict (id) do nothing;
end;
$$;

-- Foto registrieren (Datei liegt schon im Bucket einsatzfotos)
create function public.app_foto(
  p_id uuid,
  p_einsatz_id uuid,
  p_pfad text,
  p_meldung_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
begin
  if p_pfad not like v_betrieb::text || '/' || p_einsatz_id::text || '/%' then
    raise exception 'Ungültiger Pfad' using errcode = '22023';
  end if;
  insert into public.einsatz_foto (id, betrieb_id, einsatz_id, meldung_id, pfad, erstellt_von)
  values (p_id, v_betrieb, p_einsatz_id, p_meldung_id, p_pfad, auth.uid())
  on conflict (id) do nothing;
end;
$$;

-- Zusatzleistung vor Ort. Mit Preisliste: Preis aus der Liste, sofort bestätigt.
-- Ohne Preisliste (frei): Vorschlag ohne Preis, das Büro prüft.
create function public.app_position(
  p_id uuid,
  p_einsatz_id uuid,
  p_preis_id uuid,
  p_bezeichnung text,
  p_menge numeric,
  p_dauer text,
  p_zustimmung text,
  p_unterschrift_name text default null,
  p_unterschrift_bild text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
  v_preis public.preisliste;
begin
  if p_preis_id is not null then
    select * into v_preis from public.preisliste
    where id = p_preis_id and betrieb_id = v_betrieb and aktiv;
    if v_preis.id is null then
      raise exception 'Leistung nicht in der Preisliste' using errcode = '22023';
    end if;
  end if;
  insert into public.einsatz_position (
    id, betrieb_id, einsatz_id, preis_id, bezeichnung, menge, einheit, preis_cent, ust_satz,
    dauer, status, zustimmung, unterschrift_name, unterschrift_bild, erstellt_von
  ) values (
    p_id, v_betrieb, p_einsatz_id, v_preis.id,
    coalesce(v_preis.name, trim(p_bezeichnung)), p_menge, v_preis.einheit, v_preis.preis_cent, v_preis.ust_satz,
    p_dauer, case when v_preis.id is null then 'vorgeschlagen' else 'bestaetigt' end::public.positionsstatus,
    p_zustimmung, nullif(trim(p_unterschrift_name), ''), p_unterschrift_bild, auth.uid()
  )
  on conflict (id) do nothing;
end;
$$;

-- Stammdaten korrigieren: Zugangshinweise oder Fensteranzahl. Wird im Verlauf protokolliert.
create function public.app_objekt_korrigieren(
  p_id uuid,
  p_einsatz_id uuid,
  p_feld text,
  p_wert text,
  p_fenster_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
  v_objekt uuid;
  v_alt text;
begin
  if exists (select 1 from public.stammdaten_verlauf where id = p_id) then
    return; -- schon verarbeitet
  end if;
  select objekt_id into v_objekt from public.einsatz where id = p_einsatz_id;
  if p_feld = 'zugangshinweise' then
    select zugangshinweise into v_alt from public.objekt where id = v_objekt;
    update public.objekt set zugangshinweise = nullif(trim(p_wert), '') where id = v_objekt;
  elsif p_feld = 'fenster_anzahl' then
    if p_wert !~ '^[1-9][0-9]{0,4}$' then
      raise exception 'Anzahl ungültig' using errcode = '22023';
    end if;
    select anzahl::text into v_alt from public.fensteraufmass
    where id = p_fenster_id and objekt_id = v_objekt;
    if v_alt is null then
      raise exception 'Fensterposition gehört nicht zum Objekt' using errcode = '22023';
    end if;
    update public.fensteraufmass set anzahl = p_wert::int where id = p_fenster_id;
  else
    raise exception 'Feld nicht änderbar' using errcode = '22023';
  end if;
  insert into public.stammdaten_verlauf (id, betrieb_id, objekt_id, einsatz_id, feld, alt, neu, geaendert_von)
  values (
    p_id, v_betrieb, v_objekt, p_einsatz_id,
    case when p_feld = 'fenster_anzahl' then 'fenster_anzahl:' || p_fenster_id::text else p_feld end,
    v_alt, p_wert, auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Büro-Funktionen: Zeitkorrektur nur mit Grund und Protokoll
-- ---------------------------------------------------------------------------
create function public.zeitbuchung_korrigieren(p_id uuid, p_zeitpunkt timestamptz, p_grund text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.zeitbuchung;
begin
  select * into v from public.zeitbuchung where id = p_id;
  if v.id is null or not public.ist_buero(v.betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  update public.zeitbuchung set zeitpunkt = p_zeitpunkt where id = p_id;
  insert into public.zeitbuchung_protokoll (betrieb_id, zeitbuchung_id, aktion, alt, neu, grund)
  values (v.betrieb_id, p_id, 'geaendert', v.zeitpunkt, p_zeitpunkt, p_grund);
end;
$$;

create function public.zeitbuchung_stornieren(p_id uuid, p_grund text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.zeitbuchung;
begin
  select * into v from public.zeitbuchung where id = p_id;
  if v.id is null or not public.ist_buero(v.betrieb_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  update public.zeitbuchung set storniert_am = now() where id = p_id and storniert_am is null;
  insert into public.zeitbuchung_protokoll (betrieb_id, zeitbuchung_id, aktion, alt, neu, grund)
  values (v.betrieb_id, p_id, 'storniert', v.zeitpunkt, null, p_grund);
end;
$$;

create function public.zeitbuchung_nachtragen(
  p_mitglied_id uuid,
  p_art public.zeitbuchungsart,
  p_zeitpunkt timestamptz,
  p_grund text,
  p_einsatz_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid;
  v_id uuid;
begin
  select betrieb_id into v_betrieb from public.mitglied where id = p_mitglied_id;
  if v_betrieb is null or not public.ist_buero(v_betrieb) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into public.zeitbuchung (betrieb_id, mitglied_id, einsatz_id, art, zeitpunkt, quelle)
  values (v_betrieb, p_mitglied_id, p_einsatz_id, p_art, p_zeitpunkt, 'buero')
  returning id into v_id;
  insert into public.zeitbuchung_protokoll (betrieb_id, zeitbuchung_id, aktion, alt, neu, grund)
  values (v_betrieb, v_id, 'nachgetragen', null, p_zeitpunkt, p_grund);
  return v_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'app_zeit_buchen(uuid, public.zeitbuchungsart, timestamptz, uuid, uuid, text)',
    'app_aufgabe_setzen(uuid, uuid, boolean, timestamptz)',
    'app_notiz_setzen(uuid, text, timestamptz)',
    'app_meldung(uuid, uuid, public.meldungsart, text, uuid)',
    'app_foto(uuid, uuid, text, uuid)',
    'app_position(uuid, uuid, uuid, text, numeric, text, text, text, text)',
    'app_objekt_korrigieren(uuid, uuid, text, text, uuid)',
    'zeitbuchung_korrigieren(uuid, timestamptz, text)',
    'zeitbuchung_stornieren(uuid, text)',
    'zeitbuchung_nachtragen(uuid, public.zeitbuchungsart, timestamptz, text, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
