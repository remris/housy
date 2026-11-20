/**
 * Import von Kunden und Objekten aus CSV (Excel-Export).
 * Spaltennamen werden über Synonyme erkannt, jede Zeile wird geprüft.
 */
import { type CsvTabelle, normalisiereSpalte } from "./csv";

export type Kundentyp = "firma" | "verwaltung" | "privat" | "oeffentlich";

export type KundeImport = {
  kundennummer: number | null;
  typ: Kundentyp;
  name: string;
  zusatz: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  leitweg_id: string | null;
  notiz: string | null;
};

export type ObjektImport = {
  kunde: string; // Kundennummer oder Kundenname
  name: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  zugangshinweise: string | null;
  notiz: string | null;
};

export type ImportZeile<T> = { zeile: number; daten?: T; fehler: string[] };
export type ImportErgebnis<T> = {
  gueltig: { zeile: number; daten: T }[];
  fehlerhaft: { zeile: number; fehler: string[] }[];
  erkannteSpalten: Record<string, string>;
  fehlendePflichtspalten: string[];
};

type Feldbeschreibung = { synonyme: string[]; pflicht?: boolean };

const KUNDE_FELDER: Record<keyof KundeImport, Feldbeschreibung> = {
  kundennummer: { synonyme: ["kundennummer", "kundennr", "kdnr", "nummer", "nr"] },
  typ: { synonyme: ["typ", "kundentyp", "art", "kundenart"] },
  name: {
    synonyme: ["name", "firma", "kunde", "kundenname", "firmenname", "name1"],
    pflicht: true,
  },
  zusatz: { synonyme: ["zusatz", "name2", "abteilung", "zuhaenden"] },
  strasse: { synonyme: ["strasse", "str", "adresse", "anschrift", "strassehausnummer"] },
  plz: { synonyme: ["plz", "postleitzahl"] },
  ort: { synonyme: ["ort", "stadt", "wohnort"] },
  email: { synonyme: ["email", "mail", "emailadresse"] },
  telefon: { synonyme: ["telefon", "tel", "telefonnummer", "handy", "mobil"] },
  leitweg_id: { synonyme: ["leitwegid", "leitweg"] },
  notiz: { synonyme: ["notiz", "bemerkung", "kommentar", "hinweis"] },
};

const OBJEKT_FELDER: Record<keyof ObjektImport, Feldbeschreibung> = {
  kunde: {
    synonyme: ["kunde", "kundennummer", "kundennr", "kundenname", "auftraggeber"],
    pflicht: true,
  },
  name: { synonyme: ["objekt", "objektname", "name", "bezeichnung"] },
  strasse: { synonyme: ["strasse", "str", "adresse", "objektadresse", "strassehausnummer"] },
  plz: { synonyme: ["plz", "postleitzahl"] },
  ort: { synonyme: ["ort", "stadt"] },
  zugangshinweise: { synonyme: ["zugang", "zugangshinweise", "zugangshinweis", "schluessel"] },
  notiz: { synonyme: ["notiz", "bemerkung", "kommentar", "hinweis"] },
};

/** Ordnet CSV-Spalten den Feldern zu (Index je Feld). */
export function ordneSpaltenZu<F extends string>(
  kopf: string[],
  felder: Record<F, Feldbeschreibung>,
): { index: Partial<Record<F, number>>; erkannt: Record<string, string>; fehlend: F[] } {
  const normal = kopf.map(normalisiereSpalte);
  const index: Partial<Record<F, number>> = {};
  const vergeben = new Set<number>();
  const erkannt: Record<string, string> = {};
  // Erst exakte Treffer in Synonym-Reihenfolge, damit "Kundennummer" nicht als "Kunde" endet
  for (const feld of Object.keys(felder) as F[]) {
    for (const s of felder[feld].synonyme) {
      const i = normal.findIndex((n, j) => n === s && !vergeben.has(j));
      if (i >= 0) {
        index[feld] = i;
        vergeben.add(i);
        erkannt[kopf[i]!] = feld;
        break;
      }
    }
  }
  const fehlend = (Object.keys(felder) as F[]).filter(
    (f) => felder[f].pflicht && index[f] === undefined,
  );
  return { index, erkannt, fehlend };
}

