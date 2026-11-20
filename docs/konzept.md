# Konzept: Software für Gebäudereinigung, Hausmeister- und Fensterreinigung

Nov 20, 2026 · @chris

## Kurzfassung

Eine schlanke Cloud-Software mit Mitarbeiter-App für kleine Reinigungs-, Hausmeister- und Fensterputzbetriebe mit 1 bis 25 Mitarbeitern. Sie bildet den ganzen Ablauf ab: Objekt anlegen, Einsatz planen, vor Ort abhaken, Leistungsnachweis erzeugen, Rechnung schreiben.

Der Unterschied zum Markt ist die **Materialprognose**. Jede Auftragsvorlage weiß, welches Material und Werkzeug sie verbraucht. Aus dem Einsatzplan rechnet die Software aus, wann der Reiniger leer ist oder der Besen ersetzt werden muss, und erstellt die Einkaufsliste.

Die Positionierung: einfacher und günstiger als die ERP-Systeme der Großen und branchenspezifischer als allgemeine Handwerker- und Außendienst-Apps.

## Ablauf von Anfrage bis Rechnung

Jeder Schritt erzeugt den nächsten automatisch. Der Vertrag ist das Herzstück: Aus ihm entstehen Planung, Materialbedarf und Rechnung.

1. **Anfrage:** per Formular, Telefonnotiz oder Online-Preisrechner (Fenster)
2. **Angebot:** aus Vorlagen und Preisliste, als PDF an den Kunden; bei Zusage mit einem Klick zum Vertrag
3. **Stammdaten:** Kunde und Objekt werden aus der Anfrage übernommen und ergänzt (Zugang, Raumbuch, Fensteraufmaß)
4. **Vertrag:** Leistungen, Intervall, Reinigungsfenster, Preis, Laufzeit
5. **Planung:** Der Vertrag erzeugt die wiederkehrenden Einsätze im erlaubten Zeitfenster, die Disposition verteilt sie auf Mitarbeiter und Touren
6. **Einsatz vor Ort:** in der Mitarbeiter-App abarbeiten, Änderungswunsch direkt erfassen
7. **Nachweis:** automatisch per E-Mail an den Kunden
8. **Rechnung:** läuft automatisch zum Monatsende aus Vertrag, erledigten Einsätzen und Nachträgen
9. **Inventar:** jeder erledigte Einsatz bucht Material ab, die Prognose füllt die Einkaufsliste

## Markt und Wettbewerb

Der Markt ist besetzt, aber zweigeteilt. Oben gibt es ERP-Systeme für den Mittelstand, unten generische Außendienst-Apps. Viele kleine Betriebe arbeiten noch mit Excel, Papier und WhatsApp.

