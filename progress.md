# Housy – Fortschritt

Stand: 2026-11-20 · aktueller Branch: `m7-leistungsnachweis`

## Wo wir stehen

| Meilenstein                      | Branch                 | Status                                                      |
| -------------------------------- | ---------------------- | ----------------------------------------------------------- |
| M0 Projekt-Setup                 | `m0-setup`             | fertig (bis auf lokale DB und Vercel, siehe unten)          |
| M1 Betriebe, Benutzer, Rollen    | `m1-betriebe`          | fertig                                                      |
| M2 Kunden und Objekte            | `m2-kunden-objekte`    | fertig                                                      |
| M3 Vorlagen, Artikel, Preisliste | `m3-vorlagen`          | fertig                                                      |
| M4 Verträge und Serien           | `m4-vertraege`         | fertig                                                      |
| M5 Planung und Touren            | `m5-planung`           | fertig (Abnahme mit echter Supabase steht noch aus)         |
| M6 Mitarbeiter-App (PWA)         | `m6-mitarbeiter-app`   | fertig (Abnahme auf echtem Handy steht noch aus)            |
| M7 Leistungsnachweis und Zeiten  | `m7-leistungsnachweis` | fertig (echter Mail-Versand ungetestet, Resend-Konto fehlt) |
| M8 Inventar und Prognose         | –                      | als Nächstes                                                |

Die Branches bauen aufeinander auf (m1 von m0, m2 von m1 …). Es reicht, den neuesten Branch nach
`main` zu mergen (enthält alles), oder der Reihe nach.

## Nächster Schritt

M8: Lagerorte, Bestände und Lagerbewegungen, Abbuchung beim Abschluss eines Einsatzes, Packliste je
Tour aus Bedarf minus Fahrzeugbestand, Prognose (Reichweite, Mindestbestand, Bestellvorschlag),
Verschleiß mit echtem Austausch, Prüftermine, Einkaufsliste und Inventur. Die Szenarien aus dem
Konzept werden als Tests umgesetzt. Keine offene Entscheidung.

## Was du tun musst

1. **WSL installieren, damit Docker läuft** (Docker Desktop startet, aber der Daemon nicht,
   weil WSL fehlt). In einer Admin-PowerShell: `wsl --install`, neu starten, Docker Desktop öffnen.
   Danach: `npm run db:start` und `npm run db:test`.
2. **Migrationen ins gehostete Supabase-Projekt** (einmalig, dann nach jedem Meilenstein):
   `npx supabase login`, `npx supabase link --project-ref xqnnnerqpixtjkipzqlt`, `npx supabase db push`.
   Ohne das funktionieren Login/Registrierung gegen die `.env.local`-Werte noch nicht.
3. **Supabase Auth-Einstellungen** (Dashboard → Authentication → URL Configuration):
   Site URL und Redirect-URLs `http://localhost:3000/**` sowie die spätere Vercel-Domain eintragen.
4. **Mapbox-Konto** (seit M5): auf mapbox.com zwei Tokens anlegen und in `.env.local` und Vercel
   eintragen:
   - `MAPBOX_TOKEN` – Server-Token (Geocoding, Fahrzeiten). Für dauerhaft gespeicherte Koordinaten
     verlangt Mapbox den „permanent“-Geocoding-Endpunkt, der eine hinterlegte Zahlungsart braucht.
     Ohne Zahlungsart vorübergehend `MAPBOX_GEOCODING_PERMANENT=false` setzen.
   - `NEXT_PUBLIC_MAPBOX_TOKEN` – öffentlicher Token nur für Kartenbilder, in Mapbox auf
     `localhost` und die Vercel-Domain beschränken.
   - Ohne Tokens läuft die Planung trotzdem: Fahrzeiten werden aus der Luftlinie geschätzt.
5. **QR-Codes aushängen** (neu in M6): je Objekt unter Objekte → Objekt → „QR-Code für Check-in“
   drucken. `NEXT_PUBLIC_SITE_URL` muss vorher auf die echte Domain zeigen, weil der Link im Code steht.
