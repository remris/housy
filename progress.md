# Housy – Fortschritt

Stand: 2026-11-20 · aktueller Branch: `m5-planung`

## Wo wir stehen

| Meilenstein                      | Branch              | Status                                                  |
| -------------------------------- | ------------------- | ------------------------------------------------------- |
| M0 Projekt-Setup                 | `m0-setup`          | fertig (bis auf lokale DB und Vercel, siehe unten)      |
| M1 Betriebe, Benutzer, Rollen    | `m1-betriebe`       | fertig                                                  |
| M2 Kunden und Objekte            | `m2-kunden-objekte` | fertig                                                  |
| M3 Vorlagen, Artikel, Preisliste | `m3-vorlagen`       | fertig                                                  |
| M4 Verträge und Serien           | `m4-vertraege`      | fertig                                                  |
| M5 Planung und Touren            | `m5-planung`        | fertig (Abnahme mit echter Supabase steht noch aus)     |
| M6 Mitarbeiter-App (PWA)         | –                   | **wartet auf Entscheidung Sprachen / freie Positionen** |

Die Branches bauen aufeinander auf (m1 von m0, m2 von m1 …). Es reicht, `m5-planung` nach
`main` zu mergen (enthält alles), oder der Reihe nach.

## Nächster Schritt

M6 beginnt, sobald entschieden ist (Vorschlag von Claude in Klammern):

1. **Sprachen der Mitarbeiter-App zum Start** (Deutsch, Englisch, Türkisch, Polnisch, Rumänisch;
   Arabisch wegen Rechts-nach-links erst nach dem Pilot). Der Plan nennt bisher Deutsch + Englisch.
2. **Freie Positionen durch Mitarbeiter** (ja, aber nur als Vorschlag ohne Preis; das Büro
   ordnet einer Preislisten-Leistung zu oder lehnt ab, erst dann abrechenbar).

## Was du tun musst

1. **WSL installieren, damit Docker läuft** (Docker Desktop startet, aber der Daemon nicht,
   weil WSL fehlt). In einer Admin-PowerShell: `wsl --install`, neu starten, Docker Desktop öffnen.
   Danach: `npm run db:start` und `npm run db:test`.
2. **Migrationen ins gehostete Supabase-Projekt** (einmalig, dann nach jedem Meilenstein):
   `npx supabase login`, `npx supabase link --project-ref xqnnnerqpixtjkipzqlt`, `npx supabase db push`.
   Ohne das funktionieren Login/Registrierung gegen die `.env.local`-Werte noch nicht.
3. **Supabase Auth-Einstellungen** (Dashboard → Authentication → URL Configuration):
   Site URL und Redirect-URLs `http://localhost:3000/**` sowie die spätere Vercel-Domain eintragen.
4. **Mapbox-Konto** (neu in M5): auf mapbox.com zwei Tokens anlegen und in `.env.local` und Vercel
   eintragen:
   - `MAPBOX_TOKEN` – Server-Token (Geocoding, Fahrzeiten). Für dauerhaft gespeicherte Koordinaten
     verlangt Mapbox den „permanent“-Geocoding-Endpunkt, der eine hinterlegte Zahlungsart braucht.
     Ohne Zahlungsart vorübergehend `MAPBOX_GEOCODING_PERMANENT=false` setzen.
   - `NEXT_PUBLIC_MAPBOX_TOKEN` – öffentlicher Token nur für Kartenbilder, in Mapbox auf
     `localhost` und die Vercel-Domain beschränken.
   - Ohne Tokens läuft die Planung trotzdem: Fahrzeiten werden aus der Luftlinie geschätzt.
5. **Vercel-Projekt** mit dem Repo verbinden, Umgebungsvariablen aus `.env.example` setzen:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
   `SUPABASE_SECRET_KEY` (Einladungs-Mails, Cron-Job), `CRON_SECRET` (täglicher Serien-Job) und die
   Mapbox-Variablen.
6. **Node 22 LTS** installieren (lokal läuft 20.11; funktioniert, aber `magic-string` ist
   per `overrides` gepinnt und supabase-js warnt).
7. Pushen und Mergen der Branches. Danach in GitHub prüfen, ob die CI grün ist (lief noch nie).

## Wie getestet wird

