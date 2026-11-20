/**
 * Angebote: Leistungen mit Rhythmus (wie spätere Vertragsleistungen) und Preis, Schätzung des
 * Monatsbetrags, Gültigkeit. Bei Annahme werden daraus Kunde, Objekt und Vertragsentwurf.
 */
import { type Iso, plusTage } from "./datum";
import { type Cent, rundeCent } from "./geld";
import type { Preiseinheit } from "./rechnung";

export type AngebotsLeistung = {
  bezeichnung: string;
  frequenz: "taeglich" | "woechentlich" | "monatlich" | "einmalig";
  intervall: number;
  wochentage: number[];
  /** Menge je Einsatz in der Preiseinheit (z. B. 2,5 Stunden, 40 Fenster); bei pauschal/einsatz 1 */
  mengeJeEinsatz: number;
  einheit: Preiseinheit;
  preisCent: Cent | null;
};

/** Durchschnittliche Einsätze im Monat (52 Wochen / 12 Monate). */
export function einsaetzeProMonat(
  l: Pick<AngebotsLeistung, "frequenz" | "intervall" | "wochentage">,
): number {
  const n = Math.max(1, l.intervall);
  switch (l.frequenz) {
    case "taeglich":
      return 365 / 12 / n;
    case "woechentlich":
      return (Math.max(1, l.wochentage.length) * 52) / 12 / n;
    case "monatlich":
      return 1 / n;
    case "einmalig":
      return 0;
  }
}

export type AngebotsSumme = {
  /** voraussichtlicher Monatsbetrag netto (Pauschale bzw. Schätzung nach Aufwand) */
  monatNettoCent: Cent;
  /** einmalige Leistungen netto */
  einmaligNettoCent: Cent;
  /** Zeilen mit Schätzung je Leistung */
  zeilen: { bezeichnung: string; jeEinsatzCent: Cent; monatCent: Cent; einmaligCent: Cent }[];
};

export function angebotsSumme(
  leistungen: AngebotsLeistung[],
  abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag",
  pauschaleCent: Cent | null,
): AngebotsSumme {
  const zeilen = leistungen.map((l) => {
    const jeEinsatz = rundeCent(l.mengeJeEinsatz * (l.preisCent ?? 0));
    return {
      bezeichnung: l.bezeichnung,
      jeEinsatzCent: jeEinsatz,
      monatCent: l.frequenz === "einmalig" ? 0 : rundeCent(jeEinsatz * einsaetzeProMonat(l)),
      einmaligCent: l.frequenz === "einmalig" ? jeEinsatz : 0,
    };
  });
  return {
    monatNettoCent:
      abrechnungsart === "pauschale"
        ? (pauschaleCent ?? 0)
        : zeilen.reduce((s, z) => s + z.monatCent, 0),
    einmaligNettoCent: zeilen.reduce((s, z) => s + z.einmaligCent, 0),
    zeilen,
  };
}

/** Standard-Gültigkeit eines Angebots: 30 Tage. */
export const gueltigBis = (datum: Iso, tage = 30) => plusTage(datum, tage);

export function angebotAbgelaufen(gueltig: Iso | null, heute: Iso): boolean {
  return gueltig !== null && heute > gueltig;
}

/** Welcher Rhythmus-Text erscheint im Angebot, z. B. „wöchentlich Mo, Do“. */
export const FREQUENZ_TEXT: Record<AngebotsLeistung["frequenz"], string> = {
  taeglich: "täglich",
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
  einmalig: "einmalig",
};
