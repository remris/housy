/**
 * Serienplanung: erzeugt aus Vertrag, Vertragsversionen und Leistungen die Soll-Einsätze
 * für einen Zeitraum und gleicht sie mit bestehenden Einsätzen ab.
 *
 * Regeln:
 * - Je Datum gilt die jüngste Version mit gueltig_ab <= Datum.
 * - Wiederholung: täglich (alle n Tage), wöchentlich an Wochentagen (alle n Wochen),
 *   monatlich am Monatstag (alle n Monate, begrenzt aufs Monatsende) oder einmalig.
 * - Feiertage: auslassen, auf den nächsten Werktag verschieben oder ignorieren.
 * - Neue Version ändert nur Einsätze ab Stichtag; Vergangenes und Begonnenes bleibt.
 */
import {
  type Iso,
  plusMonate,
  plusTage,
  tageImBereich,
  tageZwischen,
  wochenbeginn,
  wochentag,
  zuDatum,
} from "./datum";

export type Frequenz = "taeglich" | "woechentlich" | "monatlich" | "einmalig";
export type FeiertagRegel = "auslassen" | "naechster_werktag" | "ignorieren";

export type Wiederholung = {
  frequenz: Frequenz;
  /** alle n Tage/Wochen/Monate (>= 1) */
  intervall: number;
  /** ISO-Wochentage 1=Mo … 7=So (für wöchentlich) */
  wochentage?: number[];
  /** Tag im Monat 1–31 (für monatlich; größer als Monatsende = letzter Tag) */
  monatstag?: number | null;
  /** Bezugsdatum für Intervalle und Startpunkt */
  anker: Iso;
};

export type Leistung = {
  id: string;
  vorlageId: string;
  wiederholung: Wiederholung;
  feiertagRegel: FeiertagRegel;
  zeitfensterVon?: string | null;
  zeitfensterBis?: string | null;
  /** nur an diesen Wochentagen erlaubt (Reinigungsfenster, z. B. Mo–Fr); leer = alle */
  erlaubteWochentage?: number[];
  sollzeitMinuten: number;
};

export type Version = { id: string; gueltigAb: Iso; leistungen: Leistung[] };

export type Vertragsplan = {
  beginn: Iso;
  /** letzter Tag mit Leistung (Laufzeitende/Kündigung), null = offen */
  ende: Iso | null;
  versionen: Version[];
};

export type SollEinsatz = {
  datum: Iso;
  versionId: string;
  leistungId: string;
  vorlageId: string;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  sollzeitMinuten: number;
  /** ursprünglicher Serientermin, falls wegen Feiertag verschoben */
  verschobenVon: Iso | null;
};

