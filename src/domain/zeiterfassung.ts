/**
 * Zeiterfassung aus Buchungen (Check-in/-out am Einsatz, Pausen).
 * Arbeitszeit = erster bis letzter Zeitpunkt des Tages abzüglich Pausen (Fahrten zählen mit).
 * Prüft die Pausenregeln nach § 4 ArbZG und die Höchstarbeitszeit nach § 3 ArbZG.
 */

export type Buchungsart = "checkin" | "checkout" | "pause_beginn" | "pause_ende";

export type Buchung = {
  id: string;
  art: Buchungsart;
  /** ISO-Zeitpunkt mit Zeitzone */
  zeitpunkt: string;
  einsatzId: string | null;
  storniert?: boolean;
};

export type Zeithinweis =
  | "checkout_fehlt"
  | "checkin_fehlt"
  | "pause_offen"
  | "pause_ende_ohne_beginn"
  | "pause_zu_kurz"
  | "ueber_10_stunden";

export type Einsatzzeit = { einsatzId: string; von: string; bis: string | null; minuten: number };

export type Tagesauswertung = {
  beginn: string | null;
  ende: string | null;
  anwesenheitMinuten: number;
  pauseMinuten: number;
  arbeitMinuten: number;
  einsaetze: Einsatzzeit[];
  /** was gerade läuft (nur mit `jetzt`) */
  laufend: { art: "einsatz"; einsatzId: string } | { art: "pause" } | null;
  hinweise: Zeithinweis[];
};

const MIN = 60_000;
const minuten = (von: string, bis: string) =>
  Math.max(0, Math.floor((Date.parse(bis) - Date.parse(von)) / MIN));

/** Mindestpause in Minuten nach § 4 ArbZG für eine Arbeitszeit. */
export function mindestpause(arbeitMinuten: number): number {
  if (arbeitMinuten > 9 * 60) return 45;
  if (arbeitMinuten > 6 * 60) return 30;
  return 0;
}

/**
 * Wertet die Buchungen eines Tages aus. Ohne `jetzt` bleiben offene Einsätze/Pausen offen
 * (mit Hinweis), mit `jetzt` laufen sie bis jetzt.
 */
export function werteTagAus(buchungen: Buchung[], jetzt?: Date): Tagesauswertung {
  const liste = buchungen
    .filter((b) => !b.storniert)
    .sort((a, b) => Date.parse(a.zeitpunkt) - Date.parse(b.zeitpunkt));
  const hinweise = new Set<Zeithinweis>();
  const einsaetze: Einsatzzeit[] = [];
  let offenerEinsatz: Einsatzzeit | null = null;
  let pauseSeit: string | null = null;
  let pauseMinuten = 0;
  /** Pausenblöcke ab 15 Minuten zählen für § 4 ArbZG */
  let anrechenbarePause = 0;

  const pauseSchliessen = (bis: string) => {
    const m = minuten(pauseSeit!, bis);
    pauseMinuten += m;
    if (m >= 15) anrechenbarePause += m;
    pauseSeit = null;
  };
  const einsatzSchliessen = (bis: string) => {
    offenerEinsatz!.bis = bis;
    offenerEinsatz!.minuten = minuten(offenerEinsatz!.von, bis);
    offenerEinsatz = null;
  };

  for (const b of liste) {
    switch (b.art) {
      case "checkin":
        if (offenerEinsatz) {
          hinweise.add("checkout_fehlt");
          einsatzSchliessen(b.zeitpunkt);
        }
        offenerEinsatz = { einsatzId: b.einsatzId ?? "", von: b.zeitpunkt, bis: null, minuten: 0 };
        einsaetze.push(offenerEinsatz);
        break;
      case "checkout":
        if (offenerEinsatz && (!b.einsatzId || offenerEinsatz.einsatzId === b.einsatzId)) {
          einsatzSchliessen(b.zeitpunkt);
        } else {
          hinweise.add("checkin_fehlt");
        }
        break;
      case "pause_beginn":
        if (pauseSeit) pauseSchliessen(b.zeitpunkt);
        pauseSeit = b.zeitpunkt;
        break;
      case "pause_ende":
        if (pauseSeit) pauseSchliessen(b.zeitpunkt);
        else hinweise.add("pause_ende_ohne_beginn");
        break;
    }
  }

  let laufend: Tagesauswertung["laufend"] = null;
  const jetztIso = jetzt?.toISOString();
  let ende = liste.at(-1)?.zeitpunkt ?? null;
  if (pauseSeit) {
    if (jetztIso) {
      laufend = { art: "pause" };
      pauseSchliessen(jetztIso);
      ende = jetztIso;
    } else {
      hinweise.add("pause_offen");
    }
  }
  if (offenerEinsatz) {
    const e: Einsatzzeit = offenerEinsatz;
    if (jetztIso) {
      if (!laufend) laufend = { art: "einsatz", einsatzId: e.einsatzId };
      e.minuten = minuten(e.von, jetztIso);
      ende = jetztIso;
    } else {
      hinweise.add("checkout_fehlt");
    }
  }

  const beginn = liste[0]?.zeitpunkt ?? null;
  const anwesenheit = beginn && ende ? minuten(beginn, ende) : 0;
  const arbeit = Math.max(0, anwesenheit - pauseMinuten);
  if (anrechenbarePause < mindestpause(arbeit)) hinweise.add("pause_zu_kurz");
  if (arbeit > 10 * 60) hinweise.add("ueber_10_stunden");

  return {
    beginn,
    ende,
    anwesenheitMinuten: anwesenheit,
    pauseMinuten,
    arbeitMinuten: arbeit,
    einsaetze,
    laufend,
    hinweise: [...hinweise],
  };
}

/** Uhrzeit in Europe/Berlin, z. B. "07:05". */
export function uhrzeitBerlin(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Kalendertag in Europe/Berlin für einen Zeitpunkt. */
export function tagBerlin(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(iso));
}

/** Ortszeit Europe/Berlin ("2026-11-23", "07:30") → ISO-Zeitpunkt in UTC. */
export function berlinZuIso(datum: string, uhrzeit: string): string {
  const [j, m, t] = datum.split("-").map(Number);
  const [h, min] = uhrzeit.split(":").map(Number);
  const alsUtc = Date.UTC(j!, m! - 1, t!, h!, min!);
  const versatz = (ms: number) => {
    const teile = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(ms));
    const w = (typ: string) => Number(teile.find((p) => p.type === typ)?.value);
    return Date.UTC(w("year"), w("month") - 1, w("day"), w("hour"), w("minute")) - ms;
  };
  // zweimal, damit Tage mit Zeitumstellung stimmen
  let ms = alsUtc - versatz(alsUtc);
  ms = alsUtc - versatz(ms);
  return new Date(ms).toISOString();
}
