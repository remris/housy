/**
 * CSV-Parser für Excel-Exporte: erkennt Trennzeichen (; , Tab), Anführungszeichen,
 * Zeilenumbrüche in Feldern, BOM und CRLF. Ohne Abhängigkeiten, im Browser und Server nutzbar.
 */

export type CsvTabelle = { kopf: string[]; zeilen: string[][] };

/** Dekodiert Bytes als UTF-8, fällt bei ungültigem UTF-8 auf Windows-1252 zurück (Excel „CSV“). */
export function dekodiere(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function erkenneTrennzeichen(text: string): string {
  const ersteZeile = text.split(/\r?\n/, 1)[0] ?? "";
  const kandidaten = [";", ",", "\t"];
  let bestes = ";";
  let max = -1;
  for (const k of kandidaten) {
    // Trennzeichen außerhalb von Anführungszeichen zählen
    let anzahl = 0;
    let inQuote = false;
    for (const c of ersteZeile) {
      if (c === '"') inQuote = !inQuote;
      else if (c === k && !inQuote) anzahl++;
    }
    if (anzahl > max) {
      max = anzahl;
      bestes = k;
    }
  }
  return bestes;
}

export function parseCsv(eingabe: string, trennzeichen?: string): CsvTabelle {
  const text = eingabe.replace(/^﻿/, "");
  const t = trennzeichen ?? erkenneTrennzeichen(text);
  const zeilen: string[][] = [];
  let feld = "";
  let zeile: string[] = [];
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else inQuote = false;
      } else feld += c;
      continue;
    }
    if (c === '"' && feld === "") inQuote = true;
    else if (c === t) {
      zeile.push(feld);
      feld = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = "";
    } else feld += c;
  }
  if (feld !== "" || zeile.length > 0) {
    zeile.push(feld);
    zeilen.push(zeile);
  }

  const nichtLeer = zeilen.filter((z) => z.some((f) => f.trim() !== ""));
  const [kopf = [], ...rest] = nichtLeer;
  return { kopf: kopf.map((k) => k.trim()), zeilen: rest.map((z) => z.map((f) => f.trim())) };
}

/** Normalisiert Spaltennamen für den Abgleich: klein, ohne Umlaute/Sonderzeichen. */
export function normalisiereSpalte(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}
