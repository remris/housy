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

## [M5] Planung und Touren – 2026-11-20

### Hinzugefügt

- Entscheidung Kartendienst: Mapbox (ADR 0002)
- Migration `planung`: `mitarbeiter_verfuegbarkeit` (Arbeitszeit je Wochentag), `abwesenheit` (Urlaub, krank, sonstiges), `fahrzeug`, `tour` (eine je Mitarbeiter und Tag); Betrieb mit Koordinaten und üblicher Abfahrt; Einsatz mit Reihenfolge, Fahrzeit und geplantem Beginn
- Status folgt der Zuweisung (geplant ↔ zugewiesen), solange ein Einsatz nicht begonnen hat
- Fachlogik `src/domain/planung.ts`: Tagestour mit Ankunft, Wartezeit und Warnung bei verletztem Reinigungsfenster; Reihenfolge-Vorschlag (nächster Nachbar + 2-opt, Fenster vor Fahrzeit); Konflikte (Abwesenheit, kein Arbeitstag, außerhalb der Arbeitszeit, Überlastung inkl. Fahrzeit, Überschneidung, Fenster kürzer als Sollzeit); Luftlinien-Schätzung als Rückfall
- Mapbox-Anbindung `src/lib/karten/`: Geocoding (dauerhaft speicherbar) für Objekte und Firmensitz, Fahrzeit-Matrix, Kartenbild der Tour; ohne Token läuft alles mit Schätzung
- Büro: Wochenplan je Mitarbeiter mit Drag-and-drop (Tour wird danach neu berechnet), Auslastung, Konfliktliste; Tagestour mit Reihenfolge, Fahrzeiten, Ankunftszeiten, Karte, Abfahrt und Fahrzeug; Liste offener Einsätze mit Zuweisung; Arbeitszeiten und Abwesenheiten; Fahrzeuge, übliche Abfahrt, „Fehlende Koordinaten ergänzen“
- Tests: 20 Szenarien Planung, 6 Mapbox (mit Fetch-Attrappe), DB-Tests und pgTAP `005_planung` (Betrieb B sieht nichts von A, Mitarbeiter sieht nur eigene Tour/Abwesenheit)

### Geändert

- Serien-Einsätze tragen ein `serien_datum`. Von Hand verschobene Einsätze werden beim täglichen Abgleich weiter ihrem Serientermin zugeordnet und nicht doppelt angelegt; der Eindeutigkeitsindex nutzt jetzt das Seriendatum

### Hinweise

- Neue Variablen: `MAPBOX_TOKEN` (Server), `NEXT_PUBLIC_MAPBOX_TOKEN` (Kartenbilder, in Mapbox auf die Domain beschränken), optional `MAPBOX_GEOCODING_PERMANENT`

## [M6] Mitarbeiter-App (PWA) – 2026-11-20

### Hinzugefügt

