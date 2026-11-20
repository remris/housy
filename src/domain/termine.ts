/**
 * Freie Termine für Online-Buchungen aus der Planung: Arbeitszeiten der Mitarbeiter minus
 * Abwesenheiten, Feiertage und schon geplante Einsätze, je Halbtag.
 * Ein Halbtag ist frei, wenn mindestens ein Mitarbeiter genug Zeit hat (Dauer + Puffer für die
 * Fahrt) und das Team nach Abzug noch nicht zugewiesener Einsätze genug Luft hat.
 */
import { type Iso, plusTage, tageImBereich, wochentag } from "./datum";
import { zuMinuten } from "./planung";

export type Halbtag = "vormittag" | "nachmittag";

export const HALBTAGE: Record<Halbtag, { von: string; bis: string; text: string }> = {
  vormittag: { von: "08:00", bis: "12:00", text: "vormittags (8–12 Uhr)" },
  nachmittag: { von: "12:00", bis: "17:00", text: "nachmittags (12–17 Uhr)" },
};

export type KalenderMitarbeiter = {
  id: string;
  arbeitszeiten: { wochentag: number; von: string; bis: string }[];
  abwesend: Iso[];
};

export type Belegung = {
  mitarbeiterId: string | null;
  datum: Iso;
  /** geplanter Beginn bzw. Zeitfensterbeginn "HH:MM" */
  beginn: string | null;
  minuten: number;
};

export type FreierTermin = { datum: Iso; halbtag: Halbtag };

const ueberlappung = (a: [number, number], b: [number, number]) =>
  Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** Minuten, die eine Belegung in einem Halbtag verbraucht (ohne Uhrzeit: halb/halb). */
function verbrauch(b: Belegung, h: Halbtag): number {
  if (!b.beginn) return b.minuten / 2;
  const start = zuMinuten(b.beginn);
  const fenster: [number, number] = [zuMinuten(HALBTAGE[h].von), zuMinuten(HALBTAGE[h].bis)];
  return ueberlappung([start, start + b.minuten], fenster);
}

export function freieTermine(p: {
  heute: Iso;
  vorlaufTage: number;
  horizontTage: number;
  dauerMinuten: number;
  /** Fahrt und Puffer je Einsatz */
  pufferMinuten?: number;
  mitarbeiter: KalenderMitarbeiter[];
  belegt: Belegung[];
  feiertage: ReadonlySet<Iso>;
}): FreierTermin[] {
  const puffer = p.pufferMinuten ?? 30;
  const bedarf = p.dauerMinuten + puffer;
  const von = plusTage(p.heute, Math.max(1, p.vorlaufTage));
  const bis = plusTage(p.heute, p.horizontTage);
  const ergebnis: FreierTermin[] = [];
  for (const datum of tageImBereich(von, bis)) {
    if (p.feiertage.has(datum)) continue;
    const tag = wochentag(datum);
    const amTag = p.belegt.filter((b) => b.datum === datum);
    for (const h of ["vormittag", "nachmittag"] as const) {
      const fenster: [number, number] = [zuMinuten(HALBTAGE[h].von), zuMinuten(HALBTAGE[h].bis)];
      const frei = p.mitarbeiter
        .filter((m) => !m.abwesend.includes(datum))
        .map((m) => {
          const kapazitaet = m.arbeitszeiten
            .filter((a) => a.wochentag === tag)
            .reduce((s, a) => s + ueberlappung([zuMinuten(a.von), zuMinuten(a.bis)], fenster), 0);
          const belegt = amTag
            .filter((b) => b.mitarbeiterId === m.id)
            .reduce((s, b) => s + verbrauch(b, h) + (verbrauch(b, h) > 0 ? puffer : 0), 0);
          return kapazitaet - belegt;
        });
      const offen = amTag
        .filter((b) => b.mitarbeiterId === null)
        .reduce((s, b) => s + verbrauch(b, h) + puffer, 0);
      const team = frei.reduce((s, f) => s + Math.max(0, f), 0) - offen;
      if (frei.some((f) => f >= bedarf) && team >= bedarf) ergebnis.push({ datum, halbtag: h });
    }
  }
  return ergebnis;
}
