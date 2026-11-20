/**
 * Rechnungen: Monatslauf aus Verträgen (Pauschale anteilig bei Versionswechsel, Aufwand aus
 * erledigten Einsätzen), Nachträge, Summen je Steuersatz, Nummern, Fälligkeit.
 * Geld immer in ganzen Cent; jede Positionssumme wird für sich kaufmännisch gerundet,
 * die Steuer je Steuersatz auf die Summe der Positionen (EN 16931, BR-CO-17).
 */
import { type Iso, formatDatum, plusTage, tageZwischen } from "./datum";
import { type Cent, rundeCent } from "./geld";
import { type Monat, monatsZeitraum, monatsname } from "./nachweis";

export type Preiseinheit =
  "pauschal" | "stunde" | "m2" | "fenster" | "stueck" | "einsatz" | "monat";

export type Positionsquelle =
  | { art: "pauschale"; vertragId: string; versionId: string }
  | {
      art: "aufwand";
      vertragId: string;
      versionId: string;
      leistungId: string;
      einsatzIds: string[];
    }
  | { art: "nachtrag"; einsatzPositionId: string; einsatzId: string }
  | { art: "manuell" };

export type Rechnungsposition = {
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Preiseinheit;
  einzelpreisCent: Cent;
  nettoCent: Cent;
  ustSatz: number;
  von: Iso | null;
  bis: Iso | null;
  quelle: Positionsquelle;
};

export type LeistungFuerLauf = {
  id: string;
  bezeichnung: string;
  einheit: Preiseinheit;
  preisCent: Cent | null;
  ustSatz: number;
};

export type VersionFuerLauf = {
  id: string;
  version: number;
  gueltigAb: Iso;
  abrechnungsart: "pauschale" | "aufwand" | "einzelauftrag";
  pauschaleCent: Cent | null;
  leistungen: LeistungFuerLauf[];
};

export type VertragFuerLauf = {
  id: string;
  titel: string;
  beginn: Iso;
  endetAm: Iso | null;
  versionen: VersionFuerLauf[];
};

export type EinsatzFuerLauf = {
  id: string;
  datum: Iso;
  vertragsleistungId: string | null;
  /** Ist-Zeit aus Check-in/-out, sonst Sollzeit */
  minuten: number;
  fenster: number;
  m2: number;
};

export type NachtragFuerLauf = {
  id: string;
  einsatzId: string;
  datum: Iso;
  bezeichnung: string;
  menge: number;
  einheit: Preiseinheit | null;
  preisCent: Cent;
  ustSatz: number;
};

export type Abgerechnet = {
  einsatzIds: ReadonlySet<string>;
  nachtragIds: ReadonlySet<string>;
  /** `${versionId}|${monat}` für schon abgerechnete Pauschalen */
  pauschalen: ReadonlySet<string>;
};

export const NICHTS_ABGERECHNET: Abgerechnet = {
  einsatzIds: new Set(),
  nachtragIds: new Set(),
  pauschalen: new Set(),
};

const kurz = (iso: Iso) => formatDatum(iso).slice(0, 6);

export function position(
  p: Omit<Rechnungsposition, "nettoCent" | "beschreibung" | "von" | "bis"> &
    Partial<Pick<Rechnungsposition, "beschreibung" | "von" | "bis">>,
): Rechnungsposition {
  return {
    beschreibung: null,
    von: null,
    bis: null,
    ...p,
    nettoCent: rundeCent(p.menge * p.einzelpreisCent),
  };
}

/** Viertelstunden, kaufmännisch gerundet (1:07 h → 1,00; 1:08 h → 1,25). */
export function stundenAusMinuten(minuten: number): number {
  return Math.round(minuten / 15) / 4;
}

/** Gültigkeitsabschnitte der Versionen innerhalb des Monats und der Vertragslaufzeit. */
export function abschnitte(
  vertrag: VertragFuerLauf,
  monat: Monat,
): { version: VersionFuerLauf; von: Iso; bis: Iso }[] {
  const { von: mVon, bis: mBis } = monatsZeitraum(monat);
  const start = vertrag.beginn > mVon ? vertrag.beginn : mVon;
  const ende = vertrag.endetAm && vertrag.endetAm < mBis ? vertrag.endetAm : mBis;
  if (start > ende) return [];
  const versionen = [...vertrag.versionen].sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb));
  const ergebnis: { version: VersionFuerLauf; von: Iso; bis: Iso }[] = [];
  versionen.forEach((v, i) => {
    const naechste = versionen[i + 1];
    const vVon = v.gueltigAb > start ? v.gueltigAb : start;
    const vBis =
      naechste && plusTage(naechste.gueltigAb, -1) < ende ? plusTage(naechste.gueltigAb, -1) : ende;
    if (vVon <= vBis) ergebnis.push({ version: v, von: vVon, bis: vBis });
  });
  return ergebnis;
}

