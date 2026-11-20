import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type Iso, plusTage } from "@/domain/datum";
import {
  MAX_VERSUCHE,
  einsatzNachweisFaellig,
  faelligerMonat,
  monatsZeitraum,
} from "@/domain/nachweis";
import { materialAbbuchen } from "@/lib/inventar";
import type { Database } from "@/lib/supabase/database.types";
import { bestaetigungenSenden } from "./bestaetigung";
import { nachweisErstellen } from "./erstellen";

type Admin = SupabaseClient<Database>;

/** So weit zurück holt der Nachlauf verpasste Einsatznachweise nach. */
const NACHLAUF_TAGE = 14;

/**
 * Nach dem Auschecken (aus der App angestoßen): Nachweise für erledigte Einsätze von Kunden mit
 * Versand je Einsatz und Bestätigungen für mündlich vereinbarte Leistungen.
 */
export async function nachEinsaetzen(admin: Admin, einsatzIds: string[]) {
  if (einsatzIds.length === 0) return { nachweise: 0, bestaetigungen: 0, abbuchungen: 0 };
  // Material zuerst abbuchen (unabhängig vom Nachweis-Versand)
  const abbuchungen = await materialAbbuchen(admin, einsatzIds).catch((e: Error) => {
    console.error("Abbuchung fehlgeschlagen", e);
    return 0;
  });
  const { data } = await admin
    .from("einsatz")
    .select("id, betrieb_id, status, objekt(kunde(nachweis_versand))")
    .in("id", einsatzIds);
  let nachweise = 0;
  for (const e of data ?? []) {
    const versand = e.objekt?.kunde?.nachweis_versand ?? "keiner";
    if (!einsatzNachweisFaellig({ status: e.status, versand })) continue;
    const r = await nachweisErstellen(
      admin,
      e.betrieb_id,
      { art: "einsatz", einsatzId: e.id },
      { senden: true },
    );
    if (!r.uebersprungen) nachweise++;
  }
  const b = await bestaetigungenSenden(admin, { einsatzIds });
  return { nachweise, bestaetigungen: b.gesendet, abbuchungen };
}

export type LaufErgebnis = {
  einsatznachweise: number;
  monatsnachweise: number;
  wiederholt: number;
  bestaetigungen: number;
  fehler: string[];
};

/**
 * Täglicher Nachlauf: holt verpasste Einsatznachweise nach (z. B. Auschecken ohne Netz),
 * erzeugt am Monatsanfang die Monatsnachweise des Vormonats, wiederholt fehlgeschlagene
 * Versuche und verschickt offene Bestätigungen.
 */
export async function nachweisLauf(admin: Admin, heute: Iso): Promise<LaufErgebnis> {
  const erg: LaufErgebnis = {
    einsatznachweise: 0,
    monatsnachweise: 0,
    wiederholt: 0,
    bestaetigungen: 0,
    fehler: [],
  };
  const merke = (r: { status: string; fehler: string | null; id: string }) => {
    if (r.status === "fehler") erg.fehler.push(`${r.id}: ${r.fehler}`);
  };

  // 1. Einsatznachweise ohne Nachweis
  const { data: offen, error } = await admin
    .from("einsatz")
    .select("id, betrieb_id, status, objekt(kunde(nachweis_versand)), nachweis(id)")
    .eq("status", "erledigt")
    .gte("datum", plusTage(heute, -NACHLAUF_TAGE))
    .lte("datum", heute)
    .limit(1000);
  if (error) erg.fehler.push(error.message);
  for (const e of offen ?? []) {
    if (e.nachweis.length > 0) continue;
    const versand = e.objekt?.kunde?.nachweis_versand ?? "keiner";
    if (!einsatzNachweisFaellig({ status: e.status, versand })) continue;
    const r = await nachweisErstellen(
      admin,
      e.betrieb_id,
      { art: "einsatz", einsatzId: e.id },
      { senden: true },
    );
    merke(r);
    if (!r.uebersprungen) erg.einsatznachweise++;
  }

  // 2. Monatsnachweise für den Vormonat
  const monat = faelligerMonat(heute);
  const { von, bis } = monatsZeitraum(monat);
  const [{ data: imMonat }, { data: vorhandene }] = await Promise.all([
    admin
      .from("einsatz")
      .select("betrieb_id, objekt_id, objekt(kunde(nachweis_versand))")
      .eq("status", "erledigt")
      .gte("datum", von)
      .lte("datum", bis)
      .limit(10000),
    admin.from("nachweis").select("objekt_id").eq("art", "monat").eq("von", von),
  ]);
  const schonDa = new Set((vorhandene ?? []).map((n) => n.objekt_id));
  const objekte = new Map<string, string>();
  for (const e of imMonat ?? []) {
    if (e.objekt?.kunde?.nachweis_versand !== "monat" || schonDa.has(e.objekt_id)) continue;
    objekte.set(e.objekt_id, e.betrieb_id);
  }
  for (const [objektId, betriebId] of objekte) {
    const r = await nachweisErstellen(
      admin,
      betriebId,
      { art: "monat", objektId, monat },
      { senden: true },
    );
    merke(r);
    if (!r.uebersprungen) erg.monatsnachweise++;
  }

  // 3. Fehlgeschlagene erneut versuchen
  const { data: fehlerhaft } = await admin
    .from("nachweis")
    .select("id, betrieb_id, art, einsatz_id, objekt_id, von")
    .eq("status", "fehler")
    .lt("versuche", MAX_VERSUCHE)
    .limit(200);
  for (const n of fehlerhaft ?? []) {
    const auftrag =
      n.art === "einsatz" && n.einsatz_id
        ? { art: "einsatz" as const, einsatzId: n.einsatz_id }
        : { art: "monat" as const, objektId: n.objekt_id, monat: n.von.slice(0, 7) };
    const r = await nachweisErstellen(admin, n.betrieb_id, auftrag, { senden: true });
    merke(r);
    erg.wiederholt++;
  }

  // 4. Bestätigungen für mündlich vereinbarte Leistungen
  const b = await bestaetigungenSenden(admin, {
    seit: `${plusTage(heute, -NACHLAUF_TAGE)}T00:00:00Z`,
  });
  erg.bestaetigungen = b.gesendet;
  erg.fehler.push(...b.fehler);
  return erg;
}