- Entscheidungen: App-Sprachen Deutsch, Englisch, Türkisch, Polnisch, Rumänisch; freie Positionen nur als Vorschlag ohne Preis, das Büro prüft
- Migration `mitarbeiter_app`: `zeitbuchung` (Check-in/-out, Pausen) mit `zeitbuchung_protokoll`, `einsatz_aufgabe` (Checkliste), `einsatz_meldung` (Mangel, Material leer), `einsatz_foto` (+ privater Bucket `einsatzfotos`), `einsatz_position` (Vor-Ort-Leistungen), `stammdaten_verlauf`; Notiz am Einsatz
- App-Funktionen `app_*` (Zuweisung geprüft, idempotent über die Geräte-ID, „letzte Änderung gewinnt“ für Checkliste und Notiz); Büro-Funktionen `zeitbuchung_korrigieren/_stornieren/_nachtragen` nur mit Grund und Protokoll
- Fachlogik `src/domain/zeiterfassung.ts` (Arbeitszeit, Pausen nach § 4 ArbZG, über 10 Stunden, offene Buchungen) und `src/domain/app.ts` (Tagesdaten, Offline-Aktionen, Packliste, QR-Prüfung, Navigation)
- PWA: Manifest, Icons (`scripts/icons.mjs`), Service Worker (App-Seite und statische Dateien offline), Installationshinweis inkl. iPhone
- Offline: Tagesdaten und Warteschlange in IndexedDB (Dexie), Fotos als Blob bis zum Hochladen, Abgleich in Reihenfolge mit wachsender Wartezeit, endgültige Fehler sichtbar und verwerfbar
- App-Oberfläche: Heute/Morgen in Tourreihenfolge, Arbeitszeit mit Pause, Karte, Packliste, „Navigation starten“ (Google Maps oder Apple Karten), QR-Check-in (Kamera) oder ohne QR, Checkliste mit Pflichtfoto, Fotos, Mängel mit Foto, Material leer, Notiz, Leistung aus Preisliste oder frei mit Unterschrift bzw. mündlich, Stammdaten-Korrektur (Zugang, Fensteranzahl), Auschecken mit Hinweis auf offene Punkte, Sprachwahl
- Übersetzungen `src/lib/i18n` (de, en, tr, pl, ro) mit Test auf Vollständigkeit und Platzhalter; Schrift mit `latin-ext`
- Büro: „Rückmeldungen“ (freie Leistungen bepreisen oder ablehnen, dauerhafte Leistungen in den Vertrag übernehmen, Mängel/Material mit Fotos erledigen, Stammdaten-Verlauf), „Zeiten“ (Wochenübersicht, Tagesdetail, Korrigieren/Stornieren/Nachtragen mit Grund, Protokoll), QR-Code je Objekt zum Drucken, Link `/qr/<kennung>` öffnet die App
- Tests: Zeiterfassung, Offline-Aktionen, Warteschlange (mit fake-indexeddb), Übersetzungen, DB-Tests und pgTAP `006_mitarbeiter_app`, E2E für Manifest/Service Worker/geschützte Seiten

### Offen

- Bestätigungs-Mail an den Kunden bei mündlich vereinbarter Leistung (kommt mit dem Mail-Versand in M7)
- „Dauerhaft“ vereinbarte Leistungen legt das Büro selbst als neue Vertragsversion an (Liste unter Rückmeldungen)

## [M7] Leistungsnachweis und Zeiten – 2026-11-20

### Hinzugefügt

- Migration `nachweise`: Nachweis-Versand je Kunde (nach jedem Einsatz, monatlich, nicht automatisch) und abweichende Nachweis-Adresse; Betriebs-Einstellungen Kopie an die Firmen-E-Mail und Fotos im Nachweis; Tabelle `nachweis` (genau einer je Einsatz bzw. je Objekt und Monat, Status, Empfänger, Sperre gegen doppelte Bearbeitung) mit privatem Bucket `nachweise`; `mail_protokoll`; Abnahme-Unterschrift am Einsatz (`app_abnahme`); Mängelstatus offen/in Bearbeitung/erledigt mit Büro-Notiz
- Fachlogik `src/domain/nachweis.ts` (Monate, Fälligkeit, Empfänger, Zeiten je Einsatz, Dateiname) und `src/domain/arbeitszeitliste.ts` (Tage nach Ortszeit, Summe, Hinweise, korrigierte Tage, CSV), CSV-Schreiber mit Schutz vor Excel-Formeln
- Nachweis-PDF je Einsatz (Zeiten, Checkliste, Zusatzleistungen, Mängel, bis zu 6 Fotos, Abnahme-Unterschrift) und je Monat (Übersicht plus Einzelnachweise); Arbeitszeitnachweis je Mitarbeiter als PDF mit Unterschriftszeilen
- Versand per Resend (REST, Idempotenz-Schlüssel, Antwort an den Betrieb, BCC-Kopie); ohne `RESEND_API_KEY` wird erzeugt und abgelegt, aber nicht verschickt
- Automatik: Die App meldet nach dem Übertragen eines Check-outs `/api/app/abgeschlossen`, der Server verschickt Nachweis und Bestätigungen im Hintergrund; täglicher Job `/api/jobs/nachweise` (Vercel Cron 19:00 UTC) holt Verpasstes nach, erstellt am Monatsanfang die Monatsnachweise, wiederholt Fehler (bis 5 Versuche)
- Bestätigungs-Mail an den Kunden bei mündlich vereinbarten Leistungen, sobald der Preis feststeht (Preisliste sofort, freie Leistung nach Prüfung im Büro)
- Mitarbeiter-App: optionale Abnahme durch den Kunden mit Unterschrift vor dem Auschecken (alle 5 Sprachen)
- Büro: „Nachweise“ (je Monat, Status, PDF, neu erstellen, erneut senden, erledigte Einsätze ohne Nachweis, Monatsnachweis von Hand), „Arbeitszeitliste“ unter Zeiten (je Mitarbeiter und Monat, CSV/PDF einzeln oder für alle), Mängel-Liste mit Status auf der Objekt-Seite und unter Rückmeldungen, offene Bestätigungen unter Rückmeldungen, Einstellungen → Nachweise, Kunde → Nachweis-Versand
- Tests: Nachweis-Fachlogik und Arbeitszeitliste, Mail-Texte und Resend-Aufruf (Fetch-Attrappe), PDFs, DB-Tests und pgTAP `007_nachweise`, E2E für die neuen geschützten Seiten und Endpunkte