function menge(einheit: Preiseinheit, einsaetze: EinsatzFuerLauf[]): number {
  switch (einheit) {
    case "stunde":
      return stundenAusMinuten(einsaetze.reduce((s, e) => s + e.minuten, 0));
    case "fenster":
      return einsaetze.reduce((s, e) => s + e.fenster, 0);
    case "m2":
      return Math.round(einsaetze.reduce((s, e) => s + e.m2, 0) * 100) / 100;
    default:
      return einsaetze.length;
  }
}

/**
 * Positionen eines Vertrags für einen Monat. Schon Abgerechnetes (auch auf früheren Rechnungen)
 * bleibt draußen; Hinweise nennen, was nicht berechnet werden konnte.
 */
export function vertragsPositionen(p: {
  monat: Monat;
  vertrag: VertragFuerLauf;
  einsaetze: EinsatzFuerLauf[];
  abgerechnet?: Abgerechnet;
  standardUst?: number;
}): { positionen: Rechnungsposition[]; hinweise: string[] } {
  const abgerechnet = p.abgerechnet ?? NICHTS_ABGERECHNET;
  const ust = p.standardUst ?? 19;
  const { von: mVon, bis: mBis } = monatsZeitraum(p.monat);
  const tageImMonat = tageZwischen(mVon, mBis) + 1;
  const positionen: Rechnungsposition[] = [];
  const hinweise: string[] = [];

  for (const a of abschnitte(p.vertrag, p.monat)) {
    const v = a.version;
    if (v.abrechnungsart === "pauschale") {
      if (abgerechnet.pauschalen.has(`${v.id}|${p.monat}`)) continue;
      const tage = tageZwischen(a.von, a.bis) + 1;
      const voll = tage === tageImMonat;
      const betrag = voll ? v.pauschaleCent! : rundeCent((v.pauschaleCent! * tage) / tageImMonat);
      positionen.push(
        position({
          bezeichnung: `Monatspauschale ${p.vertrag.titel}`,
          beschreibung: voll
            ? monatsname(p.monat)
            : `anteilig ${kurz(a.von)}–${formatDatum(a.bis)} (${tage} von ${tageImMonat} Tagen)`,
          menge: 1,
          einheit: "monat",
          einzelpreisCent: betrag,
          ustSatz: ust,
          von: a.von,
          bis: a.bis,
          quelle: { art: "pauschale", vertragId: p.vertrag.id, versionId: v.id },
        }),
      );
      continue;
    }
    // Aufwand bzw. Einzelauftrag: erledigte Einsätze je Leistung dieser Version
    for (const l of v.leistungen) {
      const eigene = p.einsaetze
        .filter(
          (e) =>
            e.vertragsleistungId === l.id &&
            e.datum >= a.von &&
            e.datum <= a.bis &&
            !abgerechnet.einsatzIds.has(e.id),
        )
        .sort((x, y) => x.datum.localeCompare(y.datum));
      if (eigene.length === 0) continue;
      if (l.preisCent === null) {
        hinweise.push(
          `${l.bezeichnung}: kein Preis hinterlegt (${eigene.length} Einsätze nicht berechnet)`,
        );
        continue;
      }
      const einheit = l.einheit === "pauschal" ? "einsatz" : l.einheit;
      const m = menge(einheit, eigene);
      positionen.push(
        position({
          bezeichnung: l.bezeichnung,
          beschreibung: `${eigene.length} ${eigene.length === 1 ? "Einsatz" : "Einsätze"}: ${eigene.map((e) => kurz(e.datum)).join(", ")}`,
          menge: m,
          einheit,
          einzelpreisCent: l.preisCent,
          ustSatz: l.ustSatz,
          von: eigene[0]!.datum,
          bis: eigene.at(-1)!.datum,
          quelle: {
            art: "aufwand",
            vertragId: p.vertrag.id,
            versionId: v.id,
            leistungId: l.id,
            einsatzIds: eigene.map((e) => e.id),
          },
        }),
      );
    }
  }
  const ohneLeistung = p.einsaetze.filter(
    (e) => e.vertragsleistungId === null && e.datum >= mVon && e.datum <= mBis,
  );
  if (
    ohneLeistung.length > 0 &&
    abschnitte(p.vertrag, p.monat).some((a) => a.version.abrechnungsart !== "pauschale")
  ) {
    hinweise.push(
      `${ohneLeistung.length} Einsätze ohne Vertragsleistung (von Hand angelegt) nicht berechnet`,
    );
  }
  return { positionen, hinweise };
}

