import "server-only";
import { type Koordinate, type Matrix, schaetzeMatrix } from "@/domain/planung";

/**
 * Mapbox-Anbindung (Geocoding, Fahrzeit-Matrix). Alles läuft serverseitig mit MAPBOX_TOKEN.
 * Ohne Token oder bei Fehlern greift die Luftlinien-Schätzung, damit die Planung immer funktioniert.
 *
 * Hinweis Nutzungsbedingungen: Gespeicherte Geocoding-Ergebnisse brauchen bei Mapbox den
 * Endpunkt mit `permanent=true` (kostenpflichtig, aber günstig). Mit MAPBOX_GEOCODING_PERMANENT=false
 * lässt er sich abschalten (z. B. für Tests ohne Zahlungsdaten).
 */

const BASIS = "https://api.mapbox.com";
/** Mapbox Matrix erlaubt höchstens 25 Koordinaten je Anfrage (driving). */
export const MATRIX_MAX = 25;

export function mapboxToken(): string | null {
  return process.env.MAPBOX_TOKEN || null;
}

export type Adresse = {
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land?: string | null;
};

export type GeocodeErgebnis = Koordinate & { genauigkeit: string | null; text: string };

export function adressText(a: Adresse): string {
  return [a.strasse, [a.plz, a.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

/** Adresse → Koordinate. Gibt null zurück, wenn nichts gefunden wurde oder kein Token gesetzt ist. */
export async function geocode(
  a: Adresse,
  f: typeof fetch = fetch,
): Promise<GeocodeErgebnis | null> {
  const token = mapboxToken();
  const q = adressText(a);
  if (!token || !q) return null;
  const params = new URLSearchParams({
    q,
    country: (a.land ?? "DE").toLowerCase(),
    language: "de",
    limit: "1",
    types: "address,street,postcode,place",
    access_token: token,
  });
  if (process.env.MAPBOX_GEOCODING_PERMANENT !== "false") params.set("permanent", "true");
  const r = await f(`${BASIS}/search/geocode/v6/forward?${params}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Mapbox Geocoding: HTTP ${r.status}`);
  const json = (await r.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: { full_address?: string; match_code?: { confidence?: string } };
    }[];
  };
  const f0 = json.features?.[0];
  const c = f0?.geometry?.coordinates;
  if (!c) return null;
  return {
    lng: c[0],
    lat: c[1],
    genauigkeit: f0?.properties?.match_code?.confidence ?? null,
    text: f0?.properties?.full_address ?? q,
  };
}

/** Fahrzeit-Matrix in Minuten über Mapbox (driving-traffic nicht nötig für Tagesplanung). */
export async function mapboxMatrix(punkte: Koordinate[], f: typeof fetch = fetch): Promise<Matrix> {
  const token = mapboxToken();
  if (!token) throw new Error("MAPBOX_TOKEN fehlt");
  if (punkte.length > MATRIX_MAX) throw new Error(`höchstens ${MATRIX_MAX} Punkte`);
  const koordinaten = punkte.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const params = new URLSearchParams({ annotations: "duration", access_token: token });
  const r = await f(`${BASIS}/directions-matrix/v1/mapbox/driving/${koordinaten}?${params}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Mapbox Matrix: HTTP ${r.status}`);
  const json = (await r.json()) as { code?: string; durations?: (number | null)[][] };
  if (json.code !== "Ok" || !json.durations) throw new Error(`Mapbox Matrix: ${json.code}`);
  const schaetzung = schaetzeMatrix(punkte);
  // Sekunden → Minuten; nicht routbare Paare (null) mit der Schätzung füllen
  return json.durations.map((zeile, i) =>
    zeile.map((s, j) => (s === null ? schaetzung[i]![j]! : Math.round(s / 60))),
  );
}

export type FahrzeitErgebnis = { matrix: Matrix; quelle: "mapbox" | "schaetzung" };

/**
 * Fahrzeiten zwischen allen Punkten. Punkte ohne Koordinate werden geschätzt.
 * Fällt Mapbox aus oder fehlt der Token, wird komplett geschätzt.
 */
export async function fahrzeiten(
  punkte: (Koordinate | null)[],
  f: typeof fetch = fetch,
): Promise<FahrzeitErgebnis> {
  const schaetzung = schaetzeMatrix(punkte);
  const bekannt = punkte.flatMap((p, i) => (p ? [i] : []));
  if (!mapboxToken() || bekannt.length < 2 || bekannt.length > MATRIX_MAX) {
    return { matrix: schaetzung, quelle: "schaetzung" };
  }
  try {
    const teil = await mapboxMatrix(
      bekannt.map((i) => punkte[i]!),
      f,
    );
    const matrix = schaetzung.map((z) => [...z]);
    bekannt.forEach((i, a) =>
      bekannt.forEach((j, b) => {
        matrix[i]![j] = teil[a]![b]!;
      }),
    );
    return { matrix, quelle: "mapbox" };
  } catch (e) {
    console.error("Mapbox Matrix fehlgeschlagen, nutze Schätzung:", (e as Error).message);
    return { matrix: schaetzung, quelle: "schaetzung" };
  }
}

export { kodierePolyline, tourKarteUrl } from "./kartenbild";
