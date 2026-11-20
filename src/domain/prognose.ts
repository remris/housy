/**
 * Material- und Verschleißprognose (Konzept „Material und Inventar mit Verbrauchsprognose“).
 * Oben läuft die Vorhersage aus dem Einsatzplan, unten die Wirklichkeit aus Abbuchungen und
 * „leer“-Meldungen. Reine Funktionen ohne DB; Mengen immer in der Artikeleinheit.
 */
import { type Iso, tageZwischen } from "./datum";
import type { Bedarf } from "./vorlagen";

/** Planungshorizont für Bestellmengen: etwa 4 Wochen Verbrauch. */
export const BESTELL_TAGE = 28;
/** Sicherheitszuschlag auf der Packliste (A hat genau 3 l für 3 l Bedarf → trotzdem einladen). */
export const PACK_PUFFER = 0.2;
/** Reichweite unter Lieferzeit plus diesem Puffer löst einen Bestellvorschlag aus. */
export const REICHWEITE_PUFFER_TAGE = 7;

const runde = (x: number) => Math.round(x * 10_000) / 10_000;

// ---------------------------------------------------------------------------
// Verbrauch je Objekt
// ---------------------------------------------------------------------------

/**
 * Bedarf einer Vorlage für ein bestimmtes Objekt: Objektwerte ersetzen die Vorlagenzeile mit
 * gleichem Artikel und Bezug, zusätzliche Objektzeilen kommen dazu.
 */