const leer = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export function erkenneKundentyp(wert: string | null): Kundentyp | null {
  if (!wert) return null;
  const n = normalisiereSpalte(wert);
  if (["firma", "gewerbe", "unternehmen", "gewerblich", "b2b"].includes(n)) return "firma";
  if (["verwaltung", "hausverwaltung", "weg", "immobilienverwaltung"].includes(n))
    return "verwaltung";
  if (["privat", "privatkunde", "privatperson", "b2c"].includes(n)) return "privat";
  if (["oeffentlich", "behoerde", "kommune", "amt", "oeffentlicherauftraggeber"].includes(n))
    return "oeffentlich";
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEITWEG = /^[0-9]{2,12}(-[0-9A-Za-z]{1,30})?-[0-9]{2}$/;

/** Trennt "70173 Stuttgart" in PLZ und Ort, falls die CSV beides in einer Spalte hat. */
export function trennePlzOrt(plz: string | null, ort: string | null) {
  if (!plz && ort) {
    const m = /^(\d{5})\s+(.+)$/.exec(ort);
    if (m) return { plz: m[1]!, ort: m[2]! };
  }
  return { plz, ort };
}

export function importiereKunden(csv: CsvTabelle): ImportErgebnis<KundeImport> {
  const { index, erkannt, fehlend } = ordneSpaltenZu(csv.kopf, KUNDE_FELDER);
  const ergebnis: ImportErgebnis<KundeImport> = {
    gueltig: [],
    fehlerhaft: [],
    erkannteSpalten: erkannt,
    fehlendePflichtspalten: fehlend,
  };
  if (fehlend.length) return ergebnis;
  const wert = (z: string[], f: keyof KundeImport) =>
    index[f] === undefined ? null : leer(z[index[f]!]);
  const gesehen = new Set<number>();

  csv.zeilen.forEach((z, i) => {
    const zeile = i + 2; // Kopfzeile = 1
    const fehler: string[] = [];
    const name = wert(z, "name");
    if (!name) fehler.push("Name fehlt");

    const nrText = wert(z, "kundennummer");
    let kundennummer: number | null = null;
    if (nrText) {
      const n = Number(nrText.replace(/\D/g, ""));
      if (!Number.isInteger(n) || n <= 0) fehler.push(`Kundennummer "${nrText}" ist keine Zahl`);
      else if (gesehen.has(n)) fehler.push(`Kundennummer ${n} doppelt in der Datei`);
      else {
        kundennummer = n;
        gesehen.add(n);
      }
    }

    const typText = wert(z, "typ");
    const typ = erkenneKundentyp(typText);
    if (typText && !typ) fehler.push(`Unbekannter Kundentyp "${typText}"`);

    const { plz, ort } = trennePlzOrt(wert(z, "plz"), wert(z, "ort"));
    if (plz && !/^\d{5}$/.test(plz)) fehler.push(`PLZ "${plz}" ungültig`);

    const email = wert(z, "email")?.toLowerCase() ?? null;
    if (email && !EMAIL.test(email)) fehler.push(`E-Mail "${email}" ungültig`);

    const leitweg = wert(z, "leitweg_id");
    if (leitweg && !LEITWEG.test(leitweg)) fehler.push(`Leitweg-ID "${leitweg}" ungültig`);

    if (fehler.length) {
      ergebnis.fehlerhaft.push({ zeile, fehler });
      return;
    }
    ergebnis.gueltig.push({
      zeile,
      daten: {
        kundennummer,
        typ: typ ?? (leitweg ? "oeffentlich" : "firma"),
        name: name!,
        zusatz: wert(z, "zusatz"),
        strasse: wert(z, "strasse"),
        plz,
        ort,
        email,
        telefon: wert(z, "telefon"),
        leitweg_id: leitweg,
        notiz: wert(z, "notiz"),
      },
    });
  });
  return ergebnis;
}

export function importiereObjekte(csv: CsvTabelle): ImportErgebnis<ObjektImport> {
  const { index, erkannt, fehlend } = ordneSpaltenZu(csv.kopf, OBJEKT_FELDER);
  const ergebnis: ImportErgebnis<ObjektImport> = {
    gueltig: [],
    fehlerhaft: [],
    erkannteSpalten: erkannt,
    fehlendePflichtspalten: fehlend,
  };
  if (fehlend.length) return ergebnis;
  const wert = (z: string[], f: keyof ObjektImport) =>
    index[f] === undefined ? null : leer(z[index[f]!]);

  csv.zeilen.forEach((z, i) => {
    const zeile = i + 2;
    const fehler: string[] = [];
    const kunde = wert(z, "kunde");
    if (!kunde) fehler.push("Kunde fehlt");
    const strasse = wert(z, "strasse");
    const name = wert(z, "name") ?? strasse;
    if (!name) fehler.push("Objektname oder Straße fehlt");
    const { plz, ort } = trennePlzOrt(wert(z, "plz"), wert(z, "ort"));
    if (plz && !/^\d{5}$/.test(plz)) fehler.push(`PLZ "${plz}" ungültig`);
    if (fehler.length) {
      ergebnis.fehlerhaft.push({ zeile, fehler });
      return;
    }
    ergebnis.gueltig.push({
      zeile,
      daten: {
        kunde: kunde!,
        name: name!,
        strasse,
        plz,
        ort,
        zugangshinweise: wert(z, "zugangshinweise"),
        notiz: wert(z, "notiz"),
      },
    });
  });
  return ergebnis;
}

/**
 * Löst die Kundenangabe einer Objektzeile auf: zuerst Kundennummer, dann exakter Name
 * (ohne Groß-/Kleinschreibung). Mehrdeutige Namen gelten als nicht gefunden.
 */
export function findeKunde(
  angabe: string,
  kunden: { id: string; kundennummer: number; name: string }[],
): { id: string } | { fehler: string } {
  const nr = /^\d+$/.test(angabe.trim()) ? Number(angabe.trim()) : null;
  if (nr !== null) {
    const k = kunden.find((x) => x.kundennummer === nr);
    if (k) return { id: k.id };
  }
  const treffer = kunden.filter((x) => x.name.trim().toLowerCase() === angabe.trim().toLowerCase());
  if (treffer.length === 1) return { id: treffer[0]!.id };
  if (treffer.length > 1)
    return { fehler: `Kunde "${angabe}" ist mehrdeutig, bitte Kundennummer nutzen` };
  return { fehler: `Kunde "${angabe}" nicht gefunden` };
}
