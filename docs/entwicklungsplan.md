# Entwicklungsplan: Reinigungs- und Hausmeister-Software

Nov 20, 2026 · @chris

## Arbeitsweise und Voraussetzungen

Ich entwickle Meilenstein für Meilenstein in einem Ordner auf deinem Rechner, ohne IDE: Dateien schreiben, Befehle ausführen, Tests laufen lassen, committen. Du reviewst, testest im Browser und pushst. Grundlage ist das [Konzept](https://claude.ai/artifact/469ZzQihb9jUHodL5DuxKU) (lokal: `docs/konzept.md`).

**Ablauf pro Meilenstein**

1. Branch `m<Nr>-<thema>` anlegen
2. Migration, Fachlogik mit Unit-Tests, dann Oberfläche
3. Tests und Lint grün, kurze Notiz in `docs/CHANGELOG.md`
4. Du testest lokal, gibst Feedback, mergest nach `main`; Vercel deployt automatisch
5. Haken in diesem Plan setzen

**Was du bereitstellst**

- [ ] Leeren Ordner auf deinem Rechner, in der Claude-Desktop-App für diesen Chat freigegeben („Ordner hinzufügen“)
- [ ] Node.js (aktuelle LTS), Git, Supabase CLI und Docker für die lokale Datenbank
- [ ] Leeres GitHub-Repository; das Pushen machst du, ich committe
- [ ] Supabase-Projekt in der Region Frankfurt
- [ ] Vercel-Projekt, mit dem Repo verbunden
- [ ] Später: Stripe-Testkonto, Google-Maps- oder Mapbox-Key, Resend-Key, Domain

Schlüssel und Passwörter trägst du selbst in `.env.local` ein. Ich lege nur `.env.example` mit den Namen an, `.env.local` steht in `.gitignore`.

## Tech-Stack und Projektstruktur

Eine einzige Next.js-App für Büro und Mitarbeiter-App, Supabase als Datenbank, alle Fachlogik in reinen TypeScript-Modulen mit Tests.

| Bereich | Wahl |
| --- | --- |
| Framework | Next.js (App Router, TypeScript strict), Hosting Vercel, Functions in fra1 |
| UI | Tailwind CSS, shadcn/ui, Formulare mit react-hook-form + Zod |
| Datenbank | Supabase Postgres in Frankfurt, Migrationen als SQL über Supabase CLI, generierte TypeScript-Typen |
| Auth und Mandanten | Supabase Auth, Rollen Inhaber / Disponent / Mitarbeiter, Row Level Security über `betrieb_id` |
| Mitarbeiter-App | PWA unter `/app`, Serwist (Service Worker), Dexie (IndexedDB), Upload-Warteschlange |
| Dateien | Supabase Storage (Fotos, PDFs, Unterschriften) |
| Jobs | pg\_cron + Supabase Edge Functions; später Inngest oder Trigger.dev |
| Dokumente | @react-pdf/renderer; E-Rechnung als XRechnung (UBL) und ZUGFeRD, geprüft mit dem KoSIT-Validator |
| Karten | Google Routes API oder Mapbox, Navigation per Deeplink |
| E-Mail | Resend |
| Zahlungen | Stripe Billing mit SEPA-Lastschrift (nur eigene Abos) |
| Tests | Vitest (Fachlogik), pgTAP (RLS-Regeln), Playwright (Hauptabläufe) |

**Ordnerstruktur**

```
/src/app/(buero)/       Büro-Oberfläche: Kunden, Verträge, Planung, Lager, Rechnungen
/src/app/app/           Mitarbeiter-PWA: Tagesansicht, Einsatz, Packliste
/src/app/(public)/      Online-Buchung, Angebotsfreigabe, Kundenbestätigung
/src/domain/            reine Fachlogik: serien, planung, prognose, rechnung, erechnung
/src/lib/               Supabase-Clients, Auth, PDF, E-Mail
/supabase/migrations/   SQL-Migrationen inkl. RLS
/supabase/tests/        pgTAP-Tests
/tests/e2e/             Playwright
/docs/                  Konzept-Auszug, CHANGELOG, Entscheidungen (ADR)
```

## Meilensteine M0–M4: Fundament bis Vertrag

Die Reihenfolge folgt den Abhängigkeiten: Ohne Mandanten keine Daten, ohne Vorlagen keine Verträge, ohne Verträge keine Planung.

### M0 Projekt-Setup

- [x] Next.js-Projekt anlegen, TypeScript strict, ESLint, Prettier, Tailwind, shadcn/ui
- [x] Git initialisieren, `.gitignore`, `.env.example`, README mit Startanleitung
- [ ] Supabase CLI einrichten, lokale Datenbank läuft *(CLI eingerichtet; lokaler Start wartet auf laufenden Docker-Daemon)*
- [x] Vitest, Playwright, GitHub Actions (Lint, Typecheck, Tests bei jedem Push)
- [ ] Erstes Deployment auf Vercel *(durch Inhaber: Vercel-Projekt verbinden, `vercel.json` setzt fra1)*

Fertig, wenn: `npm run dev` startet, CI ist grün, die Startseite ist online.

### M1 Betriebe, Benutzer, Rollen

- [x] Tabellen `betrieb`, `mitglied` (Rolle, Sprache), Einladung per E-Mail
- [x] Registrierung legt Betrieb + Inhaber an, Login, Passwort vergessen
- [x] RLS-Grundmuster: jede Fachtabelle hat `betrieb_id`, Zugriff nur für Mitglieder
- [x] pgTAP-Tests: Betrieb A sieht keine Daten von Betrieb B
- [x] Grundlayout Büro mit Navigation, Einstellungen (Firmendaten, Logo, Steuernummer, Bankverbindung für Rechnungen)

Fertig, wenn: zwei Betriebe getrennt arbeiten und die RLS-Tests grün sind.

### M2 Kunden und Objekte

- [x] `kunde` (Firma, Verwaltung, Privat; Leitweg-ID optional für XRechnung), `ansprechpartner`
- [x] `objekt` mit Adresse, Geokoordinaten, Zugangshinweisen, Fotos *(Koordinaten vorerst manuell; Geocoding mit der Karten-Entscheidung vor M5)*
- [x] `bereich` (Raumbuch: Name, Fläche m², Bodenart) und `fensteraufmass` (Typ, Anzahl, Etage, Hilfsmittel)
- [x] Listen mit Suche, Detailseiten, CSV-Import für Kunden und Objekte

Fertig, wenn: ein Betrieb seine Kundenliste aus Excel importieren kann.

### M3 Vorlagen, Artikel, Preisliste

- [ ] `artikel` (Art: Verbrauch, Verschleiß, Gerät; Einheit, Gebinde, Preis, Lieferant, Mindestbestand, Lebensdauer, Prüfintervall)
- [ ] `auftragsvorlage` mit Tätigkeiten (Checkliste), Sollzeit und `vorlage_bedarf` (Artikel, Menge, Bezug: Einsatz, m², Fenster, Stunde)
- [ ] `preisliste` für Leistungen und Sonderleistungen
- [ ] Branchenpakete als Seed: Gebäudereinigung, Hausmeister, Fensterreinigung mit Startwerten

Fertig, wenn: ein neuer Betrieb mit einem Klick Vorlagen, Artikel und Preise seiner Branche bekommt.

### M4 Verträge und Serien

- [ ] `vertrag` (Parteien, Objekt, Laufzeit, Kündigungsfrist, Status) und `vertragsversion` (gültig ab, Leistungen, Preis, Abrechnungsart)
- [ ] `vertragsleistung`: Vorlage + Intervall (RRULE-ähnlich: täglich, Wochentage, alle n Wochen) + Reinigungsfenster
- [ ] Fachlogik `domain/serien`: erzeugt Einsätze für die nächsten 8 Wochen, beachtet Feiertage (Baden-Württemberg zuerst), regeneriert ab Stichtag bei neuer Version
- [ ] Vertrags-PDF, Unterschrift per Signaturfeld, Status-Workflow
- [ ] Unit-Tests für Serien inkl. Versionswechsel und Feiertagen

Fertig, wenn: ein aktiver Vertrag automatisch korrekte Einsätze erzeugt und eine neue Version nur die Zukunft ändert.

## Meilensteine M5–M8: Planung bis Inventar

Ab hier wird die Software im Alltag nutzbar: Einsätze verteilen, vor Ort abarbeiten, Nachweis verschicken, Material im Blick.

### M5 Planung und Touren

- [ ] `mitarbeiter_verfuegbarkeit` (Arbeitszeiten, Urlaub, Krankheit), `fahrzeug`
- [ ] Wochenplan je Mitarbeiter, Einsätze per Drag-and-drop zuweisen und verschieben
- [ ] Tagestour: Reihenfolge, Fahrzeiten über Routing-API, Ankunftszeiten, Warnung bei verletztem Reinigungsfenster
- [ ] Fachlogik `domain/planung`: Konflikte (Überschneidung, Abwesenheit, Zeitfenster) mit Unit-Tests
- [ ] Offene Einsätze ohne Mitarbeiter als Liste

Fertig, wenn: eine Woche für 3 Mitarbeiter ohne Konflikte geplant ist und die Touren Ankunftszeiten zeigen.

### M6 Mitarbeiter-App (PWA)

- [ ] Installierbar, Login, Sprache je Mitarbeiter (Start: Deutsch, Englisch; weitere über Übersetzungsdateien)
- [ ] Tagesansicht in Tourreihenfolge mit Karte, Zeitfenster, Zugang, Packliste, „Navigation starten“
- [ ] Einsatz: QR-Check-in/-out, Checkliste, Fotos, Mängel, „Material leer“, Notizen, Stammdaten-Korrekturen
- [ ] Vor-Ort-Änderung: Leistung aus Preisliste, „nur heute“ oder „dauerhaft“, Unterschrift oder Bestätigungs-Mail
- [ ] Offline: Tagesdaten lokal (Dexie), Aktionen in Warteschlange, Sync bei Netz, Konfliktregel „letzte Änderung gewinnt“ je Feld
- [ ] Zeiterfassung aus Check-in/-out, Pausen, Korrektur nur durch das Büro mit Protokoll

Fertig, wenn: ein ganzer Tag im Flugmodus abgearbeitet und danach korrekt synchronisiert wird.

### M7 Leistungsnachweis und Zeiten

- [ ] Nachweis-PDF je Einsatz oder Monat (Zeiten, Checkliste, Fotos, Unterschrift), automatischer Versand per Resend
- [ ] Nachträge und Vertragsversionen aus der App landen im Büro zur Sichtung
- [ ] Arbeitszeitliste je Mitarbeiter und Monat (Beginn, Ende, Dauer) als PDF/CSV für die Aufzeichnungspflicht
- [ ] Mängel-Liste je Objekt mit Status

Fertig, wenn: Kunde und Inhaber nach einem Einsatz automatisch den richtigen Nachweis haben.

### M8 Inventar und Prognose

- [ ] `lagerort` (Lager, Fahrzeug, Objekt), `bestand`, `lagerbewegung` (Zugang, Abgang Einsatz, Umbuchung, Korrektur)
- [ ] Abbuchung beim Abschluss eines Einsatzes nach `vorlage_bedarf`, Verbrauch je Objekt überschreibbar
- [ ] Packliste je Tour aus geplantem Bedarf minus Fahrzeugbestand, „geladen“ bucht um
- [ ] Fachlogik `domain/prognose`: Reichweite, Mindestbestand, Bestellvorschlag (Menge für etwa 4 Wochen), Ist-Korrektur aus „leer“-Meldungen
- [ ] **Verschleiß mit echtem Austausch** (siehe Konzept): Zähler je Werkzeug ab dem tatsächlichen Wechsel, kein Übertrag, Wechsel nachträglich datierbar, Lerneffekt für die Lebensdauer, optional Auto-Wechsel für billige Teile
- [ ] Prüftermine für Geräte mit Warnung in der App
- [ ] Einkaufsliste, Wareneingang, Inventur-Korrektur
- [ ] Unit-Tests mit den beiden Szenarien aus dem Konzept als Testfälle

Fertig, wenn: die Szenarien aus dem Konzept als Tests grün sind und das Dashboard Reichweiten zeigt.

## Meilensteine M9–M12: Geld rein, Kunden rein

Diese Meilensteine machen aus dem Werkzeug ein Produkt, das man verkaufen kann.

### M9 Rechnung und E-Rechnung

- [ ] `rechnung`, `rechnungsposition`, fortlaufende Nummernkreise je Betrieb, Storno statt Löschen
- [ ] Fachlogik `domain/rechnung`: Monatslauf aus Vertragsversionen (anteilig bei Wechsel im Monat), erledigten Einsätzen nach Aufwand und Nachträgen
- [ ] Prüfansicht „Rechnungen für November“, Versand mit einem Klick, Zahlungsstatus manuell
- [ ] `domain/erechnung`: XRechnung (UBL) und ZUGFeRD (PDF/A-3 mit eingebettetem XML) nach EN 16931; Leitweg-ID für öffentliche Auftraggeber; Kleinunternehmer-Hinweis
- [ ] Validierung mit dem KoSIT-Validator in der CI (Docker), Testrechnungen als Fixtures
- [ ] DATEV-Export (CSV) für den Steuerberater

Fertig, wenn: der Monatslauf für drei Testkunden korrekte Rechnungen erzeugt und alle E-Rechnungen den Validator bestehen.

### M10 Anfrage, Angebot, Online-Buchung

- [ ] Anfrageformular (einbettbar auf der Website des Betriebs), Anfrage-Liste im Büro
- [ ] Angebot aus Vorlagen und Preisliste, PDF, Annahme per Link; bei Annahme werden Kunde, Objekt und Vertragsentwurf angelegt
- [ ] Fensterreinigung Privat: Preisrechner (Fensteranzahl und -typ), freie Termine aus der Planung, Buchung und Bestätigung

Fertig, wenn: eine Anfrage ohne Abtippen bis zum aktiven Vertrag durchläuft.

### M11 Abo, Onboarding, Rechtliches

- [ ] Stripe Billing: Pakete Solo/Team/Betrieb, 30 Tage Test, SEPA-Lastschrift, Kundenportal, Webhooks setzen Funktionsgrenzen
- [ ] Onboarding-Assistent: Firmendaten, Branche wählen (Seed aus M3), Import, erster Mitarbeiter
- [ ] Impressum, Datenschutzerklärung, AGB, Auftragsverarbeitungsvertrag (Texte von Anwalt oder Generator, nicht von mir)
- [ ] Landingpage mit Preisen

Fertig, wenn: ein fremder Betrieb sich selbst registrieren, testen und bezahlen kann.

### M12 Pilot und Härtung

- [ ] 3 Pilotbetriebe einrichten, wöchentliches Feedback
- [ ] Fehler-Tracking (Sentry), Backups prüfen, Ladezeiten der App auf schwachem Netz messen
- [ ] Hilfe-Seiten und kurze Videos für die häufigsten Abläufe
- [ ] Liste für „Später“ aus dem Pilot-Feedback priorisieren

Fertig, wenn: die Piloten 4 Wochen täglich damit arbeiten (Prüfung 2 aus dem Konzept).

## Tests, Qualität, Definition of Done

Geld, Zeiten und Mandantentrennung werden am strengsten getestet, weil Fehler dort teuer oder rechtlich heikel sind.

- **Fachlogik** (`src/domain`): ohne Datenbank, mit Vitest; Serien, Planung, Prognose, Verschleiß, Rechnungslauf, E-Rechnung je mit Szenario-Tests
- **RLS:** pgTAP-Test für jede neue Tabelle, dass Betrieb B nichts von Betrieb A sieht
- **E2E:** Playwright für die Hauptwege: Registrierung, Vertrag anlegen, Einsatz in der App abschließen, Monatsrechnung
- **Migrationen:** nur vorwärts, nie bestehende Migrationen ändern
- **Entscheidungen:** größere Weichen als kurze Notiz in `docs/adr/`

**Definition of Done je Aufgabe**

- [ ] Lint, Typecheck, alle Tests grün in der CI
- [ ] Neue Tabellen haben `betrieb_id`, RLS und einen pgTAP-Test
- [ ] Oberfläche auf dem Handy geprüft (Mitarbeiter-App) bzw. auf dem Laptop (Büro)
- [ ] CHANGELOG-Eintrag, Haken in diesem Plan

## Offene Entscheidungen

Diese Punkte brauche ich von dir, spätestens zum genannten Meilenstein.

- [ ] Produktname und Domain (vor M11)
- [ ] Google Maps oder Mapbox (vor M5)
- [x] Neues Repo oder Teile aus Rently Yours übernehmen (vor M0) → **neues Repo** (ADR 0001)
- [ ] Welche Sprachen die Mitarbeiter-App zum Start braucht (vor M6)
- [ ] Sollen Mitarbeiter auch freie Positionen anlegen dürfen oder nur aus der Preisliste (vor M6)
- [ ] Pilotbetriebe: wer, ab wann (vor M12)
