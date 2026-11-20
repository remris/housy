/**
 * Geldbeträge werden in der gesamten App als ganze Cent (integer) geführt,
 * damit Rundungsfehler bei Rechnungen ausgeschlossen sind.
 */
export type Cent = number;

/** Rundet kaufmännisch (half away from zero) auf ganze Cent. */
export function rundeCent(wert: number): Cent {
  return Math.sign(wert) * Math.round(Math.abs(wert));
}

/** Wandelt einen Euro-Betrag (z. B. 12.345) in Cent um. */
export function euroZuCent(euro: number): Cent {
  return rundeCent(euro * 100);
}

const euroFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Formatiert Cent als deutschen Euro-Betrag, z. B. 42000 → "420,00 €". */
export function formatEuro(cent: Cent): string {
  return euroFormat.format(cent / 100).replace(/ /g, " ");
}

/** Parst eine deutsche Eingabe wie "1.234,5" oder "12,99 €" zu Cent; null bei ungültiger Eingabe. */
export function parseEuro(eingabe: string): Cent | null {
  const bereinigt = eingabe.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{0,2})?$/.test(bereinigt)) return null;
  return euroZuCent(Number(bereinigt));
}