/** Prüft, ob ein Datum ein Serientermin der Wiederholung ist (ohne Feiertage). */
export function istTermin(w: Wiederholung, datum: Iso): boolean {
  if (datum < w.anker) return false;
  const n = Math.max(1, Math.floor(w.intervall));
  switch (w.frequenz) {
    case "einmalig":
      return datum === w.anker;
    case "taeglich":
      return tageZwischen(w.anker, datum) % n === 0;
    case "woechentlich": {
      const tage = w.wochentage?.length ? w.wochentage : [wochentag(w.anker)];
      if (!tage.includes(wochentag(datum))) return false;
      const wochen = tageZwischen(wochenbeginn(w.anker), wochenbeginn(datum)) / 7;
      return wochen % n === 0;
    }
    case "monatlich": {
      const a = zuDatum(w.anker);
      const d = zuDatum(datum);
      const monate =
        (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + (d.getUTCMonth() - a.getUTCMonth());
      if (monate % n !== 0) return false;
      const sollTag = w.monatstag ?? a.getUTCDate();
      const monatsLetzter = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate();
      return d.getUTCDate() === Math.min(sollTag, monatsLetzter);
    }
  }
}

/** Alle Termine einer Wiederholung im Zeitraum [von, bis] (ohne Feiertagsregel). */
export function termine(w: Wiederholung, von: Iso, bis: Iso): Iso[] {
  const start = von > w.anker ? von : w.anker;
  if (start > bis) return [];
  if (w.frequenz === "einmalig") return w.anker >= von && w.anker <= bis ? [w.anker] : [];
  if (w.frequenz === "monatlich") {
    // Monate direkt durchlaufen statt jeden Tag zu prüfen
    const ergebnis: Iso[] = [];
    const n = Math.max(1, Math.floor(w.intervall));
    const tag = w.monatstag ?? zuDatum(w.anker).getUTCDate();
    const ankerMonat = `${w.anker.slice(0, 7)}-01`;
    for (let i = 0; ; i += n) {
      const ersterImMonat = plusMonate(ankerMonat, i);
      if (ersterImMonat > bis) break;
      const d = zuDatum(ersterImMonat);
      const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const datum = `${ersterImMonat.slice(0, 8)}${String(Math.min(tag, letzter)).padStart(2, "0")}`;
      if (datum >= start && datum <= bis) ergebnis.push(datum);
    }
    return ergebnis;
  }
  return [...tageImBereich(start, bis)].filter((d) => istTermin(w, d));
}

function erlaubt(datum: Iso, l: Leistung, feiertage: Set<Iso> | Map<Iso, string>): boolean {
  if (l.erlaubteWochentage?.length && !l.erlaubteWochentage.includes(wochentag(datum)))
    return false;
  if (l.feiertagRegel !== "ignorieren" && feiertage.has(datum)) return false;
  return true;
}

/** Wendet Feiertagsregel und erlaubte Wochentage auf einen Termin an. */
export function verschiebe(
  datum: Iso,
  l: Leistung,
  feiertage: Set<Iso> | Map<Iso, string>,
): Iso | null {
  if (erlaubt(datum, l, feiertage)) return datum;
  const istFeiertag = feiertage.has(datum);
  if (!istFeiertag || l.feiertagRegel === "auslassen") return null;
  // Nächster erlaubter Tag, höchstens 14 Tage später
  for (let i = 1; i <= 14; i++) {
    const d = plusTage(datum, i);
    if (erlaubt(d, l, feiertage)) return d;
  }
  return null;
}

/** Gültige Version für ein Datum (jüngste mit gueltigAb <= Datum). */
export function versionAm(versionen: Version[], datum: Iso): Version | null {
  let treffer: Version | null = null;
  for (const v of versionen) {
    if (v.gueltigAb <= datum && (!treffer || v.gueltigAb > treffer.gueltigAb)) treffer = v;
  }
  return treffer;
}

/**
 * Soll-Einsätze eines Vertrags im Zeitraum [von, bis].
 * Eine Version erzeugt nur Termine in ihrem Gültigkeitszeitraum; verschobene Termine
 * bleiben bei der Version ihres ursprünglichen Datums.
 */
export function planeVertrag(
  plan: Vertragsplan,
  von: Iso,
  bis: Iso,
  feiertage: Set<Iso> | Map<Iso, string>,
): SollEinsatz[] {
  const start = von > plan.beginn ? von : plan.beginn;
  const ende = plan.ende && plan.ende < bis ? plan.ende : bis;
  if (start > ende) return [];
  const versionen = [...plan.versionen].sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb));
  const ergebnis: SollEinsatz[] = [];

  versionen.forEach((v, i) => {
    const vVon = v.gueltigAb > plan.beginn ? v.gueltigAb : plan.beginn;
    const naechste = versionen[i + 1];
    const vBis = naechste ? plusTage(naechste.gueltigAb, -1) : (plan.ende ?? bis);
    // Etwas Vorlauf, damit Feiertags-Verschiebungen kurz vor dem Zeitraum erfasst werden
    const suchVon = [plusTage(start, -14), vVon].sort()[1]!;
    const suchBis = [ende, vBis].sort()[0]!;
    if (suchVon > suchBis) return;
    for (const l of v.leistungen) {
      for (const t of termine(l.wiederholung, suchVon, suchBis)) {
        const d = verschiebe(t, l, feiertage);
        if (!d || d < start || d > ende) continue;
        ergebnis.push({
          datum: d,
          versionId: v.id,
          leistungId: l.id,
          vorlageId: l.vorlageId,
          zeitfensterVon: l.zeitfensterVon ?? null,
          zeitfensterBis: l.zeitfensterBis ?? null,
          sollzeitMinuten: l.sollzeitMinuten,
          verschobenVon: d === t ? null : t,
        });
      }
    }
  });

  // Doppelte (gleiche Vorlage am gleichen Tag, z. B. durch Verschiebung) zusammenfassen
  const gesehen = new Set<string>();
  return ergebnis
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.vorlageId.localeCompare(b.vorlageId))
    .filter((e) => {
      const k = schluessel(e);
      if (gesehen.has(k)) return false;
      gesehen.add(k);
      return true;
    });
}

