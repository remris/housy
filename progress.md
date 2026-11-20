# Housy – Fortschritt

Stand: 2026-11-20 · aktueller Branch: `m4-vertraege`

## Wo wir stehen

| Meilenstein                      | Branch              | Status                                             |
| -------------------------------- | ------------------- | -------------------------------------------------- |
| M0 Projekt-Setup                 | `m0-setup`          | fertig (bis auf lokale DB und Vercel, siehe unten) |
| M1 Betriebe, Benutzer, Rollen    | `m1-betriebe`       | fertig                                             |
| M2 Kunden und Objekte            | `m2-kunden-objekte` | fertig                                             |
| M3 Vorlagen, Artikel, Preisliste | `m3-vorlagen`       | fertig                                             |
| M4 Verträge und Serien           | `m4-vertraege`      | fertig                                             |
| M5 Planung und Touren            | –                   | **wartet auf Entscheidung Google Maps / Mapbox**   |

Die Branches bauen aufeinander auf (m1 von m0, m2 von m1 …). Es reicht, `m4-vertraege` nach
`main` zu mergen (enthält alles), oder der Reihe nach.

## Nächster Schritt

M5 beginnt, sobald entschieden ist:

1. **Google Maps oder Mapbox** (Routing-API für Fahrzeiten, Geocoding für Objektadressen)
2. Gleich mitentscheiden, damit M6 nicht wieder wartet: **Sprachen der Mitarbeiter-App zum Start**
   und **ob Mitarbeiter freie Positionen anlegen dürfen** (oder nur aus der Preisliste).

## Was du tun musst

1. **WSL installieren, damit Docker läuft** (Docker Desktop startet, aber der Daemon nicht,
   weil WSL fehlt). In einer Admin-PowerShell: `wsl --install`, neu starten, Docker Desktop öffnen.
   Danach: `npm run db:start` und `npm run db:test`.
2. **Migrationen ins gehostete Supabase-Projekt** (einmalig, dann nach jedem Meilenstein):
   `npx supabase login`, `npx supabase link --project-ref xqnnnerqpixtjkipzqlt`, `npx supabase db push`.
   Ohne das funktionieren Login/Registrierung gegen die `.env.local`-Werte noch nicht.
3. **Supabase Auth-Einstellungen** (Dashboard → Authentication → URL Configuration):
   Site URL und Redirect-URLs `http://localhost:3000/**` sowie die spätere Vercel-Domain eintragen.
4. **Vercel-Projekt** mit dem Repo verbinden, Umgebungsvariablen aus `.env.example` setzen:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
   `SUPABASE_SECRET_KEY` (Einladungs-Mails, Cron-Job) und `CRON_SECRET` (täglicher Serien-Job).
5. **Node 22 LTS** installieren (lokal läuft 20.11; funktioniert, aber `magic-string` ist
   per `overrides` gepinnt und supabase-js warnt).
6. Pushen und Mergen der Branches. Danach in GitHub prüfen, ob die CI grün ist (lief noch nie).

## Wie getestet wird

- `npm test`: Fachlogik (Vitest) **und** Datenbank-Tests in PGlite (Postgres als WASM, ohne Docker):
  Migrationen + Supabase-Nachbau (`tests/db/supabase-stub.sql`), RLS-Szenarien, und die
  pgTAP-Dateien aus `supabase/tests` über einen pgTAP-Nachbau.
- `npm run db:test`: echte pgTAP-Tests gegen lokale Supabase (braucht Docker; läuft in der CI).
- `npm run test:e2e`: Playwright (Desktop + Mobil), aktuell ohne Datenbank (Seiten, Umleitungen, Validierung).
- CI (`.github/workflows/ci.yml`): Lint, Format, Typecheck, Unit/DB, Build, E2E + DB-Job mit Supabase CLI.

Letzter lokaler Lauf (M4): Lint, Format, Typecheck grün · 111 Unit-/DB-Tests grün · Build grün ·
34 E2E grün · Registrierung im Browser (Handy-Breite) geprüft · Vertrags-PDF gerendert und angesehen.

**Nicht geprüft:** Abläufe mit echter Supabase (Registrierung mit Mail, Login, Speichern, Uploads,
Vertrag aktivieren → Einsätze, Unterschrift per Link) – dafür fehlen Docker bzw. die Migrationen im
gehosteten Projekt. Die Serienplanung selbst ist über die Fachlogik getestet, der Datenbank-Abgleich
(`src/lib/serienplanung.ts`) noch nicht gegen echte Supabase. CI ist noch nie gelaufen.

## Offene Entscheidungen (aus dem Plan)

- [x] Neues Repo oder Rently Yours → neues Repo (ADR 0001)
- [ ] Google Maps oder Mapbox (vor M5) – **blockiert M5**
- [ ] Sprachen der Mitarbeiter-App zum Start (vor M6)
- [ ] Freie Positionen durch Mitarbeiter oder nur Preisliste (vor M6)
- [ ] Produktname und Domain (vor M11) – Name „Housy“ steht, Domain offen
- [ ] Pilotbetriebe (vor M12)

## Technische Notizen

- Migrationen (alle noch nicht im gehosteten Projekt):
  `20261120100000_mandanten`, `…100100_storage_logos`, `…110000_kunden_objekte`,
  `…120000_vorlagen_artikel_preise`, `…130000_vertraege_einsaetze`.
- Typen: `npm run db:types` (mit Docker, maßgeblich) oder `npm run db:types:pglite` (ohne Docker).
- Muster: jede Fachtabelle `betrieb_id` + RLS über `ist_mitglied()`/`ist_buero()`/`ist_inhaber()`;
  Kind-Tabellen mit zusammengesetztem FK `(parent_id, betrieb_id)`.
- Formulare: `useAktionsFormular` (react-hook-form + Zod) → Server Action prüft mit demselben Schema.
- Geld immer in Cent (`src/domain/geld.ts`), Datum als ISO-String (`src/domain/datum.ts`).
- Serien: Vertrag → Versionen → Leistungen → `planeVertrag()` → `gleicheAb()` (Zuordnung über
  Vorlage + Datum, Zuweisungen bleiben erhalten; Vergangenes und Begonnenes wird nie geändert).
- Einsätze haben schon `mitarbeiter_id` und `status` für M5/M6.
- Vorschau im Browser: `.claude/launch.json` startet `npm run start` auf Port 3100 (vorher `npm run build`).