6. **Vercel-Projekt** mit dem Repo verbinden, Umgebungsvariablen aus `.env.example` setzen:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`,
   `SUPABASE_SECRET_KEY` (Einladungs-Mails, Cron-Job), `CRON_SECRET` (täglicher Serien-Job) und die
   Mapbox-Variablen. Die App braucht HTTPS (Kamera, Service Worker) – auf Vercel automatisch.
7. **Node 22 LTS** installieren (lokal läuft 20.11; funktioniert, aber `magic-string` ist
   per `overrides` gepinnt und supabase-js warnt).
8. Pushen und Mergen der Branches. Danach in GitHub prüfen, ob die CI grün ist (lief noch nie).
9. **Resend-Konto für den Mail-Versand** (neu in M7): auf resend.com anlegen, die Absender-Domain
   bestätigen (DNS-Einträge), dann `RESEND_API_KEY` und `MAIL_ABSENDER` (z. B.
   `Housy <nachweis@deine-domain.de>`) in `.env.local` und Vercel eintragen. Ohne Key werden
   Nachweise erstellt und unter „Nachweise“ abgelegt, aber nicht verschickt. Die Domain ist noch eine
   offene Entscheidung (vor M11); zum Testen reicht die Resend-Testadresse an die eigene E-Mail.
   Nachweise brauchen außerdem `SUPABASE_SECRET_KEY` auf dem Server.
10. **Je Kunde den Nachweis-Versand prüfen** (Kunde → „Leistungsnachweis per E-Mail“; Standard:
    nach jedem Einsatz) und unter Einstellungen → Firmendaten die Firmen-E-Mail eintragen (Kopie und
    Antwortadresse).
11. **Übersetzungen gegenlesen lassen** (Türkisch, Polnisch, Rumänisch in `src/lib/i18n/`), am
    besten von Mitarbeitern im Pilot. Die Texte sind von Claude übersetzt.

## Wie getestet wird

- `npm test`: Fachlogik (Vitest) **und** Datenbank-Tests in PGlite (Postgres als WASM, ohne Docker):
  Migrationen + Supabase-Nachbau (`tests/db/supabase-stub.sql`), RLS-Szenarien, und die
  pgTAP-Dateien aus `supabase/tests` über einen pgTAP-Nachbau. Mapbox mit Fetch-Attrappe,
  Offline-Warteschlange mit `fake-indexeddb`.
- `npm run db:test`: echte pgTAP-Tests gegen lokale Supabase (braucht Docker; läuft in der CI).
- `npm run test:e2e`: Playwright (Desktop + Mobil), aktuell ohne Datenbank (Seiten, Umleitungen,
  Validierung, Manifest/Service Worker).
- CI (`.github/workflows/ci.yml`): Lint, Format, Typecheck, Unit/DB, Build, E2E + DB-Job mit Supabase CLI.

Letzter lokaler Lauf (M7): Lint, Format, Typecheck grün · 211 Unit-/DB-Tests grün · Build grün ·
64 E2E grün · Nachweis-PDF (Einsatz und Monat) und Arbeitszeit-PDF erzeugt und angesehen (Sonderzeichen
wie „ş“, „Ł“ korrekt) · Abnahme-Unterschrift in der App mit Beispieldaten in Handy-Breite geprüft
(bleibt nach Neuladen über die Warteschlange erhalten).

**Nicht geprüft:**

- Abläufe mit echter Supabase (Registrierung, Login, Speichern, Uploads, Vertrag aktivieren →
  Einsätze, Wochenplan/Tour mit echten Daten, App gegen echte Daten, Büro-Seiten „Rückmeldungen“,
  „Zeiten“, „Arbeitszeitliste“, „Nachweise“, Mängel auf der Objekt-Seite). Dafür fehlen Docker bzw. die
  Migrationen im gehosteten Projekt. Diese Seiten sind nur über Typecheck, Build und Tests der
  Bausteine abgesichert, nicht im Browser mit Daten angesehen.
- Nachweis-Erzeugung end-to-end (Laden aus der DB, Ablage im Bucket, Versand). Getestet sind PDF,
  Mail-Aufruf, Empfängerlogik und RLS einzeln; der Gesamtablauf braucht echte Supabase und Resend.
- Abnahme M6 („ganzer Tag im Flugmodus, danach korrekt synchronisiert“): Die Bausteine sind getestet
  (Warteschlange, Wiederholung, letzte Änderung gewinnt, idempotente Server-Funktionen), der echte
  Durchlauf auf einem Handy steht aus.
- QR-Scan mit echter Kamera (BarcodeDetector gibt es in Chrome auf Android; iPhone-Safari hat ihn
  nicht – dort „Ohne QR-Code einchecken“ oder den QR-Code mit der Kamera-App öffnen).
- Installation als App auf einem echten Handy.
- Mapbox mit echtem Token. CI ist noch nie gelaufen.

## Offene Entscheidungen (aus dem Plan)

- [x] Neues Repo oder Rently Yours → neues Repo (ADR 0001)
- [x] Google Maps oder Mapbox (vor M5) → Mapbox (ADR 0002)
- [x] Sprachen der Mitarbeiter-App → Deutsch, Englisch, Türkisch, Polnisch, Rumänisch
- [x] Freie Positionen → ja, als Vorschlag ohne Preis; das Büro prüft
- [ ] Produktname und Domain (vor M11) – Name „Housy“ steht, Domain offen
- [ ] Pilotbetriebe (vor M12)

## Technische Notizen

- Migrationen (alle noch nicht im gehosteten Projekt):
  `20261120100000_mandanten`, `…100100_storage_logos`, `…110000_kunden_objekte`,
  `…120000_vorlagen_artikel_preise`, `…130000_vertraege_einsaetze`, `…140000_planung`,
  `…150000_mitarbeiter_app`, `…160000_nachweise`.
- Typen: `npm run db:types` (mit Docker, maßgeblich) oder `npm run db:types:pglite` (ohne Docker).
- Muster: jede Fachtabelle `betrieb_id` + RLS über `ist_mitglied()`/`ist_buero()`/`ist_inhaber()`;
  Kind-Tabellen mit zusammengesetztem FK `(parent_id, betrieb_id)`.
- Formulare: `useAktionsFormular` (react-hook-form + Zod) → Server Action prüft mit demselben Schema.
- Geld immer in Cent (`src/domain/geld.ts`), Datum als ISO-String (`src/domain/datum.ts`),
  Uhrzeiten der Zeiterfassung als Zeitpunkt (UTC) und Anzeige in Europe/Berlin.
- Serien: Vertrag → Versionen → Leistungen → `planeVertrag()` → `gleicheAb()` (Zuordnung über
  Vorlage + **Seriendatum**, Zuweisungen und Verschiebungen von Hand bleiben erhalten; Vergangenes
  und Begonnenes wird nie geändert).
- Planung: `src/lib/touren.ts` lädt die Woche und berechnet Touren (`berechneUndSpeichereTour`).
- Kartendienst nur in `src/lib/karten/` (Mapbox); Kartenbild-URL in `kartenbild.ts` (auch im Browser).
- Mitarbeiter-App: Mitarbeiter schreiben nie direkt in Tabellen, nur über `app_*`-Funktionen
  (prüfen die Zuweisung, ID vom Gerät → Wiederholungen harmlos). Ablauf im Browser:
  Aktion → sofort lokal anwenden (`wendeAn`) → Dexie-Warteschlange → `synchronisiere()`;
  nach dem Neuladen vom Server werden ausstehende Aktionen erneut angewendet (`mitAusstehenden`).
  Service Worker `public/sw.js` nur im Produktionsbuild; Versionsname bei Änderungen hochzählen.
- Zeitkorrekturen nur über `zeitbuchung_korrigieren/_stornieren/_nachtragen` (Grund Pflicht,
  Protokoll in `zeitbuchung_protokoll`).
- Nachweise: `src/lib/nachweise/` (Daten laden, `nachweisErstellen` mit Sperre und Wiederholung,
  täglicher `nachweisLauf`, Bestätigungs-Mails). Erzeugt wird mit dem Admin-Client, das Büro und die
  App prüfen vorher den Zugriff mit dem eigenen Client. PDFs in `src/lib/pdf/` mit Noto Sans
  (`schrift.ts`, Dateien werden über `outputFileTracingIncludes` mit ausgeliefert).
- Mail nur über `src/lib/mail/resend.ts` (ohne Key kein Versand), Texte in `src/lib/mail/texte.ts`.
- Vorschau im Browser: `.claude/launch.json` startet `npm run start` auf Port 3100 (vorher `npm run build`).
