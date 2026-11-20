/**
 * Leistungsnachweise: Zeiträume, Fälligkeit, Empfänger und Zeiten je Einsatz.
 * Je Kunde wird festgelegt, ob ein Nachweis je Einsatz, je Monat oder gar nicht verschickt wird.
 */
import { type Iso, letzterTagImMonat, plusMonate } from "./datum";
import type { Buchung } from "./zeiterfassung";

export type Versandart = "einsatz" | "monat" | "keiner";

/** Monat als "JJJJ-MM". */
export type Monat = string;

const MONAT = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function istMonat(m: string): m is Monat {
  return MONAT.test(m);
}

export function monatVon(datum: Iso): Monat {
  return datum.slice(0, 7);
}

export function monatsZeitraum(monat: Monat): { von: Iso; bis: Iso } {
  const t = MONAT.exec(monat);
  if (!t) throw new Error(`Ungültiger Monat: ${monat}`);
  const jahr = Number(t[1]);
  const m = Number(t[2]);
  return {
    von: `${monat}-01`,
    bis: `${monat}-${String(letzterTagImMonat(jahr, m)).padStart(2, "0")}`,
  };
}

export function plusMonat(monat: Monat, n: number): Monat {
  return monatVon(plusMonate(`${monat}-01`, n));
}

const MONATSNAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function monatsname(monat: Monat): string {
  return `${MONATSNAMEN[Number(monat.slice(5, 7)) - 1]} ${monat.slice(0, 4)}`;
}

/**
 * Monat, dessen Monatsnachweise heute fällig sind: immer der Vormonat. Ein Monat ist erst
 * abgeschlossen, wenn er vorbei ist; der Job holt verpasste Läufe beim nächsten Mal nach.
 */
export function faelligerMonat(heute: Iso): Monat {
  return plusMonat(monatVon(heute), -1);
}

/** Einsatznachweis ist fällig, wenn der Einsatz erledigt ist und der Kunde ihn je Einsatz will. */
export function einsatzNachweisFaellig(e: { status: string; versand: Versandart }): boolean {
  return e.status === "erledigt" && e.versand === "einsatz";
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Empfänger eines Nachweises: an den Kunden (abweichende Nachweis-Adresse vor Kunden-E-Mail),
 * Kopie an den Betrieb, wenn eingestellt. Ohne gültige Adresse wird nichts verschickt.
 */
export function nachweisEmpfaenger(p: {
  versand: Versandart;
  kundeEmail: string | null;
  nachweisEmail: string | null;
  betriebEmail: string | null;
  kopie: boolean;
}): { an: string[]; kopie: string[] } {
  const sauber = (s: string | null) => (s && EMAIL.test(s.trim()) ? s.trim().toLowerCase() : null);
  const kunde = p.versand === "keiner" ? null : (sauber(p.nachweisEmail) ?? sauber(p.kundeEmail));
  const betrieb = p.kopie ? sauber(p.betriebEmail) : null;
  return {
    an: kunde ? [kunde] : [],
    kopie: betrieb && betrieb !== kunde ? [betrieb] : [],
  };
}

/** Zeiten eines Einsatzes aus den Buchungen (mehrere Check-in/-out-Paare werden addiert). */
export function einsatzZeit(
  buchungen: Buchung[],
  einsatzId: string,
): { von: string | null; bis: string | null; minuten: number } {
  const liste = buchungen
    .filter((b) => b.einsatzId === einsatzId && !b.storniert)
    .filter((b) => b.art === "checkin" || b.art === "checkout")
    .sort((a, b) => Date.parse(a.zeitpunkt) - Date.parse(b.zeitpunkt));
  let minuten = 0;
  let offen: string | null = null;
  for (const b of liste) {
    if (b.art === "checkin") offen ??= b.zeitpunkt;
    else if (offen) {
      minuten += Math.max(0, Math.floor((Date.parse(b.zeitpunkt) - Date.parse(offen)) / 60_000));
      offen = null;
    }
  }
  const von = liste.find((b) => b.art === "checkin")?.zeitpunkt ?? null;
  const bis = liste.findLast((b) => b.art === "checkout")?.zeitpunkt ?? null;
  return { von, bis: bis && von && bis >= von ? bis : null, minuten };
}

/** Dateiname eines Nachweises, z. B. "nachweis-2026-11-objektname.pdf". */
export function nachweisDateiname(art: "einsatz" | "monat", von: Iso, objekt: string): string {
  const teil = art === "monat" ? von.slice(0, 7) : von;
  const name = objekt
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `nachweis-${teil}${name ? `-${name}` : ""}.pdf`;
}

/** Wartezeit bis zum nächsten Versuch nach einem Fehler (Job läuft täglich, max. 5 Versuche). */
export const MAX_VERSUCHE = 5;
