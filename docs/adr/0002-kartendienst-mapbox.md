# ADR 0002: Kartendienst Mapbox

Datum: 2026-11-20 · Status: entschieden (Inhaber)

## Kontext

M5 braucht Geocoding (Objektadresse → Koordinate) und Fahrzeiten zwischen Objekten für die
Tagestour. Zur Wahl standen Google Maps Platform und Mapbox (Entwicklungsplan, offene Entscheidung).

## Entscheidung

Mapbox:

- Geocoding v6 mit `permanent=true`, weil Koordinaten dauerhaft am Objekt gespeichert werden
  (Nutzungsbedingungen). Abschaltbar über `MAPBOX_GEOCODING_PERMANENT=false`.
- Matrix API (`mapbox/driving`, bis 25 Punkte) für die Fahrzeiten einer Tagestour.
- Static Images API für Tourkarten im Büro (öffentlicher Token, auf die Domain beschränkt).

## Folgen

- Alles hinter `src/lib/karten/` gekapselt; die Fachlogik (`src/domain/planung.ts`) bekommt
  nur eine Fahrzeit-Matrix. Ein Wechsel des Anbieters betrifft nur diesen Ordner.
- Ohne Token oder bei Ausfall rechnet die Planung mit einer Luftlinien-Schätzung weiter
  (Umwegfaktor 1,3, 35 km/h, 3 min Parken) und zeigt die Quelle an.
- Zwei Variablen: `MAPBOX_TOKEN` (Server) und `NEXT_PUBLIC_MAPBOX_TOKEN` (Kartenbilder).
- Google Maps findet deutsche Adressen etwas zuverlässiger; nicht gefundene Adressen werden
  gemeldet und können von Hand verortet werden.
