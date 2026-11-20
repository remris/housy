import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Iso, plusTage } from "@/domain/datum";
import {
  type Koordinate,
  type PlanEinsatz,
  type PlanMitarbeiter,
  type Tour,
  type TourStopp,
  findeKonflikte,
  optimiereReihenfolge,
  tourFuer,
  zuMinuten,
} from "@/domain/planung";
import { fahrzeiten } from "@/lib/karten/mapbox";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export const koordinate = (
  x: {
    breitengrad: number | null;
    laengengrad: number | null;
  } | null,
): Koordinate | null =>
  x && x.breitengrad !== null && x.laengengrad !== null
    ? { lat: Number(x.breitengrad), lng: Number(x.laengengrad) }
    : null;

export const mitgliedName = (m: { anzeigename: string | null; rolle?: string }) =>
  m.anzeigename?.trim() || "Ohne Namen";

/** Einsätze einer Tagestour in aktueller Reihenfolge (abgesagte nicht). */
export async function ladeTourEinsaetze(
  supabase: Client,
  betriebId: string,
  mitarbeiterId: string,
  datum: Iso,
) {
  const { data, error } = await supabase
    .from("einsatz")
    .select(
      `id, datum, status, reihenfolge, zeitfenster_von, zeitfenster_bis, sollzeit_minuten,
       fahrzeit_minuten, geplanter_beginn, notiz,
       objekt(id, name, strasse, plz, ort, breitengrad, laengengrad, zugangshinweise),
       auftragsvorlage(name)`,
    )
    .eq("betrieb_id", betriebId)
    .eq("mitarbeiter_id", mitarbeiterId)
    .eq("datum", datum)
    .neq("status", "abgesagt")
    .order("reihenfolge", { ascending: true, nullsFirst: false })
    .order("zeitfenster_von", { ascending: true, nullsFirst: false })
    .order("erstellt_am");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type TourModus = "behalten" | "optimieren" | string[];

/**
 * Berechnet die Tagestour eines Mitarbeiters (Fahrzeiten, Ankunft, Beginn) und speichert
 * Reihenfolge und Zeiten an den Einsätzen sowie die Tour selbst.
 */
export async function berechneUndSpeichereTour(
  supabase: Client,
  betriebId: string,
  mitarbeiterId: string,
  datum: Iso,
  modus: TourModus = "behalten",
): Promise<{ tour: Tour | null; quelle: "mapbox" | "schaetzung" | null }> {
  const [{ data: betrieb }, { data: vorhandene }, einsaetze] = await Promise.all([
    supabase
      .from("betrieb")
      .select("breitengrad, laengengrad, tour_start")
      .eq("id", betriebId)
      .single(),
    supabase
      .from("tour")
      .select("id, startzeit")
      .eq("mitarbeiter_id", mitarbeiterId)
      .eq("datum", datum)
      .maybeSingle(),
    ladeTourEinsaetze(supabase, betriebId, mitarbeiterId, datum),
  ]);

  if (!einsaetze.length) {
    if (vorhandene) await supabase.from("tour").delete().eq("id", vorhandene.id);
    return { tour: null, quelle: null };
  }

  const start = hhmm(vorhandene?.startzeit ?? betrieb?.tour_start ?? "07:00")!;
  const stopps: TourStopp[] = einsaetze.map((e) => ({
    id: e.id,
    sollzeitMinuten: e.sollzeit_minuten,
    zeitfensterVon: hhmm(e.zeitfenster_von),
    zeitfensterBis: hhmm(e.zeitfenster_bis),
  }));
  const { matrix, quelle } = await fahrzeiten([
    koordinate(betrieb ?? null),
    ...einsaetze.map((e) => koordinate(e.objekt)),
  ]);

  let reihenfolge = stopps.map((_, i) => i);
  if (modus === "optimieren") {
    reihenfolge = optimiereReihenfolge(start, stopps, matrix);
  } else if (Array.isArray(modus)) {
    const pos = new Map(modus.map((id, i) => [id, i]));
    reihenfolge.sort(
      (a, b) =>
        (pos.get(stopps[a]!.id) ?? Infinity) - (pos.get(stopps[b]!.id) ?? Infinity) || a - b,
    );
  }

  const tour = tourFuer(start, stopps, matrix, reihenfolge);
  for (const [k, z] of tour.stopps.entries()) {
    const { error } = await supabase
      .from("einsatz")
      .update({ reihenfolge: k, fahrzeit_minuten: z.fahrzeitMinuten, geplanter_beginn: z.beginn })
      .eq("id", z.id);
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from("tour").upsert(
    {
      betrieb_id: betriebId,
      mitarbeiter_id: mitarbeiterId,
      datum,
      startzeit: start,
      rueckfahrt_minuten: tour.rueckfahrtMinuten,
      // über Mitternacht hinaus nicht als Uhrzeit speicherbar
      rueckkehr: zuMinuten(tour.rueckkehr) < 24 * 60 ? tour.rueckkehr : "23:59",
      fahrzeit_quelle: quelle,
      berechnet_am: new Date().toISOString(),
    },
    { onConflict: "mitarbeiter_id,datum" },
  );
  if (error) throw new Error(error.message);
  return { tour, quelle };
}

/** Lädt alles für den Wochenplan und prüft Konflikte. */
export async function ladeWoche(supabase: Client, betriebId: string, montag: Iso) {
  const sonntag = plusTage(montag, 6);
  const [mitglieder, einsaetze, zeiten, abwesenheiten, touren] = await Promise.all([
    supabase
      .from("mitglied")
      .select("id, anzeigename, rolle")
      .eq("betrieb_id", betriebId)
      .eq("aktiv", true)
      .order("anzeigename"),
    supabase
      .from("einsatz")
      .select(
        `id, datum, status, mitarbeiter_id, zeitfenster_von, zeitfenster_bis, sollzeit_minuten,
         fahrzeit_minuten, geplanter_beginn, reihenfolge, serien_datum,
         objekt(name, ort), auftragsvorlage(name)`,
      )
      .eq("betrieb_id", betriebId)
      .gte("datum", montag)
      .lte("datum", sonntag)
      .neq("status", "abgesagt")
      .order("reihenfolge", { ascending: true, nullsFirst: false })
      .order("zeitfenster_von", { ascending: true, nullsFirst: false }),
    supabase
      .from("mitarbeiter_verfuegbarkeit")
      .select("mitglied_id, wochentag, von, bis")
      .eq("betrieb_id", betriebId),
    supabase
      .from("abwesenheit")
      .select("mitglied_id, art, von, bis")
      .eq("betrieb_id", betriebId)
      .lte("von", sonntag)
      .gte("bis", montag),
    supabase
      .from("tour")
      .select("mitarbeiter_id, datum, rueckkehr, fahrzeit_quelle")
      .eq("betrieb_id", betriebId)
      .gte("datum", montag)
      .lte("datum", sonntag),
  ]);
  for (const r of [mitglieder, einsaetze, zeiten, abwesenheiten, touren]) {
    if (r.error) throw new Error(r.error.message);
  }

  const mitarbeiter: PlanMitarbeiter[] = (mitglieder.data ?? []).map((m) => ({
    id: m.id,
    name: mitgliedName(m),
    arbeitszeiten: (zeiten.data ?? [])
      .filter((z) => z.mitglied_id === m.id)
      .map((z) => ({ wochentag: z.wochentag, von: hhmm(z.von)!, bis: hhmm(z.bis)! })),
    abwesenheiten: (abwesenheiten.data ?? [])
      .filter((a) => a.mitglied_id === m.id)
      .map((a) => ({ von: a.von, bis: a.bis, art: a.art })),
  }));

  const liste = einsaetze.data ?? [];
  const bezeichnung = (e: (typeof liste)[number]) =>
    `${e.objekt?.name ?? "Objekt"} (${e.auftragsvorlage?.name ?? "Einsatz"})`;
  const planEinsaetze: PlanEinsatz[] = liste
    .filter((e) => e.status !== "erledigt")
    .map((e) => ({
      id: e.id,
      datum: e.datum,
      mitarbeiterId: e.mitarbeiter_id,
      sollzeitMinuten: e.sollzeit_minuten,
      zeitfensterVon: hhmm(e.zeitfenster_von),
      zeitfensterBis: hhmm(e.zeitfenster_bis),
      geplanterBeginn: hhmm(e.geplanter_beginn),
      fahrzeitMinuten: e.fahrzeit_minuten,
      bezeichnung: bezeichnung(e),
    }));
  const konflikte = findeKonflikte(planEinsaetze, mitarbeiter);

  return {
    montag,
    sonntag,
    mitarbeiter,
    einsaetze: liste,
    planEinsaetze,
    konflikte,
    touren: touren.data ?? [],
  };
}