### Geändert

- PDFs nutzen Noto Sans (SIL OFL, `src/lib/pdf/schriften`) statt Helvetica, damit Namen wie „Ayşe“ oder „Łukasz“ richtig erscheinen; gilt auch für das Vertrags-PDF

### Hinweise

- Neue Variablen: `RESEND_API_KEY`, `MAIL_ABSENDER` (Domain in Resend bestätigen)
- Nachweise und Bestätigungen brauchen `SUPABASE_SECRET_KEY` auf dem Server (Erzeugung mit Admin-Client)

## [M8] Inventar und Prognose – 2026-11-20

### Hinzugefügt

- Migration `inventar`: `lagerort` (Zentrallager automatisch je Betrieb, Fahrzeuge automatisch, Putzkammer im Objekt), `bestand` (per Trigger aus den Bewegungen), `lagerbewegung` (Zugang, Abbuchung je Einsatz, Umbuchung, Korrektur, Wechsel; unveränderlich, je Einsatz und Artikel nur eine Abbuchung), `objekt_bedarf` (Verbrauch je Objekt überschreibt die Vorlage), `werkzeug` mit `werkzeug_wechsel` und `werkzeug_pruefung` (nächster Prüftermin aus dem Prüfintervall), `bestellung`; Standardfahrer am Fahrzeug; App-Funktionen `app_geladen` und `app_werkzeug_gewechselt`
- Fachlogik `src/domain/prognose.ts` (Reichweite, Bestellvorschlag für etwa 4 Wochen, Ladeliste mit Puffer, Verschleißstufen, Zähler ab dem echten Wechsel ohne Übertrag, Fälligkeit nach Plan, erwartete Wechsel, Lebensdauer-Vorschlag, Prüfstatus, Ist-Korrektur) und `src/domain/lager.ts` (Buchungsregeln, Inventur-Differenz, Abbuchungsort)
- Die beiden Szenarien aus dem Konzept als Tests (`src/domain/prognose.test.ts`)
- Abbuchung des Sollverbrauchs beim Abschluss eines Einsatzes (nach dem Übertragen des Check-outs, beim Nachtragen im Büro und nächtlich als Nachlauf); Ort: Fahrzeug der Tour → Standardfahrzeug → Putzkammer → Zentrallager; Auto-Wechsel für Kleinteile im nächtlichen Lauf
- Mitarbeiter-App: Packliste mit Fahrzeugbestand und Ladevorschlag in ganzen Gebinden („1 × Kanister einladen“ bucht vom Zentrallager ins Fahrzeug), Werkzeuge mit Zähler und „Gewechselt“, „Ersatz mitnehmen“ wenn der Wechsel heute fällig wird, Warnung bei überfälliger Geräteprüfung am Einsatz (alle 5 Sprachen)
- Büro „Inventar“: Bestände je Lagerort mit Bedarf pro Woche und Reichweite, Einkaufsliste mit „Bestellt“, offene Bestellungen mit Wareneingang, „Mehr verbraucht als geplant“ aus Leer-Meldungen mit Übernahme für die Objekte, Buchen (Zugang, Umbuchung, Inventur); Werkzeuge mit Zähler, Stufen, Fälligkeit, Wechsel (auch nachträglich datiert), Prüfungen und „Lebensdauer lernt mit“; Lagerorte und Buchungsjournal; Verbrauch je Objekt auf der Objekt-Seite; Dashboard mit knappen Reichweiten und fälligen Werkzeugen/Prüfungen
- Tests: Szenarien, Lager-, App- und Schema-Tests, DB-Tests und pgTAP `008_inventar`, E2E für die neuen geschützten Seiten