| Anbieter | Fokus | Preis (laut Anbieter/Verzeichnis) | Material/Lager |
| --- | --- | --- | --- |
| [fortytools by zvoove](https://www.softguide.de/programm/fortytools) | Gebäudedienste, kleine Betriebe | ab 49 €/Monat zzgl. MwSt. | Lagermanagement, Bestandsverwaltung |
| [Profacilo](https://www.softguide.de/programm/profacilo-software-fuer-gebaeudereinigung) | Gebäudereinigung komplett | ab 349 €/Monat zzgl. MwSt. | Lagermanagement |
| [Quick-GDLx](https://www.softguide.de/programm/quick-gdlx) | kleine und mittlere Reinigungsbetriebe, Cloud | auf Anfrage | nicht hervorgehoben |
| [Mendato](https://www.softguide.de/programm/mendato) | Eigen- und Fremdpersonal, Raumbuch | auf Anfrage | Produktverwaltung |
| [cleaning pro](https://www.softguide.de/programm/cleaning-pro-branchenloesung-fuer-gebaeudedienste/vorschau) | ERP für Gebäudedienstleister | auf Anfrage | Teil des ERP |
| [MR.Clean](https://www.softguide.de/programm/mrclean-software-fuer-gebaeudereiniger) | Bürolösung Gebäudereiniger | auf Anfrage | – |
| [hausmanager](https://www.getapp.com/all-software/a/hausmanager-2-0/) | Hausmeister, Facility | Kaufversion 3.200 €, Zusatzmodule | Lager und Material als Erweiterung |
| [iPM-Cloud](https://apps.apple.com/de/app/ipm-cloud-hausmeister-facility/id1528842785) | Hausmeister, Winterdienst | App | Material-Verbrauch |
| Jobber, ZenMaid, ServiceM8, Swept | international, Außendienst allgemein | US-Preise, meist englisch | kaum |

**Die Lücke:** Lager gibt es bei einigen Anbietern als Modul, aber als Bestandsliste. Eine Prognose aus dem Einsatzplan („Nach 20 Unterhaltsreinigungen ist der Kanister leer“) und Verschleiß pro Einsatz bewirbt keiner der geprüften Anbieter. Dazu kommt Fensterreinigung für Privatkunden mit Online-Preisrechner und Buchung, die in den Gebäudereiniger-ERPs kaum vorkommt.

Offene Frage: Demos von fortytools und Quick-GDLx ansehen, um die Lagerfunktionen genau zu prüfen.

## Zielgruppe und Nutzer

Zielkunden sind Inhaber kleiner Betriebe mit 1 bis 25 Mitarbeitern: Unterhaltsreinigung, Hausmeisterservice, Fensterputzer. Entschieden wird vom Inhaber, die App nutzen vor allem Mitarbeiter mit wenig Deutsch und wenig Zeit.

| Rolle | Gerät | Will vor allem |
| --- | --- | --- |
| Inhaber | Laptop, Handy | Planen, Rechnungen raus, Material nicht vergessen, Kosten pro Objekt sehen |
| Objektleiter / Vorarbeiter | Handy | Touren verteilen, Qualität prüfen, Mängel weitergeben |
| Reinigungskraft / Hausmeister | Handy (App) | Wissen, wo und was heute ansteht, abhaken, „Material leer“ melden |
| Endkunde (Hausverwaltung, Firma, Privat) | Browser, E-Mail | Nachweis sehen, Mängel melden, Fensterreinigung buchen |

Die Mitarbeiter-App muss deshalb mehrsprachig sein (mindestens Deutsch, Türkisch, Polnisch, Rumänisch, Arabisch, Englisch), mit großen Knöpfen und Symbolen statt Text.

## Kernfeatures (MVP)

Das MVP deckt den Kreislauf von Anfrage über Angebot und Vertrag bis zur automatischen Monatsrechnung ab, plus die Materialprognose als Verkaufsargument. Verträge und Änderungen vor Ort stehen im nächsten Abschnitt. Alles andere kommt später.

1. **Kunden und Objekte**
   - Kunde mit mehreren Objekten (Adresse, Ansprechpartner, Zugangshinweise, Fotos)
   - Raumbuch oder Bereichsliste je Objekt (Büro 1, Treppenhaus, Sanitär, 24 Fenster)
2. **Auftragsvorlagen (Leistungsverzeichnis)**
   - Vorlage = Tätigkeiten + Intervall + Sollzeit + Material- und Werkzeugbedarf
   - Beispiele: „Unterhaltsreinigung Büro“, „Treppenhaus wöchentlich“, „Fenster innen und außen“; dazu eine Preisliste für Angebote und Sonderleistungen
   - Wiederkehrende Aufträge erzeugen Einsätze automatisch (täglich, Mo/Mi/Fr, alle 6 Wochen)
3. **Einsatz- und Tourenplanung**
   - Wochenkalender pro Mitarbeiter, Einsätze per Drag-and-drop verschieben
   - Tagestour mit Reihenfolge und Fahrtzeit auf der Karte, Abwesenheiten und Urlaub berücksichtigt
4. **Mitarbeiter-App**
   - Heute-Ansicht: Objekte, Zugang, Checkliste, Packliste
   - Als PWA (Web-App aufs Handy), Ein- und Auschecken per QR-Code am Objekt, offline nutzbar
   - Fotos vorher/nachher, Mängel melden, „Material fast leer“ mit einem Tipp
5. **Zeiterfassung**
   - Arbeitszeit aus Check-in/Check-out, Pausen, Fahrtzeiten
   - Gebäudereinigung zählt zu den Branchen nach § 2a SchwarzArbG: Arbeitgeber müssen Beginn, Ende und Dauer der täglichen Arbeitszeit innerhalb von 7 Tagen aufzeichnen (§ 17 MiLoG), ebenso für alle Minijobber. Ausnahme nur für Beschäftigte mit hohem verstetigtem Monatsgehalt. Das ist ein starkes Verkaufsargument
6. **Leistungsnachweis**
   - Automatisches PDF je Einsatz oder Monat mit Zeiten, abgehakten Punkten, Fotos, optional Unterschrift
   - Versand per E-Mail an den Kunden
7. **Rechnung**
   - Automatischer Lauf zum Monatsende aus Verträgen, erledigten Einsätzen und Nachträgen; Inhaber prüft und versendet mit einem Klick. Abrechnungsarten: Monatspauschale, nach Aufwand (Stunden, Fenster, m²) oder Einzelauftrag
   - E-Rechnung als XRechnung und ZUGFeRD für Geschäftskunden (Ausstellungspflicht ab 2027 für Betriebe über 800.000 € Vorjahresumsatz, ab 2028 für alle außer Kleinunternehmer), normales PDF für Privatkunden; Export an DATEV, Lexware oder sevdesk statt eigener Buchhaltung
8. **Material und Inventar mit Prognose** (eigener Abschnitt unten)
9. **Dashboard**
   - Heute geplant/erledigt, offene Mängel, Material mit kurzer Reichweite, Soll- gegen Ist-Zeit je Objekt

## Verträge, mobile App und Änderungen vor Ort

Der Vertrag steuert die Planung. Jede Änderung, auch vor Ort beim Kunden, wird entweder ein Nachtrag für einen Einsatz oder eine neue Vertragsversion. Danach passen sich Planung und Rechnung von selbst an.

**Vertragsverwaltung**

| Feld | Beispiel |
| --- | --- |
| Parteien und Objekt | Hausverwaltung Müller, Hauptstraße 12 |
| Leistungen | Vorlagen „Treppenhaus“ und „Fenster innen/außen“ |
| Intervall je Leistung | Treppenhaus wöchentlich, Fenster alle 8 Wochen |
| Reinigungsfenster | Mo–Fr 7–10 Uhr, nicht an Feiertagen |
| Preis und Abrechnungsart | 420 € Monatspauschale, Sonderleistungen laut Preisliste |
| Laufzeit und Kündigungsfrist | 12 Monate, 3 Monate zum Laufzeitende |
| Status | Entwurf, aktiv, gekündigt, beendet |

- Verträge haben **Versionen** mit Gültigkeitsdatum. Eine Änderung erzeugt Version 2 ab einem Stichtag. Vergangene Einsätze bleiben unverändert, künftige werden neu geplant.
- Vertrag als PDF erzeugen und digital unterschreiben lassen, Vorlage für Vertragstexte ist anpassbar.
- Warnungen: Vertrag läuft aus, Preisanpassung fällig.

**Mobile App für Mitarbeiter (PWA)**

- Startet als Web-App ohne App-Store, aufs Handy gespeichert, funktioniert offline
- Tagesansicht: die nächsten Einsätze in Tourreihenfolge mit Karte, Zeitfenster, Zugangshinweis und Packliste
- „Navigation starten“ öffnet Google Maps oder Apple Karten zum nächsten Objekt
- Vor Ort: einchecken, Checkliste, Fotos, Mängel, Material leer, auschecken
- Daten bearbeiten: Notizen, Zugangshinweise, Fensteraufmaß korrigieren (Änderungen an Stammdaten sieht das Büro im Verlauf)

**Szenario: Kunde will vor Ort mehr**

Bei Einsatz 4 von 7 möchte der Kunde zusätzlich die Kellerfenster.

&#91;embedded content: Änderung vor Ort · Nachtrag oder neue Vertragsversion\]

Die einzige Frage an den Mitarbeiter ist „nur heute oder dauerhaft“; den Rest erledigt die Software.

1. Mitarbeiter tippt „Leistung hinzufügen“ und wählt aus der Preisliste „Fenster Keller“, Anzahl 6. Der Preis kommt aus der Liste, Freitext-Leistungen braucht eine Freigabe im Büro.
2. Er wählt: **nur heute** oder **ab jetzt dauerhaft**.
3. Kunde unterschreibt auf dem Handy. Ohne Unterschrift geht es trotzdem weiter: Der Kunde bekommt eine Bestätigungs-Mail mit der Änderung, der Status steht auf „mündlich vereinbart“.
4. **Nur heute:** Nachtrag am Einsatz, landet automatisch auf der Monatsrechnung, Material wird mit abgebucht.
5. **Dauerhaft:** Neue Vertragsversion ab heute, künftige Einsätze bekommen die Leistung, Preis und Sollzeit steigen.
6. Die Tour rechnet die Ankunftszeiten für Einsätze 5 bis 7 neu. Wird ein Zeitfenster gerissen, sieht das Büro eine Warnung.

Rechte: Mitarbeiter dürfen nur Leistungen aus der Preisliste hinzufügen. Preise, Rabatte und Kündigungen bleiben beim Inhaber.

## Material und Inventar mit Verbrauchsprognose

Ja, das lohnt sich, und zwar als Prognose statt als reine Bestandsliste. Der Betrieb pflegt einmal, was eine Auftragsvorlage verbraucht. Die Software rechnet daraus Reichweite, Ersatzzeitpunkte, Einkaufsliste und Materialkosten pro Objekt.

&#91;embedded content: Materialprognose · Kreislauf aus Plan, Abbuchung und Korrektur\]

Oben läuft die Vorhersage, unten die Wirklichkeit: Jeder erledigte Einsatz bucht ab, jede Meldung „leer“ macht die Vorlage genauer.

**Drei Arten von Artikeln**

| Art | Beispiel | Verbrauchsregel | Auslöser |
| --- | --- | --- | --- |
| Verbrauchsmaterial | Allzweckreiniger 10 l, Müllbeutel, WC-Reiniger | Menge pro Einsatz, pro m² oder pro Fenster | Bestand unter Mindestbestand oder Reichweite unter X Tagen |
| Verschleißteile | Besen, Mopp-Bezug, Abzieher-Gummi, Mikrofasertücher | Lebensdauer in Einsätzen, Stunden oder Wäschen | z. B. nach 100 Einsätzen ersetzen |
| Geräte mit Prüfpflicht | Staubsauger, Scheuersaugmaschine, Leiter | Prüfintervall, z. B. jährlich | Prüftermin fällig (elektrische Geräte, Leitern) |

**So rechnet die Prognose**

1. Vorlage „Unterhaltsreinigung Büro“ enthält z. B. 0,5 l Allzweckreiniger und 3 Müllbeutel pro Einsatz, dazu Verschleiß: 1 Besen pro 100 Einsätze.
2. Der Einsatzplan der nächsten Wochen sagt, wie viele Einsätze mit dieser Vorlage anstehen.
3. Daraus folgt der geplante Verbrauch pro Woche und die Reichweite: 10-l-Kanister bei 0,5 l pro Einsatz = 20 Einsätze.
4. Jeder abgeschlossene Einsatz bucht den Sollverbrauch vom Lagerort ab.
5. Unterschreitet ein Artikel den Mindestbestand oder die Reichweite, landet er auf der Einkaufsliste, mit Lieferant und Bestellmenge.
6. Meldet ein Mitarbeiter „leer“ früher als berechnet, korrigiert die Software den Verbrauchswert der Vorlage (Ist statt Soll). So wird die Prognose mit der Zeit genauer.

**Lagerorte statt einem Lager**

- Zentrallager, Fahrzeug je Mitarbeiter, Putzkammer im Objekt
- Umbuchen per App („2 Kanister ins Auto“)
- Packliste je Tour: was heute für die geplanten Einsätze ins Fahrzeug muss

**Szenario 1: Reinigungsbetrieb, Verbrauchsmaterial über mehrere Lagerorte**

Ausgangslage: Zentrallager 4 Kanister Allzweckreiniger à 10 l (40 l), im Auto von Mitarbeiter A ein angebrochener Kanister mit 6 l, das Auto von Mitarbeiter B ist leer. Vorlage „Unterhaltsreinigung Büro“: 0,5 l pro Einsatz. Geplant sind 15 Einsätze pro Woche (A: 6, B: 9), also 7,5 l. Mindestbestand Zentrallager: 20 l, Lieferzeit 5 Tage.

1. **Montag, Packliste:** A braucht 3 l und hat 6 l, also nichts mitnehmen. B braucht 4,5 l und hat nichts, die App zeigt „1 Kanister Allzweckreiniger einladen“. B tippt „geladen“: Zentrallager 30 l, Auto B 10 l.
2. **Jeder erledigte Einsatz** bucht 0,5 l vom Auto des Mitarbeiters ab. Ende Woche 1: Auto A 3 l, Auto B 5,5 l, Zentrallager 30 l.
3. **Montag Woche 2:** A braucht wieder 3 l und hat genau 3 l. Mit Puffer schlägt die App „1 Kanister einladen“ vor. Zentrallager fällt auf 20 l und erreicht den Mindestbestand.
4. **Einkaufsliste:** „3 Kanister Allzweckreiniger beim Großhändler“ (Bestellmenge = etwa 4 Wochen Verbrauch). Der Inhaber bestellt, bei Lieferung bucht er den Wareneingang mit einem Tipp.
5. **Ist-Korrektur:** In Woche 3 meldet B „Kanister leer“, obwohl laut Plan noch 2 l drin sein müssten. Die Software zeigt: In B’s Objekten werden eher 0,6 l pro Einsatz verbraucht. Der Inhaber übernimmt den Wert für diese Objekte (Verbrauch kann je Objekt von der Vorlage abweichen). Die Prognose rechnet neu.

**Szenario 2: Fensterputzer allein, Verschleiß, Prüftermin und Vertragsänderung**

Ausgangslage: Abziehergummi hält laut Artikel 500 Fenster, der Zähler steht seit dem letzten Wechsel bei 380. Im Lager liegen 2 Ersatzgummis, Mindestbestand 2. Die Leiter hat einen jährlichen Prüftermin, fällig in 14 Tagen.

1. **Prognose:** Nächste Woche sind 140 Fenster geplant. Die Grenze von 500 wird voraussichtlich am Donnerstag erreicht.
2. **Montag, Packliste:** „Ersatz-Abziehergummi mitnehmen“. Beim Wechsel tippt er „gewechselt“, der Zähler steht wieder auf 0, im Lager ist noch 1 Gummi.
3. **Einkaufsliste:** Der Bestand liegt unter dem Mindestbestand, also „2 Abziehergummis bestellen“.
4. **Prüftermin:** Das Dashboard zeigt „Leiter prüfen bis …“. Ist die Prüfung überfällig, warnt die App bei jedem Einsatz, dessen Vorlage die Leiter braucht.
5. **Vertragsänderung:** Ein Kunde nimmt die Kellerfenster dauerhaft dazu (+6 Fenster alle 4 Wochen, Vertragsversion 2). Der geplante Verbrauch an Fensterreiniger und Gummi steigt automatisch, Reichweite und nächster Wechsel verschieben sich entsprechend, ohne dass er etwas im Lager einstellen muss.

**Regeln für Verschleiß: gezählt wird ab dem echten Wechsel**

Niemand wechselt genau bei 500. Deshalb setzt nur der tatsächliche Austausch den Zähler zurück, die Lebensdauer ist eine Empfehlung, kein Konto.

- **Kein Übertrag:** Wird der Gummi erst bei 700 Fenstern gewechselt, startet der neue bei 0 und hat volle 500. Die 200 darüber erscheinen nur als „überfällig seit 200 Fenstern“.
- **Wechsel jederzeit melden:** Knopf „Gewechselt“ in der App und im Büro, auch früher als geplant (z. B. bei 350, weil gerissen).
- **Nachträglich datieren:** „Gewechselt am Dienstag“ oder „beim Einsatz Hauptstraße 12“. Der Zähler rechnet die Einsätze ab diesem Zeitpunkt neu.
- **Stufen statt Zwang:** ab 80 % Hinweis, ab 100 % „fällig“ auf der Packliste, danach „überfällig“ im Dashboard. Gesperrt wird nichts.
- **Lebensdauer lernt mit:** Aus den echten Wechseln (z. B. im Schnitt bei 680) schlägt die Software vor, die Lebensdauer anzupassen. Der Inhaber entscheidet. Frühe Wechsel wegen Defekt zählen getrennt.
- **Je Werkzeug, nicht je Artikel:** Jeder Abzieher bzw. jedes Gerät hat seinen eigenen Zähler und einen Besitzer (Mitarbeiter oder Fahrzeug), damit zwei Leute nicht denselben Zähler teilen.
- **Auto-Wechsel für Kleinkram (optional je Artikel):** Für billige Teile wie Mikrofasertücher nimmt die Software bei Erreichen der Lebensdauer automatisch einen Wechsel an und bucht ein Teil aus dem Lager ab. Wer anders gewechselt hat, korrigiert mit einem Tipp.

**Warum das Kunden überzeugt**

- Kein Einsatz ohne Material mehr, keine Notfahrt zum Großhandel
- Materialkosten pro Objekt sichtbar, damit realistischere Angebote und ein echter Deckungsbeitrag
- Prüftermine für Geräte und Leitern nicht mehr vergessen

**Bewusst einfach halten:** Startwerte als Branchenvorlagen mitliefern (typische Verbräuche je Vorlage), damit niemand bei null anfangen muss. Keine Chargen, keine Inventurbögen im MVP.

## Branchenmodule

Ein gemeinsamer Kern, drei Vorlagen-Pakete. Der Kunde wählt beim Start seine Branche, bekommt passende Vorlagen, Checklisten und Materiallisten und kann alle drei kombinieren.

| Modul | Typische Aufträge | Besondere Funktionen | Abrechnung |
| --- | --- | --- | --- |
| Gebäudereinigung | Unterhaltsreinigung, Treppenhaus, Grundreinigung, Bauendreinigung | Raumbuch mit Flächen und Intervallen, Qualitätskontrolle mit Punkteschema, Sollzeit je Bereich | Monatspauschale je Objekt, Sonderleistungen extra |
| Hausmeisterservice | Objektrundgang, Grünpflege, Winterdienst, Mülltonnen, Kleinreparaturen | Rundgang-Checklisten, Zählerstände mit Foto, Winterdienst-Protokoll mit Uhrzeit und Wetter als Haftungsnachweis, Mängel direkt an die Hausverwaltung | Pauschale plus Stunden und Material nach Aufwand |
| Fensterreinigung | Gewerbe im festen Intervall, Privathaushalte auf Abruf | Aufmaß je Objekt (Anzahl und Typ der Fenster, Rahmen ja/nein, Etage, Hilfsmittel), Wetter-Verschieben mit einem Klick, Online-Preisrechner und Buchung für Privatkunden | Preis pro Fenster oder m², Intervall-Rabatt |

Der Online-Buchungsteil für Fensterreinigung ähnelt dem Mietshop aus Rently Yours: Preisrechner, freie Termine, Buchung, Bestätigung. Diese Bausteine lassen sich wiederverwenden.

## Spätere Ausbaustufen

Erst bauen, wenn zahlende Kunden danach fragen.

- **Kundenportal:** Nachweise, Rechnungen, Mängel melden, Zusatzleistung anfragen
- **Angebotskalkulation:** Flächen und Intervalle rein, Stunden, Material und Preis raus; später per KI aus Fotos oder Grundriss
- **Bestellung beim Lieferanten:** Einkaufsliste direkt als Bestellung an den Großhändler
- **Automatische Routenoptimierung** für viele Einsätze am Tag
- **Lohn-Export** mit Zuschlägen (Nacht, Sonntag) an DATEV Lohn
- **Subunternehmer** einplanen und abrechnen
- **NFC-Tags** statt QR-Code für manipulationssicheres Einchecken
- **Geräteverwaltung** mit Reparaturen und Kosten pro Gerät

## Datenmodell und Technik

Mandantenfähige Web-App plus Mitarbeiter-App auf einer Postgres-Datenbank. Der Stack passt zu deinen bisherigen Projekten.

**Kernobjekte**

| Objekt | Wichtige Felder | Hängt an |
| --- | --- | --- |
| Betrieb (Mandant) | Name, Branche(n), Tarif | – |
| Kunde | Name, Typ (Firma, Verwaltung, Privat), Rechnungsadresse | Betrieb |
| Objekt | Adresse, Geo, Zugang, Bereiche/Raumbuch, Fensteraufmaß | Kunde |
| Auftragsvorlage | Tätigkeiten, Sollzeit, Intervall | Betrieb |
| Vorlagen-Bedarf | Artikel, Menge, Bezugsgröße (Einsatz, m², Fenster, Stunde) | Auftragsvorlage, Artikel |
| Vertrag / Serie | Objekt, Vorlage, Wiederholung, Preis | Objekt |
| Einsatz | Datum, Mitarbeiter, Status, Check-in/out, Fotos, Checkliste | Serie oder Einzelauftrag |
| Mitarbeiter | Rolle, Sprache, Verfügbarkeit, Fahrzeug | Betrieb |
| Artikel | Art (Verbrauch, Verschleiß, Gerät), Einheit, Gebinde, Preis, Lieferant, Mindestbestand, Lebensdauer, Prüfintervall | Betrieb |
| Lagerort und Bestand | Ort (Lager, Fahrzeug, Objekt), Menge | Artikel |
| Lagerbewegung | Zugang, Abgang durch Einsatz, Umbuchung, Korrektur | Bestand, Einsatz |
| Mangel / Ticket | Foto, Beschreibung, Status | Objekt, Einsatz |
| Rechnung | Positionen, Zeitraum, Export-Status | Kunde |

**Technik-Vorschlag**

- Web: Next.js auf Vercel (Functions in fra1) mit Supabase in Frankfurt (Postgres, Auth, Storage, Row Level Security mit betrieb\_id auf jeder Tabelle von Anfang an); Stripe Billing mit SEPA-Lastschrift nur für die eigenen Abos
- Mitarbeiter-App: zuerst PWA mit Service Worker (Serwist), lokaler Speicherung (Dexie/IndexedDB) und Upload-Warteschlange; PowerSync, falls der Sync komplex wird; native App mit Expo, wenn NFC wichtig wird
- Karten und Fahrzeiten: Mapbox oder Google Directions; für Optimierung später OSRM oder ein Routing-Dienst
- Dokumente: PDFs mit @react-pdf/renderer, E-Rechnung als XRechnung/ZUGFeRD, Versand per Resend; automatische Jobs (Monatsrechnung, Einsätze aus Verträgen, Materialprognose) per pg\_cron, später Inngest oder Trigger.dev; DATEV-Export als CSV, API später
- Hosting und Datenbank in der EU, Auftragsverarbeitungsvertrag für Kunden bereitstellen
- Standort der Mitarbeiter nur beim Ein- und Auschecken speichern, kein Dauer-Tracking: das ist datenschutzfreundlicher und erleichtert die Akzeptanz

## Preismodell und Vertrieb

Vorschlag: drei Pakete nach Mitarbeiterzahl, zwischen fortytools (ab 49 €) und Profacilo (ab 349 €). Die Preise sind Startannahmen und werden in den ersten Kundengesprächen getestet.

| Paket | Für | Preis/Monat (netto) | Enthalten |
| --- | --- | --- | --- |
| Solo | Einzelunternehmer, z. B. Fensterputzer | 29 € | 1 Nutzer, Objekte, Vorlagen, Nachweis, Rechnung, Online-Buchung |
| Team | bis 10 Mitarbeiter | 79 € | alles aus Solo, Mitarbeiter-App, Touren, Zeiterfassung, Materialprognose |
| Betrieb | bis 25 Mitarbeiter | 149 € | alles aus Team, mehrere Lagerorte, Kundenportal, Exporte |

**Vertrieb**

- 30 Tage kostenlos testen, Einrichtung mit Excel-Import für Kunden, Objekte, Mitarbeiter
- Kostenlose Werkzeuge als Lockmittel: Fensterreinigungs-Preisrechner, Materialbedarfs-Rechner, Vorlage für Leistungsverzeichnis
- Google Ads und SEO auf Suchbegriffe wie „Software Gebäudereinigung“, „Hausmeister App“, „Fensterputzer Software“
- Lokal starten: 5 bis 10 Betriebe in Baden-Württemberg direkt ansprechen, als Pilotkunden mit Rabatt gegen Feedback
- Großhändler für Reinigungsbedarf als Partner: Materialprognose führt zu Bestellungen bei ihnen

## Roadmap, Risiken, nächste Schritte

Vier Phasen, jede endet mit einer Prüfung, ob es weitergeht. Die Monatsangaben sind Schätzungen für nebenberufliche Arbeit.

&#91;embedded content: Roadmap · 4 Phasen, 3 Prüfungen\]

Gebaut wird erst, wenn Phase 1 zeigt, dass Betriebe den Pilot wirklich wollen.

**Risiken**

| Risiko | Gegenmaßnahme |
| --- | --- |
| Kleine Betriebe sind preissensibel und wechseln ungern | Excel-Import, persönliche Einrichtung, Solo-Paket als Einstieg |
| Materialpflege ist lästig, niemand trägt Verbräuche ein | Branchenvorlagen mit Startwerten, „leer“-Knopf korrigiert automatisch |
| Mitarbeiter nutzen die App nicht | Mehrsprachig, Symbole, nur 3 Knöpfe für den Alltag |
| Support frisst die Freizeit neben dem Job | Videoanleitungen, Hilfe-Center, kleine Pilotgruppe |
| Zeiterfassung und Rechnung haben rechtliche Anforderungen | Vor dem Launch durch Steuerberater bzw. Anwalt prüfen lassen |

**Nächste Schritte**

- [ ] 5 Inhaber (Reinigung, Hausmeister, Fensterputzer) interviewen: Wie planen sie heute, wie oft fehlt Material, was zahlen sie?
- [ ] Demos von fortytools und Quick-GDLx ansehen, Lagerfunktionen prüfen
- [ ] Klickbaren Prototyp der Mitarbeiter-App und der Materialprognose bauen
- [ ] Namen und Domain prüfen
- [ ] Entscheiden: als eigenes Produkt oder auf Basis der Rently-Yours-Codebasis
