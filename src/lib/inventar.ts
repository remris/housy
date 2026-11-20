/**
 * Inventar: Bedarf aus Einsätzen, Prognose, Abbuchung und Werkzeugstände. Ohne Geheimnisse,
 * damit die Mitarbeiter-App (Browser) dieselben Funktionen nutzen kann; Rechte regelt RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Iso, plusTage } from "@/domain/datum";
import { abbuchungsort } from "@/domain/lager";
import {
  BESTELL_TAGE,
  type Bestellvorschlag,
  type Istkorrektur,
  type Pruefstatus,
  type Reichweite,
  type Verbrauchstag,
  type Verschleissstand,
  bedarfFuerObjekt,
  bestellvorschlag,
  erwarteteWechsel,
  istKorrektur,
  lebensdauerVorschlag,
  pruefstatus,
  reichweite,
  verschleissStand,
  wechselFaelligAm,
  zaehlerSeit,
} from "@/domain/prognose";
import {
  type Bedarf,
  type Bedarfsbezug,
  type Einsatzumfang,
  bedarfJeEinsatz,
} from "@/domain/vorlagen";
import { berlinZuIso } from "@/domain/zeiterfassung";
import type { AppWerkzeug } from "@/domain/app";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
const SEITE = 1000;

export type Artikel = Pick<
  Tables<"artikel">,
  | "id"
  | "name"
  | "art"
  | "einheit"
  | "gebinde_name"
  | "gebinde_menge"
  | "mindestbestand"
  | "lieferzeit_tage"
  | "lieferant"
  | "lebensdauer"
  | "lebensdauer_einheit"
  | "auto_wechsel"
  | "pruefintervall_monate"
  | "preis_cent"
>;
const ARTIKEL_SPALTEN =
  "id, name, art, einheit, gebinde_name, gebinde_menge, mindestbestand, lieferzeit_tage, lieferant, lebensdauer, lebensdauer_einheit, auto_wechsel, pruefintervall_monate, preis_cent";

/** Einsatz mit allem, was Verbrauch und Werkzeugnutzung braucht. */
export type BedarfsEinsatz = {
  id: string;
  betriebId: string;
  datum: Iso;
  status: string;
  mitarbeiterId: string | null;
  objektId: string;
  /** Abschluss (letzter Check-out) bzw. Tagesende; für Werkzeugzähler */
  abschluss: string;
  umfang: Einsatzumfang & { stunden: number };
  bedarfe: Bedarf[];
};

const EINSATZ_SPALTEN = `id, betrieb_id, datum, status, mitarbeiter_id, objekt_id, sollzeit_minuten,
  objekt(bereich(flaeche_m2), fensteraufmass(anzahl), objekt_bedarf(artikel_id, menge, bezug)),
  auftragsvorlage(vorlage_bedarf(artikel_id, menge, bezug)),
  zeitbuchung(art, zeitpunkt, storniert_am)`;

type EinsatzZeile = {
  id: string;
  betrieb_id: string;
  datum: string;
  status: string;
  mitarbeiter_id: string | null;
  objekt_id: string;
  sollzeit_minuten: number;
  objekt: {
    bereich: { flaeche_m2: number | null }[];
    fensteraufmass: { anzahl: number }[];
    objekt_bedarf: { artikel_id: string; menge: number; bezug: Bedarfsbezug }[];
  } | null;
  auftragsvorlage: {
    vorlage_bedarf: { artikel_id: string; menge: number; bezug: Bedarfsbezug }[];
  } | null;
  zeitbuchung: { art: string; zeitpunkt: string; storniert_am: string | null }[];
};

const zuBedarf = (b: { artikel_id: string; menge: number; bezug: Bedarfsbezug }): Bedarf => ({
  artikelId: b.artikel_id,
  menge: Number(b.menge),
  bezug: b.bezug,
});

