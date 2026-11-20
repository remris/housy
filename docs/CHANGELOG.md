# Changelog

Alle nennenswerten Änderungen je Meilenstein. Format angelehnt an „Keep a Changelog“.

## [M0] Projekt-Setup – 2026-11-20

### Hinzugefügt

- Next.js 15 (App Router, TypeScript strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, shadcn/ui
- ESLint (+ Prettier-Kompatibilität), Prettier mit Tailwind-Plugin, `.gitattributes` (LF)
- Supabase CLI als Dev-Dependency, `supabase/config.toml`, Supabase-Clients für Browser, Server und Middleware
- Vitest (Fachlogik, erstes Modul `src/domain/geld.ts`), Playwright (Desktop + Mobil), pgTAP-Grundtest
- GitHub Actions: Lint, Format, Typecheck, Unit-Tests, Build, E2E sowie DB-Job (Migrationen + pgTAP)
- `vercel.json` (Region fra1), `.env.example`, README mit Startanleitung, `CLAUDE.md` mit Projektregeln
- Startseite „Housy“ (deutsch)

### Hinweise

- Lokal läuft Node 20.11; dafür ist `magic-string` per `overrides` auf 0.30.x gepinnt. Empfehlung: Node 22 LTS.

## [M1] Betriebe, Benutzer, Rollen – 2026-11-20

### Hinzugefügt

- Migration `mandanten`: Tabellen `betrieb`, `mitglied` (Rolle Inhaber/Disponent/Mitarbeiter, Sprache), `einladung`
- RLS-Grundmuster mit `ist_mitglied()`, `hat_rolle()`, `ist_buero()`, `ist_inhaber()` (SECURITY DEFINER)
- Registrierung per Trigger auf `auth.users`: legt Betrieb + Inhaber an oder nimmt eine Einladung an
- Schutz: Rollen ändert nur der Inhaber, der letzte aktive Inhaber bleibt erhalten
- Einladungen: Link zum Kopieren; mit `SUPABASE_SECRET_KEY` verschickt Supabase die Einladungs-Mail
- Storage-Bucket `logos` mit Policies (nur Inhaber des Betriebs schreibt in seinen Ordner)
- Seiten: Login, Registrierung, Passwort vergessen/neu, Einladung annehmen, Betrieb anlegen, `/auth/confirm`
- Büro-Layout mit Navigation (Desktop + Mobil), Übersicht, Einstellungen (Firmendaten, Steuer, Bank, Logo), Team
- Formular-Baukasten (react-hook-form + Zod, gleiche Prüfung in der Server Action), IBAN-Prüfung in `src/domain/iban.ts`
- Tests: pgTAP `001_mandanten`, lokale DB-Tests mit PGlite (`tests/db`), E2E für Login-Umleitung und Validierung
- `scripts/db-types-pglite.mjs`: erzeugt `database.types.ts` ohne Docker

## [M2] Kunden und Objekte – 2026-11-20

### Hinzugefügt

- Migration `kunden_objekte`: `kunde` (Typ Firma/Verwaltung/Privat/Öffentlich, Leitweg-ID mit Formatprüfung),
  `ansprechpartner`, `objekt` (Adresse, Koordinaten, Zugang, Schlüssel, QR-Kennung), `bereich` (Raumbuch),
  `fensteraufmass` (Typ, Anzahl, Etage, Rahmen, Hilfsmittel), `objekt_foto` + privater Bucket `objektfotos`
- Nummernkreise je Betrieb (`naechste_nummer`), fortlaufende Kundennummern; importierte Nummern bleiben erhalten
- Zusammengesetzte Fremdschlüssel `(parent_id, betrieb_id)`: Kind-Datensätze können nicht an fremden Betrieben hängen
- RLS: alle Mitglieder lesen, Büro schreibt; Fotos dürfen auch Mitarbeiter hochladen
- Oberfläche: Kunden- und Objektlisten mit Suche, Detailseiten, Ansprechpartner, Raumbuch, Fensteraufmaß, Fotos
- CSV-Import (Excel) für Kunden und Objekte: Trennzeichen-/Encoding-Erkennung (UTF-8/Windows-1252),
  Spalten-Synonyme, Vorschau mit Fehlern je Zeile, Vorlage zum Herunterladen (`src/domain/csv.ts`, `src/domain/import.ts`)
- Tests: pgTAP `002_kunden_objekte`, PGlite-DB-Tests, pgTAP-Dateien laufen zusätzlich lokal über einen pgTAP-Nachbau

## [M3] Vorlagen, Artikel, Preisliste – 2026-11-20

### Hinzugefügt

- Migration `vorlagen_artikel_preise`: `artikel` (Verbrauch/Verschleiß/Gerät, Gebinde, Preis in Cent,
  Mindestbestand, Lieferzeit, Lebensdauer mit Einheit, Auto-Wechsel, Prüfintervall), `auftragsvorlage`
  (Grundzeit + Minuten je 100 m² / je Fenster), `vorlage_taetigkeit` (Checkliste, Foto-Pflicht),
  `vorlage_bedarf` (Menge je Einsatz/m²/Fenster/Stunde), `preisliste` (Einheit, USt., Sonderleistung, Vorlage)
- `paket_installieren(betrieb, jsonb)`: installiert Branchenpakete in einer Transaktion, idempotent über Namen
- Branchenpakete Gebäudereinigung, Hausmeisterservice, Fensterreinigung mit Startwerten aus dem Konzept
  (z. B. 0,5 l Allzweckreiniger je Büroreinigung, Abziehergummi 500 Fenster, Leiter jährlich prüfen)
- Fachlogik `src/domain/vorlagen.ts`: Sollzeit und Bedarf je Einsatz (Grundlage für Planung und Prognose)
- Oberfläche: Artikel (Filter nach Art), Auftragsvorlagen (Checkliste sortierbar, Bedarf, Beispielrechnung,
  Kopieren), Preisliste, „Branchenpaket mit einem Klick übernehmen“
- Tests: Paket-Konsistenz, Bedarf/Sollzeit-Szenarien, PGlite-DB-Tests, pgTAP `003_vorlagen`

## [M4] Verträge und Serien – 2026-11-20

### Hinzugefügt
- Migration `vertraege_einsaetze`: `vertrag` (Laufzeit, Verlängerung, Kündigungsfrist, Status, Freigabe-Token,
  Unterschrift), `vertragsversion` (gültig ab, Abrechnungsart, Monatspauschale), `vertragsleistung`
  (Vorlage, täglich/wöchentlich an Wochentagen/monatlich/einmalig, alle n, Reinigungsfenster mit Uhrzeit und
  erlaubten Wochentagen, Feiertagsregel, Umfang/Preis abweichend), `einsatz` (Grundlage für Planung M5)
- Betrieb: `bundesland` (Feiertage) und `vertragsbedingungen` (erscheinen im PDF)
- RPCs: `vertragsversion_anlegen` (übernimmt Leistungen), `vertrag_dokument`, `vertrag_freigabe_info`,
  `vertrag_unterschreiben` (Kunde per Link ohne Login)
- Fachlogik: `src/domain/datum.ts`, `feiertage.ts` (alle 16 Bundesländer, Osterformel), `serien.ts`
  (Termine, Feiertagsregeln, Versionen, Abgleich ab Stichtag mit Erhalt von Zuweisungen), `vertrag.ts`
  (Periodenende, Kündigungstermin, Status-Workflow)
- Serienplanung (`src/lib/serienplanung.ts`): plant 8 Wochen, nur Zukunft, idempotent; täglicher Cron-Job
  `/api/jobs/serien` (Vercel Cron, `CRON_SECRET`) beendet abgelaufene Verträge und rollt den Horizont weiter
- Vertrags-PDF mit `@react-pdf/renderer` (Büro und öffentlicher Link), Unterschriftsfeld (Canvas) im Büro und
  für den Kunden per Link
- Oberfläche: Vertragsliste mit Statusfilter, Anlage, Detail mit Versionen, Leistungen, Vorschau der Einsätze,
  Aktivieren/Kündigen (mit berechnetem Endtermin)/Beenden/Neu planen, Einstellungen „Verträge“
- Tests: 28 Szenario-Tests für Serien, Feiertage, Versionswechsel und Kündigung; DB-Tests; pgTAP `004_vertraege`

### Behoben
- Schrift: Geist-Variablen hängen jetzt am `<html>`-Element (vorher Serifen-Fallback)
