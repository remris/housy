/**
 * Lagerbewegungen und Bestände (Zentrallager, Fahrzeuge, Putzkammer im Objekt).
 * Bewegungen werden nie geändert, Korrekturen sind neue Bewegungen. Die Datenbank führt den
 * Bestand per Trigger mit derselben Regel wie `bucheBewegung`.
 */

export type Bewegungsart = "zugang" | "abgang_einsatz" | "umbuchung" | "korrektur" | "wechsel";

export type Bewegung = {
  art: Bewegungsart;
  artikelId: string;
  menge: number;
  von: string | null;
  nach: string | null;
};

const runde = (x: number) => Math.round(x * 10_000) / 10_000;

/** Prüft, ob von/nach zur Art passen (wie der Check in der Datenbank). */
export function bewegungGueltig(b: Bewegung): boolean {
  if (!(b.menge > 0)) return false;
  switch (b.art) {
    case "zugang":
      return b.von === null && b.nach !== null;
    case "abgang_einsatz":
    case "wechsel":
      return b.von !== null && b.nach === null;
    case "umbuchung":
      return b.von !== null && b.nach !== null && b.von !== b.nach;
    case "korrektur":
      return (b.von === null) !== (b.nach === null);
  }
}

export type Bestaende = Map<string, number>;
export const bestandSchluessel = (lagerort: string, artikel: string) => `${lagerort}|${artikel}`;

/** Wendet eine Bewegung auf die Bestände an (Abgang darf ins Minus: Buchbestand ≠ Regal). */
export function bucheBewegung(bestaende: Bestaende, b: Bewegung): Bestaende {
  if (!bewegungGueltig(b)) throw new Error(`Ungültige Bewegung: ${JSON.stringify(b)}`);
  const neu = new Map(bestaende);
  const aendere = (ort: string, delta: number) => {
    const k = bestandSchluessel(ort, b.artikelId);
    neu.set(k, runde((neu.get(k) ?? 0) + delta));
  };
  if (b.von) aendere(b.von, -b.menge);
  if (b.nach) aendere(b.nach, b.menge);
  return neu;
}

export function bestand(bestaende: Bestaende, lagerort: string, artikel: string): number {
  return bestaende.get(bestandSchluessel(lagerort, artikel)) ?? 0;
}

/** Inventur: gezählte Menge → Korrekturbewegung mit der Differenz (null, wenn es stimmt). */
export function inventurKorrektur(
  lagerort: string,
  artikelId: string,
  buchbestand: number,
  gezaehlt: number,
): Bewegung | null {
  const diff = runde(gezaehlt - buchbestand);
  if (diff === 0) return null;
  return diff > 0
    ? { art: "korrektur", artikelId, menge: diff, von: null, nach: lagerort }
    : { art: "korrektur", artikelId, menge: -diff, von: lagerort, nach: null };
}

/**
 * Welcher Lagerort bei einem Einsatz abgebucht wird: Fahrzeug der Tour, sonst Standardfahrzeug des
 * Mitarbeiters, sonst Putzkammer im Objekt, sonst Zentrallager.
 */
export function abbuchungsort(p: {
  tourFahrzeugOrt: string | null;
  standardFahrzeugOrt: string | null;
  objektOrt: string | null;
  zentrallager: string | null;
}): string | null {
  return p.tourFahrzeugOrt ?? p.standardFahrzeugOrt ?? p.objektOrt ?? p.zentrallager;
}
