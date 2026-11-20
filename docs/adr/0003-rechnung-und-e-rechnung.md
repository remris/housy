# ADR 0003: Rechnung und E-Rechnung

Status: angenommen · Datum: 2026-11-20 · Meilenstein M9

## Kontext

Rechnungen müssen die Pflichtangaben nach § 14 UStG enthalten, lückenlos nummeriert und nach GoBD
unveränderlich sein. Für Geschäftskunden wird die E-Rechnung Pflicht (Empfang seit 2025, Ausstellung
ab 2027/2028), öffentliche Auftraggeber verlangen XRechnung mit Leitweg-ID.

## Entscheidungen

1. **Nummer erst beim Festschreiben.** Entwürfe haben keine Nummer und dürfen gelöscht werden.
   `rechnung_festschreiben` vergibt die Nummer über den vorhandenen Nummernkreis
   (`naechste_nummer`, Art `rechnung-<Jahr>`, lückenlos per Zeilensperre), friert Absender- und
   Empfängerdaten in `rechnung.daten` ein und setzt das Rechnungsdatum.
2. **Unveränderlich nach dem Festschreiben.** Ein Trigger lässt nur Zahlung, Versand, Export,
   Ablagepfade (einmalig) und den Wechsel nach „storniert“ zu. Positionen sind gesperrt. PDF und XML
   werden einmal abgelegt (Bucket `rechnungen`, nur anlegen, kein Überschreiben/Löschen).
3. **Storno statt Löschen.** `rechnung_stornieren` legt eine Gutschrift (Typ 381) mit denselben
   Positionen und eigener Nummer an; die abgerechneten Leistungen werden wieder frei.
4. **Doppelabrechnung verhindern.** Tabelle `abrechnung` verknüpft Einsätze, Nachträge und
   Pauschalen (Version + Monat) mit der Rechnung; eindeutige Teilindizes gelten, solange die
   Rechnung nicht storniert ist (Entwürfe zählen mit).
5. **Eine Rechnung je Kunde, Objekt und Monat** im Monatslauf. Pauschalen werden bei Versionswechsel
   oder Vertragsbeginn/-ende im Monat taggenau anteilig berechnet, Aufwand aus erledigten Einsätzen
   (Stunden aus der Ist-Zeit, auf Viertelstunden gerundet), Nachträge einzeln.
6. **E-Rechnung im Profil XRechnung 3.0.** XRechnung als UBL (Invoice bzw. CreditNote). Das in das
   PDF eingebettete XML ist CII mit derselben XRechnung-Kennung (ZUGFeRD-Profil XRECHNUNG), damit
   beide mit dem KoSIT-Validator und der offiziellen XRechnung-Konfiguration geprüft werden können.
   Kleinunternehmer: Steuerkategorie E mit Befreiungsgrund § 19 UStG.
7. **ZUGFeRD-PDF**: react-pdf erzeugt das PDF (Noto Sans eingebettet), pdf-lib bettet das XML ein
   (AFRelationship Alternative) und setzt PDF/A-3b-Metadaten, sRGB-OutputIntent und Dokument-ID.
   Die PDF/A-Konformität ist nicht automatisch geprüft (veraPDF wäre der nächste Schritt).
8. **DATEV** als Buchungsstapel EXTF 700 mit Automatik-Erlöskonten (SKR 03/04), Debitor =
   10000 + Kundennummer, Windows-1252. Kontenwahl ist mit dem Steuerberater abzustimmen.

## Folgen

- Fachliche Prüfung vor dem Launch durch Steuerberater (siehe Konzept, Risiken).
- Nicht abgedeckt: Reverse Charge nach § 13b UStG (Gebäudereinigung an Gebäudereiniger),
  Abschlagsrechnungen, Skonto, Mahnwesen, § 35a-Ausweis für Privatkunden.