function zuEinsatz(e: EinsatzZeile): BedarfsEinsatz {
  const checkouts = e.zeitbuchung
    .filter((z) => z.art === "checkout" && !z.storniert_am)
    .map((z) => z.zeitpunkt)
    .sort();
  return {
    id: e.id,
    betriebId: e.betrieb_id,
    datum: e.datum,
    status: e.status,
    mitarbeiterId: e.mitarbeiter_id,
    objektId: e.objekt_id,
    abschluss: checkouts.at(-1) ?? berlinZuIso(e.datum, "23:59"),
    umfang: {
      flaecheM2: (e.objekt?.bereich ?? []).reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0),
      fenster: (e.objekt?.fensteraufmass ?? []).reduce((s, f) => s + f.anzahl, 0),
      stunden: e.sollzeit_minuten / 60,
    },
    bedarfe: bedarfFuerObjekt(
      (e.auftragsvorlage?.vorlage_bedarf ?? []).map(zuBedarf),
      (e.objekt?.objekt_bedarf ?? []).map(zuBedarf),
    ),
  };
}

/** Einsätze eines Zeitraums (oder bestimmte IDs) mit Bedarf; lädt seitenweise. */
export async function ladeBedarfsEinsaetze(
  c: Client,
  filter: {
    betriebId?: string;
    von?: Iso;
    bis?: Iso;
    ids?: string[];
    erledigt?: boolean;
    mitarbeiterId?: string;
  },
): Promise<BedarfsEinsatz[]> {
  const liste: BedarfsEinsatz[] = [];
  for (let start = 0; ; start += SEITE) {
    let q = c.from("einsatz").select(EINSATZ_SPALTEN);
    if (filter.betriebId) q = q.eq("betrieb_id", filter.betriebId);
    if (filter.von) q = q.gte("datum", filter.von);
    if (filter.bis) q = q.lte("datum", filter.bis);
    if (filter.ids) q = q.in("id", filter.ids);
    if (filter.mitarbeiterId) q = q.eq("mitarbeiter_id", filter.mitarbeiterId);
    q =
      filter.erledigt === true
        ? q.eq("status", "erledigt")
        : filter.erledigt === false
          ? q.not("status", "in", "(erledigt,abgesagt)")
          : q.neq("status", "abgesagt");
    const { data, error } = await q
      .order("datum")
      .order("id")
      .range(start, start + SEITE - 1);
    if (error) throw new Error(error.message);
    liste.push(...(data as unknown as EinsatzZeile[]).map(zuEinsatz));
    if (data.length < SEITE || filter.ids) break;
  }
  return liste;
}

/** Wie stark ein Einsatz ein Werkzeug nutzt (in der Lebensdauer-Einheit des Artikels). */
export function nutzung(e: BedarfsEinsatz, einheit: string | null): number {
  switch (einheit) {
    case "fenster":
      return e.umfang.fenster;
    case "m2":
      return e.umfang.flaecheM2;
    case "stunden":
      return e.umfang.stunden;
    default:
      return 1; // Einsätze, Wäschen, Tage
  }
}

export const nutztArtikel = (e: BedarfsEinsatz, artikelId: string) =>
  e.bedarfe.some((b) => b.artikelId === artikelId);

// ---------------------------------------------------------------------------
// Übersicht für Büro und Dashboard
// ---------------------------------------------------------------------------

export type ArtikelPrognose = {
  artikel: Artikel;
  gesamt: number;
  lager: number;
  jeOrt: { lagerortId: string; name: string; art: string; menge: number }[];
  offenBestellt: number;
  reichweite: Reichweite;
  bedarfVierWochen: number;
  vorschlag: Bestellvorschlag | null;
};

export type WerkzeugStand = {
  id: string;
  bezeichnung: string;
  artikel: Artikel;
  mitgliedId: string | null;
  fahrzeugId: string | null;
  letzterWechsel: string | null;
  verschleiss: Verschleissstand | null;
  faelligAm: Iso | null;
  pruefung: Pruefstatus;
  lebensdauerVorschlag: number | null;
};

export type Inventar = {
  heute: Iso;
  lagerorte: Tables<"lagerort">[];
  artikel: ArtikelPrognose[];
  werkzeuge: WerkzeugStand[];
};

