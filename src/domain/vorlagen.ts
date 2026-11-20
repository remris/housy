/**
 * Fachlogik zu Auftragsvorlagen: Sollzeit und Material-/Werkzeugbedarf je Einsatz.
 * Grundlage für Planung (M5), Packliste und Prognose (M8).
 */

export type Bedarfsbezug = "einsatz" | "m2" | "fenster" | "stunde";

export type Bedarf = { artikelId: string; menge: number; bezug: Bedarfsbezug };

/** Kennzahlen eines Einsatzes, auf die sich Bedarf und Sollzeit beziehen. */
export type Einsatzumfang = {
  /** Fläche in m² (z. B. Summe der Bereiche des Objekts) */
  flaecheM2: number;
  /** Anzahl Fenster (Summe Fensteraufmaß) */
  fenster: number;
  /** Arbeitszeit in Stunden; falls nicht bekannt, aus der Sollzeit */
  stunden?: number;
};

export type Vorlagenzeit = {
  sollzeitMinuten: number;
  minutenPro100m2?: number | null;
  minutenProFenster?: number | null;
};

/** Sollzeit eines Einsatzes in Minuten: Grundzeit + Fläche + Fenster, auf 5 Minuten gerundet. */
export function sollzeit(v: Vorlagenzeit, umfang: Einsatzumfang): number {
  const minuten =
    v.sollzeitMinuten +
    ((v.minutenPro100m2 ?? 0) * umfang.flaecheM2) / 100 +
    (v.minutenProFenster ?? 0) * umfang.fenster;
  return Math.round(minuten / 5) * 5;
}

/** Bezugsmenge eines Einsatzes für einen Bedarfsbezug. */
export function bezugsmenge(bezug: Bedarfsbezug, umfang: Einsatzumfang, stunden: number): number {
  switch (bezug) {
    case "einsatz":
      return 1;
    case "m2":
      return umfang.flaecheM2;
    case "fenster":
      return umfang.fenster;
    case "stunde":
      return stunden;
  }
}

/**
 * Bedarf je Artikel für einen Einsatz. Mehrere Zeilen desselben Artikels (z. B. je Einsatz
 * und je Fenster) werden addiert. Ergebnis auf 4 Nachkommastellen gerundet.
 */
export function bedarfJeEinsatz(
  bedarfe: Bedarf[],
  umfang: Einsatzumfang,
  vorlage?: Vorlagenzeit,
): Map<string, number> {
  const stunden = umfang.stunden ?? (vorlage ? sollzeit(vorlage, umfang) / 60 : 0);
  const summe = new Map<string, number>();
  for (const b of bedarfe) {
    const menge = b.menge * bezugsmenge(b.bezug, umfang, stunden);
    if (menge <= 0) continue;
    summe.set(b.artikelId, (summe.get(b.artikelId) ?? 0) + menge);
  }
  for (const [k, v] of summe) summe.set(k, Math.round(v * 10_000) / 10_000);
  return summe;
}

/** Passende Lebensdauer-Einheit je Bedarfsbezug (für Verschleißteile). */
export const LEBENSDAUER_ZU_BEZUG: Record<string, Bedarfsbezug | null> = {
  einsaetze: "einsatz",
  fenster: "fenster",
  m2: "m2",
  stunden: "stunde",
  waeschen: "einsatz",
  tage: null,
};

/** Formatiert eine Menge mit Einheit deutsch, z. B. 0,5 l. */
export function formatMenge(menge: number, einheit: string): string {
  return `${menge.toLocaleString("de-DE", { maximumFractionDigits: 3 })} ${einheit}`;
}