export function bedarfFuerObjekt(vorlage: Bedarf[], objekt: Bedarf[]): Bedarf[] {
  const schluessel = (b: Bedarf) => `${b.artikelId}|${b.bezug}`;
  const ersetzt = new Map(objekt.map((b) => [schluessel(b), b]));
  const ergebnis = vorlage.map((b) => ersetzt.get(schluessel(b)) ?? b);
  const vorhanden = new Set(vorlage.map(schluessel));
  for (const b of objekt) if (!vorhanden.has(schluessel(b))) ergebnis.push(b);
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Reichweite
// ---------------------------------------------------------------------------

export type Verbrauchstag = { datum: Iso; menge: number };

export type Reichweite = {
  /** Tag, an dem der Bestand voraussichtlich nicht mehr reicht (null: reicht über den Plan hinaus) */
  leerAm: Iso | null;
  /** Tage ab heute bis leer; über den Plan hinaus mit dem Durchschnitt hochgerechnet */
  tage: number | null;
  /** geplanter Verbrauch je Woche (Durchschnitt über den Plan) */
  jeWoche: number;
};

/**
 * Reichweite eines Bestands für einen geplanten Verbrauch ab heute. Ohne geplanten Verbrauch ist
 * die Reichweite unbegrenzt (tage = null).
 */
export function reichweite(
  bestand: number,
  verbrauch: Verbrauchstag[],
  heute: Iso,
  horizontTage: number,
): Reichweite {
  const plan = verbrauch
    .filter((v) => v.datum >= heute && v.menge > 0)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const summe = plan.reduce((s, v) => s + v.menge, 0);
  const jeTag = horizontTage > 0 ? summe / horizontTage : 0;
  const jeWoche = runde(jeTag * 7);
  if (bestand <= 0) return { leerAm: heute, tage: 0, jeWoche };
  let rest = bestand;
  for (const v of plan) {
    rest = runde(rest - v.menge);
    if (rest < 0) return { leerAm: v.datum, tage: tageZwischen(heute, v.datum), jeWoche };
  }
  if (jeTag === 0) return { leerAm: null, tage: null, jeWoche };
  return { leerAm: null, tage: Math.floor(horizontTage + rest / jeTag), jeWoche };
}

/** Wie viele Einsätze ein Bestand bei einem Verbrauch je Einsatz deckt (10 l / 0,5 l = 20). */
export function reichtFuerEinsaetze(bestand: number, jeEinsatz: number): number {
  return jeEinsatz > 0 ? Math.floor(runde(bestand / jeEinsatz)) : Infinity;
}

// ---------------------------------------------------------------------------
// Einkaufsliste
// ---------------------------------------------------------------------------

export type Bestellvorschlag = {
  /** Menge in der Artikeleinheit (ganze Gebinde) */
  menge: number;
  gebinde: number;
  grund: "mindestbestand" | "reichweite";
};

/**
 * Bestellvorschlag: wenn das Lager den Mindestbestand erreicht oder die Reichweite kürzer ist als
 * Lieferzeit plus Puffer. Bestellt wird der Bedarf für etwa 4 Wochen, damit der Mindestbestand
 * danach wieder steht, abzüglich Lager und offener Bestellungen, in ganzen Gebinden.
 */
export function bestellvorschlag(p: {
  lagerBestand: number;
  mindestbestand: number;
  gebindeMenge: number;
  lieferzeitTage: number;
  /** Bedarf für BESTELL_TAGE (Verbrauch bzw. erwartete Wechsel bei Verschleiß) */
  bedarfVierWochen: number;
  reichweiteTage: number | null;
  offenBestellt: number;
}): Bestellvorschlag | null {
  const verfuegbar = p.lagerBestand + p.offenBestellt;
  const unterMindest =
    verfuegbar <= p.mindestbestand && (p.mindestbestand > 0 || p.bedarfVierWochen > 0);
  const zuKurz =
    p.reichweiteTage !== null &&
    p.reichweiteTage < p.lieferzeitTage + REICHWEITE_PUFFER_TAGE &&
    p.offenBestellt === 0;
  if (!unterMindest && !zuKurz) return null;
  const fehlt = runde(p.bedarfVierWochen + p.mindestbestand - verfuegbar);
  const gebinde = Math.max(1, Math.ceil(fehlt / p.gebindeMenge - 1e-9));
  return {
    menge: runde(gebinde * p.gebindeMenge),
    gebinde,
    grund: unterMindest ? "mindestbestand" : "reichweite",
  };
}

// ---------------------------------------------------------------------------
// Packliste je Tour
// ---------------------------------------------------------------------------

export type Ladeposten = {
  artikelId: string;
  bedarf: number;
  fahrzeugBestand: number;
  /** ganze Gebinde, die eingeladen werden sollten (0 = reicht) */
  einladenGebinde: number;
  einladenMenge: number;
};

/**
 * Was ins Fahrzeug muss: Bedarf der geplanten Einsätze plus Puffer minus Fahrzeugbestand,
 * aufgerundet auf ganze Gebinde.
 */
export function ladeliste(
  posten: { artikelId: string; bedarf: number; fahrzeugBestand: number; gebindeMenge: number }[],
  puffer = PACK_PUFFER,
): Ladeposten[] {
  return posten
    .filter((p) => p.bedarf > 0)
    .map((p) => {
      const soll = runde(p.bedarf * (1 + puffer));
      const gebinde =
        p.fahrzeugBestand >= soll
          ? 0
          : Math.max(
              1,
              Math.ceil(runde(soll - Math.max(0, p.fahrzeugBestand)) / p.gebindeMenge - 1e-9),
            );
      return {
        artikelId: p.artikelId,
        bedarf: runde(p.bedarf),
        fahrzeugBestand: p.fahrzeugBestand,
        einladenGebinde: gebinde,
        einladenMenge: runde(gebinde * p.gebindeMenge),
      };
    });
}

// ---------------------------------------------------------------------------
// Verschleiß: gezählt wird ab dem echten Wechsel
// ---------------------------------------------------------------------------

export type Verschleissstufe = "ok" | "hinweis" | "faellig" | "ueberfaellig";

export type Verschleissstand = {
  stand: number;
  anteil: number;
  stufe: Verschleissstufe;
  /** um so viel über der Lebensdauer (z. B. „überfällig seit 200 Fenstern“) */
  ueberUm: number;
};

/** Nutzung seit dem letzten Wechsel: nur Einsätze, die nach dem Wechsel abgeschlossen wurden. */
export function zaehlerSeit(
  wechselAm: string | null,
  nutzung: { am: string; menge: number }[],
): number {
  const ab = wechselAm ? Date.parse(wechselAm) : -Infinity;
  return runde(nutzung.filter((n) => Date.parse(n.am) > ab).reduce((s, n) => s + n.menge, 0));
}

/** Stufen statt Zwang: ab 80 % Hinweis, ab 100 % fällig, ab 110 % überfällig. Gesperrt wird nichts. */
export function verschleissStand(stand: number, lebensdauer: number): Verschleissstand {
  const anteil = lebensdauer > 0 ? stand / lebensdauer : 0;
  const stufe: Verschleissstufe =
    anteil >= 1.1 ? "ueberfaellig" : anteil >= 1 ? "faellig" : anteil >= 0.8 ? "hinweis" : "ok";
  return {
    stand: runde(stand),
    anteil: Math.round(anteil * 1000) / 1000,
    stufe,
    ueberUm: runde(Math.max(0, stand - lebensdauer)),
  };
}

/** Tag, an dem die Lebensdauer nach Plan erreicht wird (null: nicht im Plan). */
export function wechselFaelligAm(
  stand: number,
  lebensdauer: number,
  geplant: Verbrauchstag[],
): Iso | null {
  if (stand >= lebensdauer) return null;
  let s = stand;
  for (const g of [...geplant].sort((a, b) => a.datum.localeCompare(b.datum))) {
    s = runde(s + g.menge);
    if (s >= lebensdauer) return g.datum;
  }
  return null;
}

/**
 * Erwartete Wechsel in einem Zeitraum (ohne Übertrag: jeder Wechsel startet bei 0).
 * Ein schon fälliges Teil zählt als ein Wechsel.
 */
export function erwarteteWechsel(stand: number, lebensdauer: number, nutzung: number): number {
  if (lebensdauer <= 0) return 0;
  const sofort = stand >= lebensdauer ? 1 : 0;
  const start = sofort ? 0 : stand;
  return sofort + Math.floor(runde((start + nutzung) / lebensdauer));
}

/**
 * Vorschlag für eine neue Lebensdauer aus den echten Wechseln (Defekte zählen nicht).
 * Erst ab 3 Wechseln und nur bei mehr als 15 % Abweichung; der Inhaber entscheidet.
 */
export function lebensdauerVorschlag(
  wechsel: { stand: number; grund: "verschleiss" | "defekt" | "auto" }[],
  lebensdauer: number,
): number | null {
  const echt = wechsel.filter((w) => w.grund === "verschleiss" && w.stand > 0);
  if (echt.length < 3) return null;
  const schnitt = echt.reduce((s, w) => s + w.stand, 0) / echt.length;
  if (Math.abs(schnitt - lebensdauer) / lebensdauer <= 0.15) return null;
  const stufe = schnitt >= 100 ? 10 : 1;
  return Math.round(schnitt / stufe) * stufe;
}

// ---------------------------------------------------------------------------
// Prüftermine
// ---------------------------------------------------------------------------

export type Pruefstatus = {
  faelligAm: Iso | null;
  stufe: "ok" | "bald" | "ueberfaellig";
  tage: number | null;
};

/** Prüftermin: „bald“ ab 30 Tagen vorher, „überfällig“ ab dem Fälligkeitstag. */
export function pruefstatus(naechstePruefung: Iso | null, heute: Iso): Pruefstatus {
  if (!naechstePruefung) return { faelligAm: null, stufe: "ok", tage: null };
  const tage = tageZwischen(heute, naechstePruefung);
  return {
    faelligAm: naechstePruefung,
    stufe: tage <= 0 ? "ueberfaellig" : tage <= 30 ? "bald" : "ok",
    tage,
  };
}

// ---------------------------------------------------------------------------
// Ist-Korrektur aus „leer“-Meldungen
// ---------------------------------------------------------------------------

export type Istkorrektur = {
  /** tatsächlicher Verbrauch je Einsatz, sinnvoll gerundet */
  istJeEinsatz: number;
  sollJeEinsatz: number;
  /** z. B. 0,25 = 25 % mehr als geplant */
  abweichung: number;
  /** Buchbestand zum Zeitpunkt der Meldung (der eigentlich noch da sein müsste) */
  rechnerischRest: number;
};

const sinnvoll = (x: number) => (x >= 0.1 ? Math.round(x * 10) / 10 : Math.round(x * 1000) / 1000);

/**
 * „Leer“ gemeldet, obwohl laut Buch noch etwas da sein müsste: Was seit dem letzten Laden im
 * Fahrzeug war, wurde in den Einsätzen seitdem verbraucht. Unter 10 % Abweichung kein Vorschlag.
 */
export function istKorrektur(p: {
  /** Bestand direkt nach dem letzten Laden */
  bestandNachLaden: number;
  /** abgebuchte Einsätze seit dem Laden (bis zur Meldung) */
  einsaetzeSeitLaden: number;
  sollJeEinsatz: number;
  /** Buchbestand bei der Meldung */
  buchbestand: number;
}): Istkorrektur | null {
  if (p.einsaetzeSeitLaden <= 0 || p.sollJeEinsatz <= 0 || p.buchbestand <= 0) return null;
  const ist = p.bestandNachLaden / p.einsaetzeSeitLaden;
  const abweichung = ist / p.sollJeEinsatz - 1;
  if (abweichung < 0.1) return null;
  return {
    istJeEinsatz: sinnvoll(ist),
    sollJeEinsatz: p.sollJeEinsatz,
    abweichung: Math.round(abweichung * 100) / 100,
    rechnerischRest: runde(p.buchbestand),
  };
}
