/**
 * Arbeitszeitliste je Mitarbeiter und Monat für die Aufzeichnungspflicht
 * (§ 17 MiLoG, § 2a SchwarzArbG: Beginn, Ende und Dauer der täglichen Arbeitszeit).
 * Tage werden nach Ortszeit Europe/Berlin gebildet; Grundlage ist `werteTagAus`.
 */
import { schreibeCsv } from "./csv";
import { type Iso, WOCHENTAGE_KURZ, formatDatum, tageImBereich, wochentag } from "./datum";
import { type Monat, monatsZeitraum } from "./nachweis";
import {
  type Buchung,
  type Zeithinweis,
  tagBerlin,
  uhrzeitBerlin,
  werteTagAus,
} from "./zeiterfassung";

export const ZEITHINWEIS_TEXT: Record<Zeithinweis, string> = {
  checkout_fehlt: "Check-out fehlt",
  checkin_fehlt: "Check-in fehlt",
  pause_offen: "Pause nicht beendet",
  pause_ende_ohne_beginn: "Pausenende ohne Beginn",
  pause_zu_kurz: "Pause zu kurz (§ 4 ArbZG)",
  ueber_10_stunden: "über 10 Stunden (§ 3 ArbZG)",
};

export type Arbeitstag = {
  datum: Iso;
  beginn: string | null;
  ende: string | null;
  pauseMinuten: number;
  arbeitMinuten: number;
  einsaetze: number;
  hinweise: Zeithinweis[];
  /** vom Büro korrigiert oder nachgetragen */
  korrigiert: boolean;
};

export type Arbeitszeitliste = {
  monat: Monat;
  tage: Arbeitstag[];
  summeMinuten: number;
  arbeitstage: number;
  tageMitHinweis: number;
};

/**
 * Wertet alle Buchungen eines Mitarbeiters für einen Monat aus. `korrigierteIds` sind Buchungen
 * mit Eintrag im Korrekturprotokoll; der Tag wird markiert.
 */
export function arbeitszeitliste(
  buchungen: Buchung[],
  monat: Monat,
  korrigierteIds: ReadonlySet<string> = new Set(),
): Arbeitszeitliste {
  const { von, bis } = monatsZeitraum(monat);
  const jeTag = new Map<Iso, Buchung[]>();
  for (const b of buchungen) {
    const tag = tagBerlin(b.zeitpunkt);
    if (tag < von || tag > bis) continue;
    const liste = jeTag.get(tag) ?? [];
    liste.push(b);
    jeTag.set(tag, liste);
  }
  const tage: Arbeitstag[] = [];
  for (const datum of tageImBereich(von, bis)) {
    const liste = jeTag.get(datum);
    if (!liste) continue;
    const gueltig = liste.filter((b) => !b.storniert);
    const korrigiert = liste.some((b) => korrigierteIds.has(b.id));
    if (gueltig.length === 0 && !korrigiert) continue;
    const t = werteTagAus(gueltig);
    tage.push({
      datum,
      beginn: t.beginn,
      ende: t.ende,
      pauseMinuten: t.pauseMinuten,
      arbeitMinuten: t.arbeitMinuten,
      einsaetze: t.einsaetze.length,
      hinweise: t.hinweise,
      korrigiert,
    });
  }
  return {
    monat,
    tage,
    summeMinuten: tage.reduce((s, t) => s + t.arbeitMinuten, 0),
    arbeitstage: tage.filter((t) => t.arbeitMinuten > 0).length,
    tageMitHinweis: tage.filter((t) => t.hinweise.length > 0).length,
  };
}

/** "7:45" */
export function stundenMinuten(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** "7,75" (für Lohnprogramme) */
export function dezimalStunden(minuten: number): string {
  return (Math.round((minuten / 60) * 100) / 100).toFixed(2).replace(".", ",");
}

export const ARBEITSZEIT_CSV_KOPF = [
  "Mitarbeiter",
  "Datum",
  "Wochentag",
  "Beginn",
  "Ende",
  "Pause (Min.)",
  "Arbeitszeit (h:mm)",
  "Arbeitszeit (Std.)",
  "Einsätze",
  "Hinweise",
  "Korrigiert",
];

/** Zeilen für die CSV (ohne Kopf), auch für mehrere Mitarbeiter hintereinander nutzbar. */
export function arbeitszeitZeilen(name: string, liste: Arbeitszeitliste): string[][] {
  return liste.tage.map((t) => [
    name,
    formatDatum(t.datum),
    WOCHENTAGE_KURZ[wochentag(t.datum) - 1] ?? "",
    t.beginn ? uhrzeitBerlin(t.beginn) : "",
    t.ende ? uhrzeitBerlin(t.ende) : "",
    String(t.pauseMinuten),
    stundenMinuten(t.arbeitMinuten),
    dezimalStunden(t.arbeitMinuten),
    String(t.einsaetze),
    t.hinweise.map((h) => ZEITHINWEIS_TEXT[h]).join(", "),
    t.korrigiert ? "ja" : "",
  ]);
}

/** CSV (Semikolon, UTF-8 mit BOM) für Excel und Lohnbüro. */
export function arbeitszeitCsv(eintraege: { name: string; liste: Arbeitszeitliste }[]): string {
  return schreibeCsv([
    ARBEITSZEIT_CSV_KOPF,
    ...eintraege.flatMap((e) => arbeitszeitZeilen(e.name, e.liste)),
  ]);
}
