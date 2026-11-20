import type { Koordinate } from "@/domain/planung";

/** Kartenbilder (Mapbox Static Images). Ohne server-only, damit auch die App sie nutzen kann. */
const BASIS = "https://api.mapbox.com";

/**
 * URL für ein statisches Kartenbild (Static Images API) mit nummerierten Stopps.
 * Nutzt den öffentlichen Token (NEXT_PUBLIC_MAPBOX_TOKEN, in Mapbox auf die eigene Domain beschränken).
 */
export function tourKarteUrl(
  start: Koordinate | null,
  stopps: (Koordinate | null)[],
  groesse = { breite: 640, hoehe: 360 },
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const marker: string[] = [];
  if (start) marker.push(`pin-s-building+374151(${start.lng.toFixed(5)},${start.lat.toFixed(5)})`);
  stopps.forEach((p, i) => {
    if (p && i < 99) marker.push(`pin-s-${i + 1}+2563eb(${p.lng.toFixed(5)},${p.lat.toFixed(5)})`);
  });
  if (!marker.length) return null;
  const linie = [start, ...stopps, start].filter((p): p is Koordinate => p !== null);
  const pfad =
    linie.length >= 2 ? `path-2+2563eb-0.6(${encodeURIComponent(kodierePolyline(linie))}),` : "";
  return `${BASIS}/styles/v1/mapbox/streets-v12/static/${pfad}${marker.join(",")}/auto/${groesse.breite}x${groesse.hoehe}@2x?padding=40&access_token=${token}`;
}

/** Google-Polyline-Kodierung (Präzision 5), wie von der Static Images API erwartet. */
export function kodierePolyline(punkte: Koordinate[]): string {
  let ergebnis = "";
  let vorLat = 0;
  let vorLng = 0;
  const kodiere = (wert: number) => {
    let v = wert < 0 ? ~(wert << 1) : wert << 1;
    let s = "";
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const p of punkte) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    ergebnis += kodiere(lat - vorLat) + kodiere(lng - vorLng);
    vorLat = lat;
    vorLng = lng;
  }
  return ergebnis;
}