/** Bestätigte Zusatzleistungen vor Ort (Nachträge), noch nicht abgerechnet. */
export function nachtragsPositionen(
  nachtraege: NachtragFuerLauf[],
  abgerechnet: Abgerechnet = NICHTS_ABGERECHNET,
): Rechnungsposition[] {
  return nachtraege
    .filter((n) => !abgerechnet.nachtragIds.has(n.id))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map((n) =>
      position({
        bezeichnung: n.bezeichnung,
        beschreibung: `Zusatzleistung am ${formatDatum(n.datum)}`,
        menge: n.menge,
        einheit: n.einheit ?? "stueck",
        einzelpreisCent: n.preisCent,
        ustSatz: n.ustSatz,
        von: n.datum,
        bis: n.datum,
        quelle: { art: "nachtrag", einsatzPositionId: n.id, einsatzId: n.einsatzId },
      }),
    );
}

// ---------------------------------------------------------------------------
// Summen
// ---------------------------------------------------------------------------

export type Steuergruppe = { satz: number; nettoCent: Cent; steuerCent: Cent };

export type Summen = {
  nettoCent: Cent;
  steuerCent: Cent;
  bruttoCent: Cent;
  gruppen: Steuergruppe[];
};

/**
 * Summen je Steuersatz. Kleinunternehmer (§ 19 UStG) weisen keine Steuer aus: alles in Gruppe 0.
 */
export function summen(positionen: Rechnungsposition[], kleinunternehmer: boolean): Summen {
  const jeSatz = new Map<number, Cent>();
  for (const p of positionen) {
    const satz = kleinunternehmer ? 0 : p.ustSatz;
    jeSatz.set(satz, (jeSatz.get(satz) ?? 0) + p.nettoCent);
  }
  const gruppen = [...jeSatz]
    .sort(([a], [b]) => b - a)
    .map(([satz, nettoCent]) => ({
      satz,
      nettoCent,
      steuerCent: rundeCent((nettoCent * satz) / 100),
    }));
  const nettoCent = gruppen.reduce((s, g) => s + g.nettoCent, 0);
  const steuerCent = gruppen.reduce((s, g) => s + g.steuerCent, 0);
  return { nettoCent, steuerCent, bruttoCent: nettoCent + steuerCent, gruppen };
}

// ---------------------------------------------------------------------------
// Nummern, Fälligkeit, Pflichthinweise
// ---------------------------------------------------------------------------

/** Rechnungsnummer: Präfix + Jahr + laufende Nummer, z. B. RE-2026-0042 (fortlaufend je Jahr). */
export function rechnungsnummer(praefix: string, jahr: number, laufnummer: number): string {
  return `${praefix}${jahr}-${String(laufnummer).padStart(4, "0")}`;
}

export function faelligAm(rechnungsdatum: Iso, zahlungszielTage: number): Iso {
  return plusTage(rechnungsdatum, zahlungszielTage);
}

export const KLEINUNTERNEHMER_HINWEIS = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";
/** § 14 Abs. 4 Nr. 9 UStG: Leistung im Zusammenhang mit einem Grundstück an Privatpersonen */
export const AUFBEWAHRUNG_HINWEIS =
  "Bitte bewahren Sie diese Rechnung zwei Jahre auf (§ 14b Abs. 1 Satz 5 UStG).";

export function pflichthinweise(p: { kleinunternehmer: boolean; privatkunde: boolean }): string[] {
  return [
    ...(p.kleinunternehmer ? [KLEINUNTERNEHMER_HINWEIS] : []),
    ...(p.privatkunde ? [AUFBEWAHRUNG_HINWEIS] : []),
  ];
}

export const EINHEIT_TEXT: Record<Preiseinheit, string> = {
  pauschal: "pauschal",
  stunde: "Std.",
  m2: "m²",
  fenster: "Fenster",
  stueck: "Stk.",
  einsatz: "Einsatz",
  monat: "Monat",
};

/** UN/ECE Rec. 20 Einheitencodes für die E-Rechnung */
export const EINHEIT_CODE: Record<Preiseinheit, string> = {
  pauschal: "LS",
  stunde: "HUR",
  m2: "MTK",
  fenster: "H87",
  stueck: "H87",
  einsatz: "C62",
  monat: "MON",
};
