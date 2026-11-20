-- M1: Betriebe (Mandanten), Mitglieder mit Rollen, Einladungen, RLS-Grundmuster.
--
-- Grundregel: Jede Fachtabelle hat `betrieb_id` und eine RLS-Policy über
-- `public.ist_mitglied(betrieb_id)`. Die Hilfsfunktionen sind SECURITY DEFINER,
-- damit Policies auf `mitglied` nicht rekursiv werden.

-- ---------------------------------------------------------------------------
-- Typen
-- ---------------------------------------------------------------------------
create type public.rolle as enum ('inhaber', 'disponent', 'mitarbeiter');

-- ---------------------------------------------------------------------------
-- Allgemeine Trigger-Funktion für aktualisiert_am
-- ---------------------------------------------------------------------------
create function public.setze_aktualisiert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Betrieb
-- ---------------------------------------------------------------------------
create table public.betrieb (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  branchen text[] not null default '{}'
    check (branchen <@ array['gebaeudereinigung', 'hausmeister', 'fensterreinigung']::text[]),
  -- Firmendaten (Rechnungskopf)
  firmenname text,
  strasse text,
  plz text,
  ort text,
  land text not null default 'DE',
  telefon text,
  email text,
  website text,
  -- Steuer
  steuernummer text,
  ust_id text,
  kleinunternehmer boolean not null default false,
  -- Bankverbindung für Rechnungen
  kontoinhaber text,
  iban text,
  bic text,
  bank_name text,
  -- Logo im Storage-Bucket "logos" unter <betrieb_id>/...
  logo_pfad text,
  tarif text not null default 'test' check (tarif in ('test', 'solo', 'team', 'betrieb')),
  test_endet_am date default (current_date + 30),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create trigger betrieb_aktualisiert_am
before update on public.betrieb
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Mitglied (Benutzer im Betrieb mit Rolle)
-- ---------------------------------------------------------------------------
create table public.mitglied (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rolle public.rolle not null default 'mitarbeiter',
  sprache text not null default 'de' check (sprache in ('de', 'en', 'tr', 'pl', 'ro', 'ar')),
  anzeigename text,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  unique (betrieb_id, user_id)
);

create index mitglied_user_id_idx on public.mitglied (user_id);

create trigger mitglied_aktualisiert_am
before update on public.mitglied
for each row execute function public.setze_aktualisiert_am();

-- ---------------------------------------------------------------------------
-- Einladung
-- ---------------------------------------------------------------------------
create table public.einladung (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betrieb (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  rolle public.rolle not null default 'mitarbeiter',
  sprache text not null default 'de' check (sprache in ('de', 'en', 'tr', 'pl', 'ro', 'ar')),
  token uuid not null unique default gen_random_uuid(),
  eingeladen_von uuid references auth.users (id) on delete set null,
  angenommen_am timestamptz,
  laeuft_ab_am timestamptz not null default (now() + interval '14 days'),
  erstellt_am timestamptz not null default now()
);

create index einladung_betrieb_id_idx on public.einladung (betrieb_id);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS
-- ---------------------------------------------------------------------------
create function public.ist_mitglied(p_betrieb_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mitglied m
    where m.betrieb_id = p_betrieb_id
      and m.user_id = auth.uid()
      and m.aktiv
  );
$$;

create function public.hat_rolle(p_betrieb_id uuid, p_rollen public.rolle[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mitglied m
    where m.betrieb_id = p_betrieb_id
      and m.user_id = auth.uid()
      and m.aktiv
      and m.rolle = any (p_rollen)
  );
$$;

-- Büro = Inhaber oder Disponent
create function public.ist_buero(p_betrieb_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.hat_rolle(p_betrieb_id, array['inhaber', 'disponent']::public.rolle[]);
$$;

create function public.ist_inhaber(p_betrieb_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.hat_rolle(p_betrieb_id, array['inhaber']::public.rolle[]);
$$;

-- ---------------------------------------------------------------------------
-- Schutz: Rolle/Aktiv nur durch Inhaber ändern, letzter Inhaber bleibt
-- ---------------------------------------------------------------------------
create function public.mitglied_schutz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_andere_inhaber int;
begin
  -- Interne Abläufe (Einladung annehmen) und Kaskaden beim Löschen des Betriebs überspringen
  if coalesce(current_setting('housy.intern', true), '') = '1' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.betrieb b where b.id = old.betrieb_id) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if (new.rolle is distinct from old.rolle or new.aktiv is distinct from old.aktiv
        or new.user_id is distinct from old.user_id or new.betrieb_id is distinct from old.betrieb_id)
       and auth.uid() is not null
       and not public.ist_inhaber(old.betrieb_id) then
      raise exception 'Nur der Inhaber darf Rollen ändern' using errcode = '42501';
    end if;
  end if;

  if old.rolle = 'inhaber' and old.aktiv
     and (tg_op = 'DELETE' or new.rolle <> 'inhaber' or not new.aktiv) then
    select count(*) into v_andere_inhaber
    from public.mitglied m
    where m.betrieb_id = old.betrieb_id
      and m.rolle = 'inhaber'
      and m.aktiv
      and m.id <> old.id;
    if v_andere_inhaber = 0 then
      raise exception 'Der Betrieb braucht mindestens einen aktiven Inhaber' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger mitglied_schutz
before update or delete on public.mitglied
for each row execute function public.mitglied_schutz();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.betrieb enable row level security;
alter table public.mitglied enable row level security;
alter table public.einladung enable row level security;

-- Betrieb: Mitglieder lesen, Inhaber ändert. Anlegen nur über Registrierung (Trigger/Funktion).
create policy betrieb_lesen on public.betrieb
  for select to authenticated using (public.ist_mitglied(id));
create policy betrieb_aendern on public.betrieb
  for update to authenticated using (public.ist_inhaber(id)) with check (public.ist_inhaber(id));

-- Mitglied: alle Mitglieder sehen das Team; Inhaber verwaltet; jeder pflegt eigene Sprache/Name.
create policy mitglied_lesen on public.mitglied
  for select to authenticated using (public.ist_mitglied(betrieb_id));
create policy mitglied_aendern on public.mitglied
  for update to authenticated
  using (public.ist_inhaber(betrieb_id) or user_id = auth.uid())
  with check (public.ist_inhaber(betrieb_id) or user_id = auth.uid());
create policy mitglied_loeschen on public.mitglied
  for delete to authenticated using (public.ist_inhaber(betrieb_id));

-- Einladung: nur Inhaber
create policy einladung_lesen on public.einladung
  for select to authenticated using (public.ist_inhaber(betrieb_id));
create policy einladung_anlegen on public.einladung
  for insert to authenticated
  with check (public.ist_inhaber(betrieb_id) and eingeladen_von = auth.uid());
create policy einladung_loeschen on public.einladung
  for delete to authenticated using (public.ist_inhaber(betrieb_id));

-- ---------------------------------------------------------------------------
-- Betrieb anlegen (für eingeloggte Benutzer, z. B. weiterer Betrieb)
-- ---------------------------------------------------------------------------
create function public.betrieb_anlegen(
  p_name text,
  p_branchen text[] default '{}',
  p_anzeigename text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_betrieb uuid;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  insert into public.betrieb (name, branchen, firmenname)
  values (trim(p_name), coalesce(p_branchen, '{}'), trim(p_name))
  returning id into v_betrieb;
  insert into public.mitglied (betrieb_id, user_id, rolle, anzeigename)
  values (v_betrieb, v_user, 'inhaber', p_anzeigename);
  return v_betrieb;
end;
$$;

-- ---------------------------------------------------------------------------
-- Einladung annehmen
-- ---------------------------------------------------------------------------
create function public.einladung_annehmen_fuer(p_token uuid, p_user uuid, p_anzeigename text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_einladung public.einladung;
  v_email text;
begin
  select * into v_einladung from public.einladung e where e.token = p_token for update;
  if not found then
    raise exception 'Einladung nicht gefunden' using errcode = 'P0002';
  end if;
  if v_einladung.angenommen_am is not null then
    raise exception 'Einladung wurde bereits angenommen' using errcode = '23505';
  end if;
  if v_einladung.laeuft_ab_am < now() then
    raise exception 'Einladung ist abgelaufen' using errcode = '22023';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  if lower(v_email) is distinct from lower(v_einladung.email) then
    raise exception 'Einladung gilt für eine andere E-Mail-Adresse' using errcode = '42501';
  end if;

  perform set_config('housy.intern', '1', true);
  insert into public.mitglied (betrieb_id, user_id, rolle, sprache, anzeigename)
  values (v_einladung.betrieb_id, p_user, v_einladung.rolle, v_einladung.sprache, p_anzeigename)
  on conflict (betrieb_id, user_id) do update set aktiv = true;

  update public.einladung set angenommen_am = now() where id = v_einladung.id;
  perform set_config('housy.intern', '', true);
  return v_einladung.betrieb_id;
end;
$$;

revoke all on function public.einladung_annehmen_fuer(uuid, uuid, text) from public, anon, authenticated;

create function public.einladung_annehmen(p_token uuid, p_anzeigename text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  return public.einladung_annehmen_fuer(p_token, auth.uid(), p_anzeigename);
end;
$$;

-- Öffentliche Info zur Einladung (für die Annahme-Seite, auch ohne Login)
create function public.einladung_info(p_token uuid)
returns table (betrieb_name text, email text, rolle public.rolle, gueltig boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, e.email, e.rolle,
         (e.angenommen_am is null and e.laeuft_ab_am >= now()) as gueltig
  from public.einladung e
  join public.betrieb b on b.id = e.betrieb_id
  where e.token = p_token;
$$;

grant execute on function public.einladung_info(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registrierung: neuer Auth-Benutzer → Betrieb + Inhaber oder Einladung annehmen
-- Metadaten aus supabase.auth.signUp({ options: { data: {...} } }):
--   betrieb_name, branchen (Array), anzeigename, einladung_token
-- ---------------------------------------------------------------------------
create function public.neuer_benutzer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_betrieb uuid;
  v_branchen text[];
begin
  if v_meta ? 'einladung_token' and nullif(v_meta ->> 'einladung_token', '') is not null then
    perform public.einladung_annehmen_fuer(
      (v_meta ->> 'einladung_token')::uuid, new.id, v_meta ->> 'anzeigename');
  elsif nullif(trim(v_meta ->> 'betrieb_name'), '') is not null then
    select coalesce(array_agg(x), '{}') into v_branchen
    from jsonb_array_elements_text(coalesce(v_meta -> 'branchen', '[]'::jsonb)) as x;

    insert into public.betrieb (name, branchen, firmenname)
    values (trim(v_meta ->> 'betrieb_name'), v_branchen, trim(v_meta ->> 'betrieb_name'))
    returning id into v_betrieb;
    insert into public.mitglied (betrieb_id, user_id, rolle, anzeigename)
    values (v_betrieb, new.id, 'inhaber', v_meta ->> 'anzeigename');
  end if;
  return new;
end;
$$;

create trigger neuer_benutzer
after insert on auth.users
for each row execute function public.neuer_benutzer();

-- Interne Funktionen nicht über die API aufrufbar
revoke all on function public.neuer_benutzer() from public, anon, authenticated;
revoke all on function public.mitglied_schutz() from public, anon, authenticated;
