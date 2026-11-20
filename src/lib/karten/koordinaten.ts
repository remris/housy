import "server-only";
import { type Adresse, adressText, geocode } from "./mapbox";

type MitKoordinaten = Adresse & { breitengrad: number | null; laengengrad: number | null };

/**
 * Ergänzt Koordinaten aus der Adresse, wenn keine eingetragen sind oder sich die Adresse
 * geändert hat, die Koordinaten aber nicht (dann gehören sie noch zur alten Adresse).
 * Von Hand eingetragene Koordinaten bleiben unangetastet. Fehler blockieren das Speichern nicht.
 */
export async function koordinatenErgaenzen<T extends MitKoordinaten>(
  neu: T,
  alt?: MitKoordinaten | null,
): Promise<{ daten: T; hinweis: string | null }> {
  const ohne = neu.breitengrad === null || neu.laengengrad === null;
  const adresseGeaendert = alt ? adressText(alt) !== adressText(neu) : false;
  const koordinatenAlt =
    !!alt &&
    Number(alt.breitengrad) === Number(neu.breitengrad) &&
    Number(alt.laengengrad) === Number(neu.laengengrad);
  if (!adressText(neu) || !(ohne || (adresseGeaendert && koordinatenAlt))) {
    return { daten: neu, hinweis: null };
  }
  try {
    const g = await geocode(neu);
    if (!g) {
      return {
        daten:
          adresseGeaendert && koordinatenAlt
            ? { ...neu, breitengrad: null, laengengrad: null }
            : neu,
        hinweis: process.env.MAPBOX_TOKEN
          ? "Adresse nicht auf der Karte gefunden – Koordinaten bitte von Hand eintragen."
          : null,
      };
    }
    return {
      daten: { ...neu, breitengrad: round6(g.lat), laengengrad: round6(g.lng) },
      hinweis: null,
    };
  } catch (e) {
    console.error("Geocoding fehlgeschlagen:", (e as Error).message);
    return { daten: neu, hinweis: "Kartendienst nicht erreichbar – Koordinaten folgen später." };
  }
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