/** Bestände, Reichweiten, Einkaufsliste und Werkzeugstände eines Betriebs. */
export async function ladeInventar(c: Client, betriebId: string, heute: Iso): Promise<Inventar> {
  const bis = plusTage(heute, BESTELL_TAGE - 1);
  const [artikel, lagerorte, bestaende, bestellungen, werkzeuge, fahrzeuge, plan] =
    await Promise.all([
      c
        .from("artikel")
        .select(ARTIKEL_SPALTEN)
        .eq("betrieb_id", betriebId)
        .eq("aktiv", true)
        .order("name"),
      c
        .from("lagerort")
        .select("*")
        .eq("betrieb_id", betriebId)
        .order("standard", { ascending: false })
        .order("art")
        .order("name"),
      c.from("bestand").select("lagerort_id, artikel_id, menge").eq("betrieb_id", betriebId),
      c
        .from("bestellung")
        .select("artikel_id, menge")
        .eq("betrieb_id", betriebId)
        .eq("status", "offen"),
      c
        .from("werkzeug")
        .select(
          "id, artikel_id, bezeichnung, mitglied_id, fahrzeug_id, startstand, letzter_wechsel_am, naechste_pruefung, erstellt_am, werkzeug_wechsel(stand, grund)",
        )
        .eq("betrieb_id", betriebId)
        .eq("aktiv", true)
        .order("bezeichnung"),
      c.from("fahrzeug").select("id, mitglied_id").eq("betrieb_id", betriebId),
      ladeBedarfsEinsaetze(c, { betriebId, von: heute, bis, erledigt: false }),
    ]);
  for (const r of [artikel, lagerorte, bestaende, bestellungen, werkzeuge, fahrzeuge]) {
    if (r.error) throw new Error(r.error.message);
  }
  const orte = new Map((lagerorte.data ?? []).map((l) => [l.id, l]));

  // Verbrauch nach Plan je Artikel und Tag
  const verbrauch = new Map<string, Map<Iso, number>>();
  for (const e of plan) {
    for (const [artikelId, menge] of bedarfJeEinsatz(e.bedarfe, e.umfang)) {
      const tage = verbrauch.get(artikelId) ?? new Map<Iso, number>();
      tage.set(e.datum, (tage.get(e.datum) ?? 0) + menge);
      verbrauch.set(artikelId, tage);
    }
  }
  const tageListe = (artikelId: string): Verbrauchstag[] =>
    [...(verbrauch.get(artikelId) ?? new Map<Iso, number>())].map(([datum, menge]) => ({
      datum,
      menge,
    }));

  // Werkzeugzähler: erledigte Einsätze seit dem frühesten Zählbeginn
  const fahrer = new Map((fahrzeuge.data ?? []).map((f) => [f.id, f.mitglied_id]));
  const besitzer = (w: { mitglied_id: string | null; fahrzeug_id: string | null }) =>
    w.mitglied_id ?? (w.fahrzeug_id ? (fahrer.get(w.fahrzeug_id) ?? null) : null);
  const artikelNachId = new Map((artikel.data ?? []).map((a) => [a.id, a]));
  const mitZaehler = (werkzeuge.data ?? []).filter(
    (w) => artikelNachId.get(w.artikel_id)?.art === "verschleiss",
  );
  const ab = mitZaehler.map((w) => (w.letzter_wechsel_am ?? w.erstellt_am).slice(0, 10)).sort()[0];
  const erledigt =
    mitZaehler.length > 0 && ab
      ? await ladeBedarfsEinsaetze(c, {
          betriebId,
          von: plusTage(ab, -1),
          bis: heute,
          erledigt: true,
        })
      : [];

  const werkzeugStaende: WerkzeugStand[] = [];
  const wechselBedarf = new Map<string, number>();
  for (const w of werkzeuge.data ?? []) {
    const a = artikelNachId.get(w.artikel_id);
    if (!a) continue;
    const wer = besitzer(w);
    let verschleiss: Verschleissstand | null = null;
    let faelligAm: Iso | null = null;
    if (a.art === "verschleiss" && a.lebensdauer) {
      const eigene = (liste: BedarfsEinsatz[]) =>
        liste.filter((e) => (wer === null || e.mitarbeiterId === wer) && nutztArtikel(e, a.id));
      const gezaehlt = zaehlerSeit(
        w.letzter_wechsel_am ?? w.erstellt_am,
        eigene(erledigt).map((e) => ({
          am: e.abschluss,
          menge: nutzung(e, a.lebensdauer_einheit),
        })),
      );
      const stand = (w.letzter_wechsel_am ? 0 : Number(w.startstand)) + gezaehlt;
      verschleiss = verschleissStand(stand, Number(a.lebensdauer));
      const geplant = eigene(plan).map((e) => ({
        datum: e.datum,
        menge: nutzung(e, a.lebensdauer_einheit),
      }));
      faelligAm = wechselFaelligAm(stand, Number(a.lebensdauer), geplant);
      const naechste = geplant.reduce((s, g) => s + g.menge, 0);
      wechselBedarf.set(
        a.id,
        (wechselBedarf.get(a.id) ?? 0) + erwarteteWechsel(stand, Number(a.lebensdauer), naechste),
      );
    }
    werkzeugStaende.push({
      id: w.id,
      bezeichnung: w.bezeichnung,
      artikel: a,
      mitgliedId: w.mitglied_id,
      fahrzeugId: w.fahrzeug_id,
      letzterWechsel: w.letzter_wechsel_am,
      verschleiss,
      faelligAm,
      pruefung: pruefstatus(w.naechste_pruefung, heute),
      lebensdauerVorschlag:
        a.lebensdauer && a.art === "verschleiss"
          ? lebensdauerVorschlag(
              w.werkzeug_wechsel.map((x) => ({
                stand: Number(x.stand),
                grund: x.grund as "verschleiss" | "defekt" | "auto",
              })),
              Number(a.lebensdauer),
            )
          : null,
    });
  }

  const offen = new Map<string, number>();
  for (const b of bestellungen.data ?? [])
    offen.set(b.artikel_id, (offen.get(b.artikel_id) ?? 0) + Number(b.menge));

  const prognosen: ArtikelPrognose[] = (artikel.data ?? []).map((a) => {
    const jeOrt = (bestaende.data ?? [])
      .filter((b) => b.artikel_id === a.id && orte.has(b.lagerort_id))
      .map((b) => {
        const o = orte.get(b.lagerort_id)!;
        return { lagerortId: o.id, name: o.name, art: o.art, menge: Number(b.menge) };
      });
    const gesamt = jeOrt.reduce((s, o) => s + o.menge, 0);
    const lager = jeOrt.filter((o) => o.art === "lager").reduce((s, o) => s + o.menge, 0);
    const tage = tageListe(a.id);
    const r = reichweite(gesamt, a.art === "verbrauch" ? tage : [], heute, BESTELL_TAGE);
    const bedarfVierWochen =
      a.art === "verbrauch"
        ? Math.round(tage.reduce((s, t) => s + t.menge, 0) * 1000) / 1000
        : a.art === "verschleiss"
          ? (wechselBedarf.get(a.id) ?? 0)
          : 0;
    const vorschlag =
      a.art === "geraet" && Number(a.mindestbestand) === 0
        ? null
        : bestellvorschlag({
            lagerBestand: lager,
            mindestbestand: Number(a.mindestbestand),
            gebindeMenge: Number(a.gebinde_menge),
            lieferzeitTage: a.lieferzeit_tage,
            bedarfVierWochen,
            reichweiteTage: a.art === "verbrauch" ? r.tage : null,
            offenBestellt: offen.get(a.id) ?? 0,
          });
    return {
      artikel: a,
      gesamt: Math.round(gesamt * 10_000) / 10_000,
      lager: Math.round(lager * 10_000) / 10_000,
      jeOrt,
      offenBestellt: offen.get(a.id) ?? 0,
      reichweite: r,
      bedarfVierWochen,
      vorschlag,
    };
  });

  return { heute, lagerorte: lagerorte.data ?? [], artikel: prognosen, werkzeuge: werkzeugStaende };
}