## [M9] Rechnung und E-Rechnung – 2026-11-20

### Hinzugefügt

- Migration `rechnungen`: `rechnung` (Entwurf → festgeschrieben → bezahlt/storniert, eingefrorene Daten, Ablagepfade), `rechnungsposition`, `abrechnung` (gegen Doppelabrechnung von Einsätzen, Nachträgen und Pauschalen), Funktionen `rechnung_festschreiben` (lückenlose Nummer je Jahr über den Nummernkreis) und `rechnung_stornieren` (Gutschrift mit eigener Nummer), Schutz-Trigger (GoBD), privater Bucket `rechnungen` (nur anlegen); Einstellungen Präfix, Ansprechpartner, Fußtext, DATEV-Nummern, Kontenrahmen; E-Rechnungsformat je Kunde
- Fachlogik `src/domain/rechnung.ts` (Monatslauf je Vertrag: Pauschale taggenau anteilig bei Versionswechsel und Vertragsbeginn/-ende, Aufwand nach Stunden/Fenstern/m²/Einsätzen, Einzelauftrag, Nachträge, Summen je Steuersatz, Pflichthinweise § 19 und § 14b UStG), `src/domain/erechnung.ts` (XRechnung 3.0 als UBL Invoice/CreditNote, CII für ZUGFeRD, Vorprüfung der Pflichtangaben), `src/domain/datev.ts` (Buchungsstapel EXTF 700, Windows-1252)
- Rechnungs-PDF mit Fußzeile (Bank, Steuernummer), Entwurfs-Wasserzeichen, Stornorechnung; ZUGFeRD durch Einbetten des XML mit pdf-lib (PDF/A-3b-Metadaten, sRGB-OutputIntent)
- Büro „Rechnungen“: Prüfansicht je Monat mit Monatslauf, Positionen, Hinweisen des Laufs und fehlenden Pflichtangaben, Vorschau-PDF, Position ergänzen/entfernen, „festschreiben und senden“ mit einem Klick, Liste mit PDF, XRechnung, Senden, Bezahlt, Storno; offene Posten; DATEV-Export; Dashboard-Kachel offene Rechnungen; Einstellungen → Rechnungen
- Versand per Resend: ZUGFeRD-PDF, bei Behörden bzw. Kundeneinstellung zusätzlich XRechnung-XML
- Testkunden (Hausverwaltung mit Versionswechsel und Nachtrag, Behörde mit Leitweg-ID nach Aufwand, Privatkunde beim Kleinunternehmer) plus Storno als Fixtures in `tests/erechnung/fixtures`; Prüfskript `npm run erechnung:pruefen` (KoSIT-Validator mit XRechnung-Konfiguration) und CI-Job
- Tests: Monatslauf-Szenarien, E-Rechnung (Struktur, Summen, Kleinunternehmer, Storno, Fixtures aktuell), PDF/ZUGFeRD, DATEV, DB-Tests und pgTAP `009_rechnungen`
- ADR 0003 Rechnung und E-Rechnung

### Behoben

- Euro-Eingaben in Formularen wurden seit M3 mit 100 multipliziert gespeichert (Formular und Server Action prüfen nacheinander dasselbe Schema; `optEuro` wandelte eine Zahl erneut um). Betroffen waren Preisliste, Vertragspreise, Pauschalen und die Preisprüfung freier Leistungen. Es gab noch keine echten Daten.

### Offen

- KoSIT-Validator noch nicht gelaufen (lokal braucht er einen Download von GitHub, in der CI läuft er beim ersten Push)
- PDF/A-3-Konformität nicht mit veraPDF geprüft; § 13b UStG, Skonto, Mahnwesen, Abschlagsrechnungen nicht umgesetzt