- `npm test`: Fachlogik (Vitest) **und** Datenbank-Tests in PGlite (Postgres als WASM, ohne Docker):
  Migrationen + Supabase-Nachbau (`tests/db/supabase-stub.sql`), RLS-Szenarien, und die
  pgTAP-Dateien aus `supabase/tests` über einen pgTAP-Nachbau. Mapbox wird mit Fetch-Attrappe getestet.
- `npm run db:test`: echte pgTAP-Tests gegen lokale Supabase (braucht Docker; läuft in der CI).
- `npm run test:e2e`: Playwright (Desktop + Mobil), aktuell ohne Datenbank (Seiten, Umleitungen, Validierung).
- CI (`.github/workflows/ci.yml`): Lint, Format, Typecheck, Unit/DB, Build, E2E + DB-Job mit Supabase CLI.

Letzter lokaler Lauf (M5): Lint, Format, Typecheck grün · 144 Unit-/DB-Tests grün · Build grün ·
42 E2E grün · Wochenplan mit Beispieldaten in Laptop-Breite (1280 px) im Browser angesehen.

**Nicht geprüft:**

- Abläufe mit echter Supabase (Registrierung, Login, Speichern, Uploads, Vertrag aktivieren →
  Einsätze, Unterschrift per Link, Wochenplan mit echten Daten, Drag-and-drop bis in die DB,
  Tagestour-Seite). Dafür fehlen Docker bzw. die Migrationen im gehosteten Projekt.
- Mapbox mit echtem Token (Antwortformat ist nach Doku nachgebaut und getestet, aber nie live
  abgefragt).
- Abnahme M5 („eine Woche für 3 Mitarbeiter ohne Konflikte, Touren mit Ankunftszeiten“) – die
  Logik dafür ist mit Szenarien getestet, die Oberfläche nur mit Beispieldaten.
- CI ist noch nie gelaufen.

## Offene Entscheidungen (aus dem Plan)

- [x] Neues Repo oder Rently Yours → neues Repo (ADR 0001)
- [x] Google Maps oder Mapbox (vor M5) → Mapbox (ADR 0002)
- [ ] Sprachen der Mitarbeiter-App zum Start (vor M6) – **blockiert M6**
- [ ] Freie Positionen durch Mitarbeiter oder nur Preisliste (vor M6) – **blockiert M6**
- [ ] Produktname und Domain (vor M11) – Name „Housy“ steht, Domain offen
- [ ] Pilotbetriebe (vor M12)

## Technische Notizen

- Migrationen (alle noch nicht im gehosteten Projekt):
  `20261120100000_mandanten`, `…100100_storage_logos`, `…110000_kunden_objekte`,
  `…120000_vorlagen_artikel_preise`, `…130000_vertraege_einsaetze`, `…140000_planung`.
- Typen: `npm run db:types` (mit Docker, maßgeblich) oder `npm run db:types:pglite` (ohne Docker).
- Muster: jede Fachtabelle `betrieb_id` + RLS über `ist_mitglied()`/`ist_buero()`/`ist_inhaber()`;
  Kind-Tabellen mit zusammengesetztem FK `(parent_id, betrieb_id)`.
- Formulare: `useAktionsFormular` (react-hook-form + Zod) → Server Action prüft mit demselben Schema.
- Geld immer in Cent (`src/domain/geld.ts`), Datum als ISO-String (`src/domain/datum.ts`).
- Serien: Vertrag → Versionen → Leistungen → `planeVertrag()` → `gleicheAb()` (Zuordnung über
  Vorlage + **Seriendatum**, Zuweisungen und Verschiebungen von Hand bleiben erhalten; Vergangenes
  und Begonnenes wird nie geändert).
- Planung: `src/lib/touren.ts` lädt die Woche und berechnet Touren (`berechneUndSpeichereTour`),
  speichert Reihenfolge, Fahrzeit und geplanten Beginn am Einsatz. Zuweisen per Drag-and-drop
  rechnet alte und neue Tour automatisch neu (neuer Einsatz wird hinten angehängt;
  „Reihenfolge vorschlagen“ optimiert).
- Kartendienst nur in `src/lib/karten/` (Mapbox); Fachlogik bekommt nur eine Fahrzeit-Matrix.
  Fahrzeiten werden nicht zwischengespeichert (eine Matrix-Anfrage je Tourberechnung).
- Vorschau im Browser: `.claude/launch.json` startet `npm run start` auf Port 3100 (vorher `npm run build`).
