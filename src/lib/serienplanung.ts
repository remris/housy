import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Iso, heuteIso, plusTage } from "@/domain/datum";
import { type Bundesland, feiertageImZeitraum } from "@/domain/feiertage";
import {
  type IstEinsatz,
  type Leistung,
  type SollEinsatz,
  type Vertragsplan,
  gleicheAb,
  planeVertrag,
} from "@/domain/serien";
import { sollzeit } from "@/domain/vorlagen";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export const HORIZONT_WOCHEN = 8;

/** Uhrzeit aus Postgres "07:00:00" → "07:00" */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Lädt einen Vertrag und baut den Plan für die Fachlogik. */
export async function ladeVertragsplan(supabase: Client, vertragId: string) {
  const { data: v, error } = await supabase
    .from("vertrag")
    .select(
      `id, betrieb_id, objekt_id, status, beginn, endet_am,
       betrieb(bundesland),
       objekt(bereich(flaeche_m2), fensteraufmass(anzahl)),
       vertragsversion(id, gueltig_ab, vertragsleistung(
         id, vorlage_id, frequenz, intervall, wochentage, monatstag, startdatum,
         zeitfenster_von, zeitfenster_bis, erlaubte_wochentage, feiertag_regel, menge_m2, menge_fenster,
         auftragsvorlage(sollzeit_minuten, minuten_pro_100m2, minuten_pro_fenster)))`,
    )
    .eq("id", vertragId)
    .single();
  if (error || !v) throw new Error(`Vertrag ${vertragId} nicht gefunden: ${error?.message}`);

  const flaeche = (v.objekt?.bereich ?? []).reduce((s, b) => s + Number(b.flaeche_m2 ?? 0), 0);
  const fenster = (v.objekt?.fensteraufmass ?? []).reduce((s, f) => s + f.anzahl, 0);

  const plan: Vertragsplan = {
    beginn: v.beginn,
    ende: v.endet_am,
    versionen: v.vertragsversion.map((ver) => ({
      id: ver.id,
      gueltigAb: ver.gueltig_ab,
      leistungen: ver.vertragsleistung.map((l): Leistung => {
        const vorlage = l.auftragsvorlage;
        const umfang = {
          flaecheM2: l.menge_m2 === null ? flaeche : Number(l.menge_m2),
          fenster: l.menge_fenster ?? fenster,
        };
        return {
          id: l.id,
          vorlageId: l.vorlage_id,
          wiederholung: {
            frequenz: l.frequenz,
            intervall: l.intervall,
            wochentage: l.wochentage,
            monatstag: l.monatstag,
            anker: l.startdatum ?? ver.gueltig_ab,
          },
          feiertagRegel: l.feiertag_regel,
          zeitfensterVon: hhmm(l.zeitfenster_von),
          zeitfensterBis: hhmm(l.zeitfenster_bis),
          erlaubteWochentage: l.erlaubte_wochentage,
          sollzeitMinuten: vorlage
            ? sollzeit(
                {
                  sollzeitMinuten: vorlage.sollzeit_minuten,
                  minutenPro100m2:
                    vorlage.minuten_pro_100m2 === null ? null : Number(vorlage.minuten_pro_100m2),
                  minutenProFenster:
                    vorlage.minuten_pro_fenster === null
                      ? null
                      : Number(vorlage.minuten_pro_fenster),
                },
                umfang,
              )
            : 60,
        };
      }),
    })),
  };

  return {
    vertrag: v,
    plan,
    bundesland: (v.betrieb?.bundesland ?? "BW") as Bundesland,
  };
}

/** Soll-Einsätze für eine Vorschau (ohne zu speichern). */
export async function vorschau(supabase: Client, vertragId: string, von: Iso, bis: Iso) {
  const { plan, bundesland } = await ladeVertragsplan(supabase, vertragId);
  return planeVertrag(
    plan,
    von,
    bis,
    feiertageImZeitraum(plusTage(von, -14), plusTage(bis, 14), bundesland),
  );
}

export type PlanungsErgebnis = { angelegt: number; geaendert: number; geloescht: number };

/**
 * Plant die Einsätze eines Vertrags ab Stichtag für den Horizont neu.
 * Entwürfe und beendete Verträge haben keine künftigen Serien-Einsätze.
 */
export async function planeEinsaetze(
  supabase: Client,
  vertragId: string,
  stichtag: Iso = heuteIso(),
): Promise<PlanungsErgebnis> {
  const { vertrag, plan, bundesland } = await ladeVertragsplan(supabase, vertragId);
  const bis = plusTage(stichtag, HORIZONT_WOCHEN * 7 - 1);
  const aktiv = vertrag.status === "aktiv" || vertrag.status === "gekuendigt";
  const soll: SollEinsatz[] = aktiv
    ? planeVertrag(
        plan,
        stichtag,
        bis,
        feiertageImZeitraum(plusTage(stichtag, -14), plusTage(bis, 14), bundesland),
      )
    : [];

  const { data: vorhandene, error } = await supabase
    .from("einsatz")
    .select(
      "id, datum, serien_datum, vorlage_id, vertragsleistung_id, status, zeitfenster_von, zeitfenster_bis, sollzeit_minuten",
    )
    .eq("vertrag_id", vertragId)
    .eq("quelle", "serie")
    .gte("serien_datum", stichtag);
  if (error) throw new Error(error.message);

  const ist: IstEinsatz[] = (vorhandene ?? []).map((e) => ({
    id: e.id,
    datum: e.datum,
    serienDatum: e.serien_datum,
    vorlageId: e.vorlage_id,
    leistungId: e.vertragsleistung_id,
    status: e.status,
    zeitfensterVon: hhmm(e.zeitfenster_von),
    zeitfensterBis: hhmm(e.zeitfenster_bis),
    sollzeitMinuten: e.sollzeit_minuten,
  }));
  const abgleich = gleicheAb(soll, ist, stichtag);

  if (abgleich.loeschen.length) {
    const { error: e } = await supabase.from("einsatz").delete().in("id", abgleich.loeschen);
    if (e) throw new Error(e.message);
  }
  for (const { id, soll: s } of abgleich.aktualisieren) {
    const { error: e } = await supabase
      .from("einsatz")
      .update({
        vertragsleistung_id: s.leistungId,
        zeitfenster_von: s.zeitfensterVon,
        zeitfenster_bis: s.zeitfensterBis,
        sollzeit_minuten: s.sollzeitMinuten,
        verschoben_von: s.verschobenVon,
      })
      .eq("id", id);
    if (e) throw new Error(e.message);
  }
  if (abgleich.anlegen.length) {
    const { error: e } = await supabase.from("einsatz").insert(
      abgleich.anlegen.map((s) => ({
        betrieb_id: vertrag.betrieb_id,
        objekt_id: vertrag.objekt_id,
        vorlage_id: s.vorlageId,
        vertrag_id: vertrag.id,
        vertragsleistung_id: s.leistungId,
        datum: s.datum,
        serien_datum: s.datum,
        zeitfenster_von: s.zeitfensterVon,
        zeitfenster_bis: s.zeitfensterBis,
        sollzeit_minuten: s.sollzeitMinuten,
        verschoben_von: s.verschobenVon,
        quelle: "serie" as const,
      })),
    );
    if (e) throw new Error(e.message);
  }
  return {
    angelegt: abgleich.anlegen.length,
    geaendert: abgleich.aktualisieren.length,
    geloescht: abgleich.loeschen.length,
  };
}