export const schluessel = (e: { datum: Iso; vorlageId: string }) => `${e.vorlageId}|${e.datum}`;

export type IstEinsatz = {
  id: string;
  datum: Iso;
  vorlageId: string;
  leistungId: string | null;
  status: string;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  sollzeitMinuten: number;
};

/** Status, bei denen ein Serien-Einsatz noch automatisch geändert oder gelöscht werden darf. */
export const AENDERBAR = new Set(["geplant", "zugewiesen"]);

export type Abgleich = {
  anlegen: SollEinsatz[];
  aktualisieren: { id: string; soll: SollEinsatz }[];
  loeschen: string[];
};

/**
 * Gleicht Soll mit vorhandenen Serien-Einsätzen ab dem Stichtag ab.
 * Zuordnung über Vorlage + Datum, damit Zuweisungen an Mitarbeiter erhalten bleiben.
 * Einsätze vor dem Stichtag oder bereits begonnene/erledigte bleiben unberührt.
 */
export function gleicheAb(soll: SollEinsatz[], ist: IstEinsatz[], stichtag: Iso): Abgleich {
  const sollAb = soll.filter((s) => s.datum >= stichtag);
  const istNachSchluessel = new Map<string, IstEinsatz>();
  const ergebnis: Abgleich = { anlegen: [], aktualisieren: [], loeschen: [] };
  for (const e of ist) {
    if (e.datum < stichtag) continue;
    const k = schluessel(e);
    if (istNachSchluessel.has(k) && AENDERBAR.has(e.status)) {
      ergebnis.loeschen.push(e.id); // Dublette
      continue;
    }
    istNachSchluessel.set(k, e);
  }
  const sollSchluessel = new Set(sollAb.map(schluessel));
  for (const s of sollAb) {
    const e = istNachSchluessel.get(schluessel(s));
    if (!e) ergebnis.anlegen.push(s);
    else if (
      AENDERBAR.has(e.status) &&
      (e.leistungId !== s.leistungId ||
        e.zeitfensterVon !== s.zeitfensterVon ||
        e.zeitfensterBis !== s.zeitfensterBis ||
        e.sollzeitMinuten !== s.sollzeitMinuten)
    ) {
      ergebnis.aktualisieren.push({ id: e.id, soll: s });
    }
  }
  for (const [k, e] of istNachSchluessel) {
    if (!sollSchluessel.has(k) && AENDERBAR.has(e.status)) ergebnis.loeschen.push(e.id);
  }
  return ergebnis;
}

/** Lesbare Beschreibung einer Wiederholung, z. B. "alle 2 Wochen Mo, Mi". */
export function beschreibeWiederholung(w: Omit<Wiederholung, "anker">): string {
  const tage = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const n = w.intervall;
  switch (w.frequenz) {
    case "einmalig":
      return "einmalig";
    case "taeglich":
      return n === 1 ? "täglich" : `alle ${n} Tage`;
    case "woechentlich": {
      const t = (w.wochentage ?? [])
        .slice()
        .sort()
        .map((x) => tage[x - 1])
        .join(", ");
      return `${n === 1 ? "wöchentlich" : `alle ${n} Wochen`}${t ? ` ${t}` : ""}`;
    }
    case "monatlich":
      return `${n === 1 ? "monatlich" : `alle ${n} Monate`}${w.monatstag ? ` am ${w.monatstag}.` : ""}`;
  }
}
