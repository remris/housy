/**
 * Planung und Touren: Tagestour mit Fahrzeiten und Ankunftszeiten, Reihenfolge-Vorschlag
 * und Konfliktprüfung (Überschneidung, Abwesenheit, Arbeitszeit, Reinigungsfenster).
 * Rein fachlich, ohne DB und ohne Kartendienst: Fahrzeiten kommen als Matrix herein.
 */
import { type Iso, wochentag } from "./datum";

// ---------------------------------------------------------------------------
// Uhrzeiten als Minuten seit Mitternacht
// ---------------------------------------------------------------------------

/** "07:30" oder "07:30:00" → 450 */
export function zuMinuten(uhrzeit: string): number {
  const [h, m] = uhrzeit.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 450 → "07:30"; über Mitternacht hinaus wird weitergezählt ("24:15"). */
export function zuUhrzeit(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Fahrzeiten
// ---------------------------------------------------------------------------

export type Koordinate = { lat: number; lng: number };

/** Fahrzeit-Matrix in Minuten. Index 0 ist der Startpunkt (Betrieb), 1…n die Einsätze. */
export type Matrix = number[][];

/** Annahme, wenn ein Objekt keine Koordinaten hat. */
export const FAHRZEIT_UNBEKANNT = 15;

/** Luftlinie in km (Haversine). */
export function entfernungKm(a: Koordinate, b: Koordinate): number {
  const r = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Schätzt die Fahrzeit ohne Routing-Dienst: Luftlinie × 1,3 (Umwege) bei 35 km/h im Stadtverkehr,
 * plus 3 Minuten für Parken. Gleicher Ort = 0.
 */
export function schaetzeFahrzeit(a: Koordinate | null, b: Koordinate | null): number {
  if (!a || !b) return FAHRZEIT_UNBEKANNT;
  const km = entfernungKm(a, b);
  if (km < 0.05) return 0;
  return Math.round((km * 1.3 * 60) / 35) + 3;
}

export function schaetzeMatrix(punkte: (Koordinate | null)[]): Matrix {
  return punkte.map((a) => punkte.map((b) => (a === b ? 0 : schaetzeFahrzeit(a, b))));
}

// ---------------------------------------------------------------------------
// Tagestour
// ---------------------------------------------------------------------------

export type TourStopp = {
  id: string;
  sollzeitMinuten: number;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
};

export type TourWarnung = "fenster_verpasst" | "fenster_zu_knapp";

export type TourZeit = {
  id: string;
  fahrzeitMinuten: number;
  ankunft: string;
  beginn: string;
  ende: string;
  warteMinuten: number;
  warnung: TourWarnung | null;
};

export type Tour = {
  stopps: TourZeit[];
  rueckfahrtMinuten: number;
  rueckkehr: string;
  fahrzeitGesamt: number;
  arbeitszeitGesamt: number;
  warnungen: number;
};

/**
 * Rechnet eine Tour in der gegebenen Reihenfolge durch.
 * `fahrzeiten[i]` ist die Fahrzeit zum i-ten Stopp (vom Start bzw. vom vorigen Stopp),
 * `fahrzeiten[n]` die Rückfahrt. Wer zu früh ankommt, wartet bis zum Fensterbeginn.
 */
export function berechneTour(start: string, stopps: TourStopp[], fahrzeiten: number[]): Tour {
  let uhr = zuMinuten(start);
  let fahrzeitGesamt = 0;
  let arbeitszeitGesamt = 0;
  const zeiten: TourZeit[] = stopps.map((s, i) => {
    const fahrt = fahrzeiten[i] ?? FAHRZEIT_UNBEKANNT;
    fahrzeitGesamt += fahrt;
    const ankunft = uhr + fahrt;
    const fensterVon = s.zeitfensterVon ? zuMinuten(s.zeitfensterVon) : null;
    const fensterBis = s.zeitfensterBis ? zuMinuten(s.zeitfensterBis) : null;
    const beginn = fensterVon !== null ? Math.max(ankunft, fensterVon) : ankunft;
    const ende = beginn + s.sollzeitMinuten;
    arbeitszeitGesamt += s.sollzeitMinuten;
    let warnung: TourWarnung | null = null;
    if (fensterBis !== null && beginn >= fensterBis) warnung = "fenster_verpasst";
    else if (fensterBis !== null && ende > fensterBis) warnung = "fenster_zu_knapp";
    uhr = ende;
    return {
      id: s.id,
      fahrzeitMinuten: fahrt,
      ankunft: zuUhrzeit(ankunft),
      beginn: zuUhrzeit(beginn),
      ende: zuUhrzeit(ende),
      warteMinuten: beginn - ankunft,
      warnung,
    };
  });
  const rueck = stopps.length ? (fahrzeiten[stopps.length] ?? FAHRZEIT_UNBEKANNT) : 0;
  return {
    stopps: zeiten,
    rueckfahrtMinuten: rueck,
    rueckkehr: zuUhrzeit(uhr + rueck),
    fahrzeitGesamt: fahrzeitGesamt + rueck,
    arbeitszeitGesamt,
    warnungen: zeiten.filter((z) => z.warnung).length,
  };
}

/** Fahrzeiten entlang einer Reihenfolge (Indizes der Stopps 0…n-1) aus der Matrix. */
export function fahrzeitenEntlang(matrix: Matrix, reihenfolge: number[]): number[] {
  const punkte = [0, ...reihenfolge.map((i) => i + 1), 0];
  const ergebnis: number[] = [];
  for (let k = 1; k < punkte.length; k++) {
    ergebnis.push(matrix[punkte[k - 1]!]?.[punkte[k]!] ?? FAHRZEIT_UNBEKANNT);
  }
  return ergebnis;
}

/** Tour für eine Reihenfolge berechnen. */
export function tourFuer(
  start: string,
  stopps: TourStopp[],
  matrix: Matrix,
  reihenfolge: number[] = stopps.map((_, i) => i),
): Tour {
  return berechneTour(
    start,
    reihenfolge.map((i) => stopps[i]!),
    fahrzeitenEntlang(matrix, reihenfolge),
  );
}

/** Bewertung: jede Fensterverletzung wiegt schwerer als jede Fahrzeit. */
function kosten(t: Tour): number {
  return t.warnungen * 10_000 + t.fahrzeitGesamt + zuMinuten(t.rueckkehr) / 1000;
}

/**
 * Schlägt eine Reihenfolge vor: Start mit frühestem Fensterende bzw. nächstem Nachbarn,
 * dann 2-opt-Verbesserung. Für Tagestouren (bis ca. 20 Stopps) schnell genug und gut.
 */
export function optimiereReihenfolge(start: string, stopps: TourStopp[], matrix: Matrix): number[] {
  const n = stopps.length;
  if (n <= 1) return stopps.map((_, i) => i);

  // Startlösung 1: nächster Nachbar
  const offen = new Set(stopps.map((_, i) => i));
  const nachbar: number[] = [];
  let ort = 0;
  while (offen.size) {
    let best = -1;
    let bestZeit = Infinity;
    for (const i of offen) {
      const z = matrix[ort]?.[i + 1] ?? FAHRZEIT_UNBEKANNT;
      if (z < bestZeit) {
        bestZeit = z;
        best = i;
      }
    }
    nachbar.push(best);
    offen.delete(best);
    ort = best + 1;
  }
  // Startlösung 2: nach Fensterende sortiert (enge Fenster zuerst)
  const nachFenster = stopps
    .map((s, i) => ({ i, bis: s.zeitfensterBis ? zuMinuten(s.zeitfensterBis) : 24 * 60 }))
    .sort((a, b) => a.bis - b.bis || a.i - b.i)
    .map((x) => x.i);

  let beste = [nachbar, nachFenster]
    .map((r) => ({ r, k: kosten(tourFuer(start, stopps, matrix, r)) }))
    .sort((a, b) => a.k - b.k)[0]!;

  // 2-opt
  let verbessert = true;
  while (verbessert) {
    verbessert = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = [
          ...beste.r.slice(0, i),
          ...beste.r.slice(i, j + 1).reverse(),
          ...beste.r.slice(j + 1),
        ];
        const k = kosten(tourFuer(start, stopps, matrix, r));
        if (k < beste.k - 1e-9) {
          beste = { r, k };
          verbessert = true;
        }
      }
    }
  }
  return beste.r;
}

// ---------------------------------------------------------------------------
// Konflikte
// ---------------------------------------------------------------------------

export type Arbeitszeit = { wochentag: number; von: string; bis: string };
export type Abwesenheit = { von: Iso; bis: Iso; art: "urlaub" | "krank" | "sonstiges" };

export type PlanMitarbeiter = {
  id: string;
  name: string;
  /** leer = keine Arbeitszeiten hinterlegt, dann wird nicht gegen Arbeitszeiten geprüft */
  arbeitszeiten: Arbeitszeit[];
  abwesenheiten: Abwesenheit[];
};

export type PlanEinsatz = {
  id: string;
  datum: Iso;
  mitarbeiterId: string | null;
  sollzeitMinuten: number;
  zeitfensterVon: string | null;
  zeitfensterBis: string | null;
  /** aus der berechneten Tour; ohne Tour wird nur die Tagessumme geprüft */
  geplanterBeginn: string | null;
  fahrzeitMinuten: number | null;
  /** nur Einsätze, die noch geplant werden; erledigte/abgesagte nicht übergeben */
  bezeichnung?: string;
};

export type KonfliktArt =
  | "abwesend"
  | "kein_arbeitstag"
  | "ausserhalb_arbeitszeit"
  | "ueberlastet"
  | "ueberschneidung"
  | "zeitfenster"
  | "fenster_zu_kurz";

export type Konflikt = {
  art: KonfliktArt;
  datum: Iso;
  mitarbeiterId: string | null;
  einsatzIds: string[];
  text: string;
};

const ABWESENHEIT_TEXT = { urlaub: "Urlaub", krank: "krank", sonstiges: "abwesend" } as const;

export function abwesenheitAm(m: PlanMitarbeiter, datum: Iso): Abwesenheit | undefined {
  return m.abwesenheiten.find((a) => a.von <= datum && datum <= a.bis);
}

export function arbeitszeitAm(m: PlanMitarbeiter, datum: Iso): Arbeitszeit | undefined {
  const wt = wochentag(datum);
  return m.arbeitszeiten.find((a) => a.wochentag === wt);
}

/** Verfügbare Minuten an einem Tag; null = keine Arbeitszeiten hinterlegt. */
export function verfuegbareMinuten(m: PlanMitarbeiter, datum: Iso): number | null {
  if (abwesenheitAm(m, datum)) return 0;
  if (!m.arbeitszeiten.length) return null;
  const az = arbeitszeitAm(m, datum);
  return az ? zuMinuten(az.bis) - zuMinuten(az.von) : 0;
}

/** Benötigte Minuten (Arbeit + Fahrt) eines Einsatzes. */
export const bedarfMinuten = (e: PlanEinsatz) => e.sollzeitMinuten + (e.fahrzeitMinuten ?? 0);

/**
 * Findet Konflikte in einem Plan. Prüft je Einsatz das Reinigungsfenster und je Mitarbeiter
 * und Tag Abwesenheit, Arbeitstag, Arbeitszeit, Auslastung und Überschneidungen.
 */
export function findeKonflikte(
  einsaetze: PlanEinsatz[],
  mitarbeiter: PlanMitarbeiter[],
): Konflikt[] {
  const konflikte: Konflikt[] = [];
  const nachId = new Map(mitarbeiter.map((m) => [m.id, m]));
  const name = (e: PlanEinsatz) => e.bezeichnung ?? "Einsatz";

  // Einsatz für sich: Fenster kürzer als Sollzeit, geplanter Beginn außerhalb des Fensters
  for (const e of einsaetze) {
    const von = e.zeitfensterVon ? zuMinuten(e.zeitfensterVon) : null;
    const bis = e.zeitfensterBis ? zuMinuten(e.zeitfensterBis) : null;
    if (von !== null && bis !== null && bis - von < e.sollzeitMinuten) {
      konflikte.push({
        art: "fenster_zu_kurz",
        datum: e.datum,
        mitarbeiterId: e.mitarbeiterId,
        einsatzIds: [e.id],
        text: `${name(e)}: Zeitfenster ${e.zeitfensterVon!.slice(0, 5)}–${e.zeitfensterBis!.slice(0, 5)} ist kürzer als die Sollzeit (${e.sollzeitMinuten} min)`,
      });
      continue;
    }
    if (e.geplanterBeginn) {
      const b = zuMinuten(e.geplanterBeginn);
      if ((von !== null && b < von) || (bis !== null && b + e.sollzeitMinuten > bis)) {
        konflikte.push({
          art: "zeitfenster",
          datum: e.datum,
          mitarbeiterId: e.mitarbeiterId,
          einsatzIds: [e.id],
          text: `${name(e)}: geplant ${zuUhrzeit(b)}–${zuUhrzeit(b + e.sollzeitMinuten)}, erlaubt ${e.zeitfensterVon?.slice(0, 5) ?? "…"}–${e.zeitfensterBis?.slice(0, 5) ?? "…"}`,
        });
      }
    }
  }

  // je Mitarbeiter und Tag
  const gruppen = new Map<string, PlanEinsatz[]>();
  for (const e of einsaetze) {
    if (!e.mitarbeiterId) continue;
    const k = `${e.mitarbeiterId}|${e.datum}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), e]);
  }
  for (const liste of gruppen.values()) {
    const { mitarbeiterId, datum } = liste[0]!;
    const m = nachId.get(mitarbeiterId!);
    if (!m) continue;
    const ids = liste.map((e) => e.id);

    const abw = abwesenheitAm(m, datum);
    if (abw) {
      konflikte.push({
        art: "abwesend",
        datum,
        mitarbeiterId,
        einsatzIds: ids,
        text: `${m.name} ist ${ABWESENHEIT_TEXT[abw.art]}`,
      });
      continue;
    }

    const az = m.arbeitszeiten.length ? arbeitszeitAm(m, datum) : null;
    if (az === undefined) {
      konflikte.push({
        art: "kein_arbeitstag",
        datum,
        mitarbeiterId,
        einsatzIds: ids,
        text: `${m.name} arbeitet an diesem Wochentag nicht`,
      });
      continue;
    }

    if (az) {
      const verfuegbar = zuMinuten(az.bis) - zuMinuten(az.von);
      const bedarf = liste.reduce((s, e) => s + bedarfMinuten(e), 0);
      if (bedarf > verfuegbar) {
        konflikte.push({
          art: "ueberlastet",
          datum,
          mitarbeiterId,
          einsatzIds: ids,
          text: `${m.name}: ${zuDauer(bedarf)} geplant, ${zuDauer(verfuegbar)} Arbeitszeit`,
        });
      }
      const ausserhalb = liste.filter(
        (e) =>
          e.geplanterBeginn &&
          (zuMinuten(e.geplanterBeginn) < zuMinuten(az.von) ||
            zuMinuten(e.geplanterBeginn) + e.sollzeitMinuten > zuMinuten(az.bis)),
      );
      if (ausserhalb.length) {
        konflikte.push({
          art: "ausserhalb_arbeitszeit",
          datum,
          mitarbeiterId,
          einsatzIds: ausserhalb.map((e) => e.id),
          text: `${m.name}: Einsätze außerhalb der Arbeitszeit ${az.von.slice(0, 5)}–${az.bis.slice(0, 5)}`,
        });
      }
    }

    // Überschneidungen anhand der geplanten Zeiten
    const mitZeit = liste
      .filter((e) => e.geplanterBeginn)
      .map((e) => ({
        e,
        von: zuMinuten(e.geplanterBeginn!),
        bis: zuMinuten(e.geplanterBeginn!) + e.sollzeitMinuten,
      }))
      .sort((a, b) => a.von - b.von);
    for (let i = 1; i < mitZeit.length; i++) {
      const vorher = mitZeit[i - 1]!;
      const jetzt = mitZeit[i]!;
      if (jetzt.von < vorher.bis) {
        konflikte.push({
          art: "ueberschneidung",
          datum,
          mitarbeiterId,
          einsatzIds: [vorher.e.id, jetzt.e.id],
          text: `${m.name}: ${name(vorher.e)} und ${name(jetzt.e)} überschneiden sich`,
        });
      }
    }
  }
  return konflikte;
}

/** 135 → "2:15 h" */
export function zuDauer(minuten: number): string {
  const m = Math.round(minuten);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}

/** Auslastung je Mitarbeiter und Tag für die Wochenansicht. */
export function auslastung(
  einsaetze: PlanEinsatz[],
  m: PlanMitarbeiter,
  datum: Iso,
): { bedarf: number; verfuegbar: number | null } {
  const bedarf = einsaetze
    .filter((e) => e.mitarbeiterId === m.id && e.datum === datum)
    .reduce((s, e) => s + bedarfMinuten(e), 0);
  return { bedarf, verfuegbar: verfuegbareMinuten(m, datum) };
}
