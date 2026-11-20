/**
 * Gesetzliche Feiertage in Deutschland je Bundesland (landesweit gültige; regionale
 * Feiertage wie Augsburger Friedensfest oder Fronleichnam in Teilen Sachsens/Thüringens fehlen).
 */
import { type Iso, plusTage, wochentag, zuIso } from "./datum";

export const BUNDESLAENDER = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
} as const;

export type Bundesland = keyof typeof BUNDESLAENDER;

/** Ostersonntag nach der Gaußschen Osterformel (Meeus/Jones/Butcher). */
export function ostersonntag(jahr: number): Iso {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return zuIso(new Date(Date.UTC(jahr, monat - 1, tag)));
}

const fest = (jahr: number, monat: number, tag: number) =>
  zuIso(new Date(Date.UTC(jahr, monat - 1, tag)));

/** Buß- und Bettag: Mittwoch vor dem 23. November. */
function bussUndBettag(jahr: number): Iso {
  let d = fest(jahr, 11, 22);
  while (wochentag(d) !== 3) d = plusTage(d, -1);
  return d;
}

export function feiertage(jahr: number, land: Bundesland): Map<Iso, string> {
  const ostern = ostersonntag(jahr);
  const f = new Map<Iso, string>([
    [fest(jahr, 1, 1), "Neujahr"],
    [plusTage(ostern, -2), "Karfreitag"],
    [plusTage(ostern, 1), "Ostermontag"],
    [fest(jahr, 5, 1), "Tag der Arbeit"],
    [plusTage(ostern, 39), "Christi Himmelfahrt"],
    [plusTage(ostern, 50), "Pfingstmontag"],
    [fest(jahr, 10, 3), "Tag der Deutschen Einheit"],
    [fest(jahr, 12, 25), "1. Weihnachtstag"],
    [fest(jahr, 12, 26), "2. Weihnachtstag"],
  ]);
  const add = (laender: Bundesland[], datum: Iso, name: string) => {
    if (laender.includes(land)) f.set(datum, name);
  };
  add(["BW", "BY", "ST"], fest(jahr, 1, 6), "Heilige Drei Könige");
  if (jahr >= 2019) add(["BE"], fest(jahr, 3, 8), "Internationaler Frauentag");
  if (jahr >= 2023) add(["MV"], fest(jahr, 3, 8), "Internationaler Frauentag");
  add(["BB"], ostern, "Ostersonntag");
  add(["BB"], plusTage(ostern, 49), "Pfingstsonntag");
  add(["BW", "BY", "HE", "NW", "RP", "SL"], plusTage(ostern, 60), "Fronleichnam");
  add(["BY", "SL"], fest(jahr, 8, 15), "Mariä Himmelfahrt");
  if (jahr >= 2019) add(["TH"], fest(jahr, 9, 20), "Weltkindertag");
  add(["BB", "MV", "SN", "ST", "TH"], fest(jahr, 10, 31), "Reformationstag");
  if (jahr >= 2018) add(["HB", "HH", "NI", "SH"], fest(jahr, 10, 31), "Reformationstag");
  add(["BW", "BY", "NW", "RP", "SL"], fest(jahr, 11, 1), "Allerheiligen");
  add(["SN"], bussUndBettag(jahr), "Buß- und Bettag");
  return f;
}

/** Feiertage für einen Zeitraum (über Jahresgrenzen). */
export function feiertageImZeitraum(von: Iso, bis: Iso, land: Bundesland): Map<Iso, string> {
  const ergebnis = new Map<Iso, string>();
  for (let j = Number(von.slice(0, 4)); j <= Number(bis.slice(0, 4)); j++) {
    for (const [d, n] of feiertage(j, land)) if (d >= von && d <= bis) ergebnis.set(d, n);
  }
  return ergebnis;
}