// ---------------------------------------------------------------------------
// Abbuchung beim Abschluss eines Einsatzes
// ---------------------------------------------------------------------------

/**
 * Bucht den Sollverbrauch erledigter Einsätze ab (nur Verbrauchsmaterial; Verschleiß zählt über
 * die Werkzeuge). Ort: Fahrzeug der Tour → Standardfahrzeug → Putzkammer → Zentrallager.
 * Wiederholungen sind harmlos (eine Abbuchung je Einsatz und Artikel).
 */
export async function materialAbbuchen(admin: Client, einsatzIds: string[]): Promise<number> {
  if (einsatzIds.length === 0) return 0;
  const einsaetze = (await ladeBedarfsEinsaetze(admin, { ids: einsatzIds, erledigt: true })).filter(
    (e) => e.bedarfe.length > 0,
  );
  const { data: gebucht } = await admin
    .from("einsatz")
    .select("id")
    .in("id", einsatzIds)
    .not("material_gebucht_am", "is", null);
  const schon = new Set((gebucht ?? []).map((e) => e.id));
  let anzahl = 0;
  for (const e of einsaetze) {
    if (schon.has(e.id)) continue;
    const [artikel, orte, tour, standard] = await Promise.all([
      admin.from("artikel").select("id, art").eq("betrieb_id", e.betriebId),
      admin
        .from("lagerort")
        .select("id, art, standard, fahrzeug_id, objekt_id")
        .eq("betrieb_id", e.betriebId)
        .eq("aktiv", true),
      e.mitarbeiterId
        ? admin
            .from("tour")
            .select("fahrzeug_id")
            .eq("mitarbeiter_id", e.mitarbeiterId)
            .eq("datum", e.datum)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      e.mitarbeiterId
        ? admin
            .from("fahrzeug")
            .select("id")
            .eq("mitglied_id", e.mitarbeiterId)
            .eq("aktiv", true)
            .limit(1)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    const l = orte.data ?? [];
    const ortVonFahrzeug = (id: string | null | undefined) =>
      id ? (l.find((o) => o.fahrzeug_id === id)?.id ?? null) : null;
    const ort = abbuchungsort({
      tourFahrzeugOrt: ortVonFahrzeug(tour.data?.fahrzeug_id),
      standardFahrzeugOrt: ortVonFahrzeug(standard.data?.[0]?.id),
      objektOrt: l.find((o) => o.objekt_id === e.objektId)?.id ?? null,
      zentrallager: l.find((o) => o.standard)?.id ?? null,
    });
    if (!ort) continue;
    const verbrauch = new Set(
      (artikel.data ?? []).filter((a) => a.art === "verbrauch").map((a) => a.id),
    );
    for (const [artikelId, menge] of bedarfJeEinsatz(e.bedarfe, e.umfang)) {
      if (!verbrauch.has(artikelId)) continue;
      const { error } = await admin.from("lagerbewegung").insert({
        betrieb_id: e.betriebId,
        artikel_id: artikelId,
        art: "abgang_einsatz",
        menge,
        von_lagerort_id: ort,
        einsatz_id: e.id,
        erstellt_von: null,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
      if (!error) anzahl++;
    }
    await admin
      .from("einsatz")
      .update({ material_gebucht_am: new Date().toISOString() })
      .eq("id", e.id);
  }
  return anzahl;
}

/**
 * Nächtlicher Lauf: verpasste Abbuchungen der letzten 14 Tage nachholen und für Kleinteile mit
 * „Auto-Wechsel“ bei erreichter Lebensdauer einen Wechsel annehmen und ein Teil abbuchen.
 */
export async function inventarLauf(admin: Client, heute: Iso) {
  const { data: offen } = await admin
    .from("einsatz")
    .select("id")
    .eq("status", "erledigt")
    .is("material_gebucht_am", null)
    .gte("datum", plusTage(heute, -14))
    .lte("datum", heute)
    .limit(1000);
  const ids = (offen ?? []).map((e) => e.id);
  let abbuchungen = 0;
  for (let i = 0; i < ids.length; i += 50)
    abbuchungen += await materialAbbuchen(admin, ids.slice(i, i + 50));

  const { data: auto } = await admin
    .from("werkzeug")
    .select("betrieb_id, artikel!inner(auto_wechsel)")
    .eq("aktiv", true)
    .eq("artikel.auto_wechsel", true);
  let autoWechsel = 0;
  for (const betriebId of new Set((auto ?? []).map((w) => w.betrieb_id))) {
    const inv = await ladeInventar(admin, betriebId, heute);
    const zentrallager = inv.lagerorte.find((l) => l.standard)?.id;
    for (const w of inv.werkzeuge) {
      if (!w.artikel.auto_wechsel || !w.verschleiss || w.verschleiss.anteil < 1) continue;
      await admin.from("werkzeug_wechsel").insert({
        betrieb_id: betriebId,
        werkzeug_id: w.id,
        am: new Date().toISOString(),
        stand: w.verschleiss.stand,
        grund: "auto",
        erstellt_von: null,
      });
      if (zentrallager) {
        await admin.from("lagerbewegung").insert({
          betrieb_id: betriebId,
          artikel_id: w.artikel.id,
          art: "wechsel",
          menge: 1,
          von_lagerort_id: zentrallager,
          notiz: `Auto-Wechsel ${w.bezeichnung}`,
          erstellt_von: null,
        });
      }
      autoWechsel++;
    }
  }
  return { abbuchungen, autoWechsel };
}

// ---------------------------------------------------------------------------
// Mitarbeiter-App: Fahrzeug, Fahrzeugbestand, eigene Werkzeuge, überfällige Prüfungen
// ---------------------------------------------------------------------------

export type AppInventar = {
  fahrzeug: { lagerortId: string; name: string } | null;
  fahrzeugBestand: Map<string, number> | undefined;
  werkzeuge: AppWerkzeug[];
  /** Artikel-ID → Namen der Geräte mit überfälliger Prüfung */
  pruefungUeberfaellig: Map<string, string[]>;
};

export async function ladeAppInventar(
  c: Client,
  ctx: { betriebId: string; mitgliedId: string },
  datum: Iso,
): Promise<AppInventar> {
  const [tour, fahrzeuge, werkzeuge] = await Promise.all([
    c
      .from("tour")
      .select("fahrzeug_id")
      .eq("mitarbeiter_id", ctx.mitgliedId)
      .eq("datum", datum)
      .maybeSingle(),
    c
      .from("fahrzeug")
      .select("id, name, mitglied_id")
      .eq("betrieb_id", ctx.betriebId)
      .eq("aktiv", true),
    c
      .from("werkzeug")
      .select(
        "id, bezeichnung, mitglied_id, fahrzeug_id, startstand, letzter_wechsel_am, naechste_pruefung, erstellt_am, artikel(id, name, art, lebensdauer, lebensdauer_einheit)",
      )
      .eq("betrieb_id", ctx.betriebId)
      .eq("aktiv", true)
      .order("bezeichnung"),
  ]);
  const fahrzeugId =
    tour.data?.fahrzeug_id ??
    fahrzeuge.data?.find((f) => f.mitglied_id === ctx.mitgliedId)?.id ??
    null;
  let fahrzeug: AppInventar["fahrzeug"] = null;
  let fahrzeugBestand: Map<string, number> | undefined;
  if (fahrzeugId) {
    const { data: ort } = await c
      .from("lagerort")
      .select("id, name")
      .eq("fahrzeug_id", fahrzeugId)
      .maybeSingle();
    if (ort) {
      fahrzeug = { lagerortId: ort.id, name: ort.name };
      const { data: b } = await c
        .from("bestand")
        .select("artikel_id, menge")
        .eq("lagerort_id", ort.id);
      fahrzeugBestand = new Map((b ?? []).map((x) => [x.artikel_id, Number(x.menge)]));
    }
  }

  const alle = werkzeuge.data ?? [];
  const eigen = (w: (typeof alle)[number]) =>
    w.mitglied_id === ctx.mitgliedId || (fahrzeugId !== null && w.fahrzeug_id === fahrzeugId);
  const pruefungUeberfaellig = new Map<string, string[]>();
  for (const w of alle) {
    const a = w.artikel;
    if (!a || pruefstatus(w.naechste_pruefung, datum).stufe !== "ueberfaellig") continue;
    // eigene Geräte zählen; hat der Mitarbeiter keins von diesem Artikel, warnen alle
    const hatEigenes = alle.some((x) => x.artikel?.id === a.id && eigen(x));
    if (hatEigenes && !eigen(w)) continue;
    pruefungUeberfaellig.set(a.id, [...(pruefungUeberfaellig.get(a.id) ?? []), w.bezeichnung]);
  }

  const meine = alle.filter(eigen);
  const mitZaehler = meine.filter((w) => w.artikel?.art === "verschleiss" && w.artikel.lebensdauer);
  const ab = mitZaehler.map((w) => (w.letzter_wechsel_am ?? w.erstellt_am).slice(0, 10)).sort()[0];
  const [erledigt, heute] = await Promise.all([
    ab
      ? ladeBedarfsEinsaetze(c, {
          betriebId: ctx.betriebId,
          von: plusTage(ab, -1),
          bis: datum,
          erledigt: true,
          mitarbeiterId: ctx.mitgliedId,
        })
      : Promise.resolve([] as BedarfsEinsatz[]),
    mitZaehler.length
      ? ladeBedarfsEinsaetze(c, {
          betriebId: ctx.betriebId,
          von: datum,
          bis: datum,
          erledigt: false,
          mitarbeiterId: ctx.mitgliedId,
        })
      : Promise.resolve([] as BedarfsEinsatz[]),
  ]);

  const liste: AppWerkzeug[] = meine.map((w) => {
    const a = w.artikel;
    const basis = {
      id: w.id,
      name: w.bezeichnung,
      artikelId: a?.id ?? "",
      einheit: a?.lebensdauer_einheit ?? null,
      pruefung: pruefstatus(w.naechste_pruefung, datum).stufe,
      pruefungAm: w.naechste_pruefung,
    };
    if (!a || a.art !== "verschleiss" || !a.lebensdauer) {
      return { ...basis, stand: null, lebensdauer: null, stufe: null, faelligHeute: false };
    }
    const lebensdauer = Number(a.lebensdauer);
    const gezaehlt = zaehlerSeit(
      w.letzter_wechsel_am ?? w.erstellt_am,
      erledigt
        .filter((e) => nutztArtikel(e, a.id))
        .map((e) => ({ am: e.abschluss, menge: nutzung(e, a.lebensdauer_einheit) })),
    );
    const stand = (w.letzter_wechsel_am ? 0 : Number(w.startstand)) + gezaehlt;
    const v = verschleissStand(stand, lebensdauer);
    const heuteMenge = heute
      .filter((e) => nutztArtikel(e, a.id))
      .reduce((s, e) => s + nutzung(e, a.lebensdauer_einheit), 0);
    return {
      ...basis,
      stand: v.stand,
      lebensdauer,
      stufe: v.stufe,
      faelligHeute: stand + heuteMenge >= lebensdauer,
    };
  });

  return { fahrzeug, fahrzeugBestand, werkzeuge: liste, pruefungUeberfaellig };
}

// ---------------------------------------------------------------------------
// Ist-Korrektur: „leer“ gemeldet, obwohl laut Buch noch etwas im Fahrzeug sein müsste
// ---------------------------------------------------------------------------

export type IstVorschlag = {
  meldungId: string;
  gemeldetAm: string;
  artikel: { id: string; name: string; einheit: string };
  lagerortId: string;
  lagerortName: string;
  mitarbeiter: string | null;
  korrektur: Istkorrektur;
  /** Objekte der Einsätze seit dem letzten Laden (dort wird der Ist-Wert übernommen) */
  objekte: { id: string; name: string }[];
  einsatzIds: string[];
};

export async function ladeIstKorrekturen(
  c: Client,
  betriebId: string,
  heute: Iso,
): Promise<IstVorschlag[]> {
  const { data: meldungen } = await c
    .from("einsatz_meldung")
    .select(
      "id, erstellt_am, artikel_id, artikel(id, name, einheit, art), einsatz(datum, mitarbeiter_id, mitglied(anzeigename))",
    )
    .eq("betrieb_id", betriebId)
    .eq("art", "material_leer")
    .is("erledigt_am", null)
    .gte("erstellt_am", `${plusTage(heute, -60)}T00:00:00Z`)
    .order("erstellt_am", { ascending: false })
    .limit(50);
  const [{ data: orte }, { data: fahrzeuge }] = await Promise.all([
    c
      .from("lagerort")
      .select("id, name, fahrzeug_id")
      .eq("betrieb_id", betriebId)
      .eq("art", "fahrzeug"),
    c.from("fahrzeug").select("id, mitglied_id").eq("betrieb_id", betriebId).eq("aktiv", true),
  ]);
  const ergebnis: IstVorschlag[] = [];
  for (const m of meldungen ?? []) {
    const a = m.artikel;
    const e = m.einsatz;
    if (!a || a.art !== "verbrauch" || !e?.mitarbeiter_id) continue;
    const { data: tour } = await c
      .from("tour")
      .select("fahrzeug_id")
      .eq("mitarbeiter_id", e.mitarbeiter_id)
      .eq("datum", e.datum)
      .maybeSingle();
    const fahrzeugId =
      tour?.fahrzeug_id ?? fahrzeuge?.find((f) => f.mitglied_id === e.mitarbeiter_id)?.id;
    const ort = orte?.find((o) => o.fahrzeug_id === fahrzeugId);
    if (!ort) continue;
    const { data: bewegungen } = await c
      .from("lagerbewegung")
      .select(
        "art, menge, von_lagerort_id, nach_lagerort_id, einsatz_id, erstellt_am, einsatz(objekt_id, objekt(name))",
      )
      .eq("artikel_id", a.id)
      .or(`von_lagerort_id.eq.${ort.id},nach_lagerort_id.eq.${ort.id}`)
      .lte("erstellt_am", m.erstellt_am)
      .order("erstellt_am");
    let bestandLauf = 0;
    let nachLaden = 0;
    let abgaenge: NonNullable<typeof bewegungen> = [];
    for (const b of bewegungen ?? []) {
      const rein = b.nach_lagerort_id === ort.id;
      bestandLauf += rein ? Number(b.menge) : -Number(b.menge);
      if (rein && b.art !== "korrektur") {
        nachLaden = bestandLauf;
        abgaenge = [];
      } else if (b.art === "abgang_einsatz") {
        abgaenge.push(b);
      }
    }
    if (abgaenge.length === 0) continue;
    const soll = abgaenge.reduce((s, b) => s + Number(b.menge), 0) / abgaenge.length;
    const k = istKorrektur({
      bestandNachLaden: nachLaden,
      einsaetzeSeitLaden: abgaenge.length,
      sollJeEinsatz: Math.round(soll * 10_000) / 10_000,
      buchbestand: bestandLauf,
    });
    if (!k) continue;
    const objekte = new Map<string, string>();
    for (const b of abgaenge) {
      if (b.einsatz?.objekt_id) objekte.set(b.einsatz.objekt_id, b.einsatz.objekt?.name ?? "");
    }
    ergebnis.push({
      meldungId: m.id,
      gemeldetAm: m.erstellt_am,
      artikel: { id: a.id, name: a.name, einheit: a.einheit },
      lagerortId: ort.id,
      lagerortName: ort.name,
      mitarbeiter: e.mitglied?.anzeigename ?? null,
      korrektur: k,
      objekte: [...objekte].map(([id, name]) => ({ id, name })),
      einsatzIds: abgaenge.map((b) => b.einsatz_id).filter((x): x is string => !!x),
    });
  }
  return ergebnis;
}
