-- M7 Leistungsnachweis und Zeiten:
-- Nachweis-Einstellungen je Kunde, Nachweise (PDF im Storage) mit Versandstatus, Mail-Protokoll,
-- Abnahme-Unterschrift am Einsatz, Mängelstatus.
-- Erzeugt und verschickt werden Nachweise serverseitig (Admin-Client): nach dem Auschecken aus der
-- App und als täglicher Nachlauf-Job.

-- ---------------------------------------------------------------------------
-- Einstellungen
-- ---------------------------------------------------------------------------
create type public.nachweisversand as enum ('einsatz', 'monat', 'keiner');

alter table public.kunde
  add column nachweis_versand public.nachweisversand not null default 'einsatz',
  -- abweichende Adresse für Nachweise (sonst kunde.email)
  add column nachweis_email text check (nachweis_email is null or nachweis_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.betrieb
  -- Kopie jedes Nachweises an die Firmen-E-Mail
  add column nachweis_kopie boolean not null default true,
  -- Fotos im Nachweis je Einsatz (Monatsnachweise enthalten nur die Anzahl)
  add column nachweis_fotos boolean not null default true;

-- ---------------------------------------------------------------------------
-- Abnahme durch den Kunden (optional, in der App vor dem Auschecken)
-- ---------------------------------------------------------------------------
alter table public.einsatz
  add column abnahme_name text check (length(abnahme_name) <= 200),
  add column abnahme_bild text check (length(abnahme_bild) <= 300000),
  add column abnahme_am timestamptz,
  add constraint einsatz_abnahme_vollstaendig
    check ((abnahme_am is null) = (abnahme_bild is null) and (abnahme_am is null) = (abnahme_name is null));

create function public.app_abnahme(p_einsatz_id uuid, p_name text, p_bild text, p_zeit timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_betrieb uuid := public.app_mein_einsatz(p_einsatz_id);
begin
  if length(trim(coalesce(p_name, ''))) = 0 or coalesce(p_bild, '') not like 'data:image/%' then
    raise exception 'Name und Unterschrift fehlen' using errcode = '22023';
  end if;
  if p_zeit > now() + interval '10 minutes' then
    raise exception 'Zeitpunkt liegt in der Zukunft' using errcode = '22023';
  end if;
  -- letzte Unterschrift gewinnt
  update public.einsatz
  set abnahme_name = trim(p_name), abnahme_bild = p_bild, abnahme_am = p_zeit
  where id = p_einsatz_id and betrieb_id = v_betrieb
    and (abnahme_am is null or abnahme_am < p_zeit);
end;
$$;
revoke all on function public.app_abnahme(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.app_abnahme(uuid, text, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Mängelstatus
-- ---------------------------------------------------------------------------
create type public.mangelstatus as enum ('offen', 'in_bearbeitung', 'erledigt');

alter table public.einsatz_meldung
  add column status public.mangelstatus not null default 'offen',
  add column notiz_buero text check (length(notiz_buero) <= 1000),
  add column status_geaendert_am timestamptz;

update public.einsatz_meldung set status = 'erledigt' where erledigt_am is not null;

-- erledigt_am folgt dem Status (und umgekehrt für ältere Aufrufer)
create function public.meldung_status_abgleichen()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_geaendert_am := now();
    if new.status = 'erledigt' then
      new.erledigt_am := coalesce(new.erledigt_am, now());
      new.erledigt_von := coalesce(new.erledigt_von, auth.uid());
    else
      new.erledigt_am := null;
      new.erledigt_von := null;
    end if;
  elsif new.erledigt_am is distinct from old.erledigt_am then
    new.status := case when new.erledigt_am is null then 'offen' else 'erledigt' end;
    new.status_geaendert_am := now();
  end if;
  return new;
end;
$$;
create trigger einsatz_meldung_status before update on public.einsatz_meldung
for each row execute function public.meldung_status_abgleichen();

create index einsatz_meldung_objekt_idx on public.einsatz_meldung (objekt_id, erstellt_am desc);

-- ---------------------------------------------------------------------------
-- Nachweise
-- ---------------------------------------------------------------------------
create type public.nachweisstatus as enum ('in_arbeit', 'gesendet', 'ohne_versand', 'fehler');

create table public.nachweis (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  art text not null check (art in ('einsatz', 'monat')),
  kunde_id uuid not null,
  objekt_id uuid not null,
  einsatz_id uuid,
  -- Monatsnachweis: erster und letzter Tag des Monats; Einsatznachweis: Einsatzdatum
  von date not null,
  bis date not null,
  pdf_pfad text,
  status public.nachweisstatus not null default 'in_arbeit',
  empfaenger text[] not null default '{}',
  versuche int not null default 0,
  -- Beginn des letzten Erzeugungsversuchs (Sperre gegen doppelte Bearbeitung)
  bearbeitet_am timestamptz,
  fehler text,
  erzeugt_am timestamptz,
  gesendet_am timestamptz,
  erstellt_am timestamptz not null default now(),
  check (bis >= von),
  check ((art = 'einsatz') = (einsatz_id is not null)),
  foreign key (kunde_id, betrieb_id) references public.kunde (id, betrieb_id) on delete cascade,
  foreign key (objekt_id, betrieb_id) references public.objekt (id, betrieb_id) on delete cascade,
  foreign key (einsatz_id, betrieb_id) references public.einsatz (id, betrieb_id) on delete cascade
);
-- je Einsatz bzw. je Objekt und Monat genau ein Nachweis (Wiederholungen sind harmlos)
create unique index nachweis_einsatz_eindeutig on public.nachweis (einsatz_id) where art = 'einsatz';
create unique index nachweis_monat_eindeutig on public.nachweis (objekt_id, von) where art = 'monat';
create index nachweis_betrieb_idx on public.nachweis (betrieb_id, von desc);

alter table public.nachweis enable row level security;
create policy nachweis_lesen on public.nachweis for select to authenticated
  using (public.ist_buero(betrieb_id));
-- Anlegen/Ändern nur serverseitig (Admin-Client); das Büro stößt es über Server Actions an.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nachweise', 'nachweise', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy nachweise_lesen on storage.objects
  for select to authenticated
  using (bucket_id = 'nachweise' and public.ist_buero(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Mail-Protokoll (Nachweise, Bestätigungen)
-- ---------------------------------------------------------------------------
create table public.mail_protokoll (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  art text not null check (art in ('nachweis', 'bestaetigung')),
  bezug_id uuid not null,
  empfaenger text[] not null,
  betreff text not null,
  anbieter_id text,
  fehler text,
  gesendet_am timestamptz not null default now()
);
create index mail_protokoll_betrieb_idx on public.mail_protokoll (betrieb_id, gesendet_am desc);
create index mail_protokoll_bezug_idx on public.mail_protokoll (bezug_id);

alter table public.mail_protokoll enable row level security;
create policy mail_protokoll_lesen on public.mail_protokoll for select to authenticated
  using (public.ist_buero(betrieb_id));
