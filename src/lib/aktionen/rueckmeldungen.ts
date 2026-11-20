"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { berlinZuIso } from "@/domain/zeiterfassung";
import { type AktionErgebnis, dbFehler, fehler, pruefe } from "@/lib/aktion";
import { bueroKontext } from "@/lib/auth";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import {
  positionPruefenSchema,
  zeitKorrekturSchema,
  zeitNachtragSchema,
  zeitStornoSchema,
} from "@/lib/schemas/rueckmeldung";

// ---------------------------------------------------------------------------
// Vor-Ort-Leistungen
// ---------------------------------------------------------------------------

/** Freie Position bepreisen (Preisliste oder Betrag) oder ablehnen. */
export async function positionPruefen(
  eingabe: z.input<typeof positionPruefenSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(positionPruefenSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = p.daten;
  const jetzt = new Date().toISOString();
  let aenderung: TablesUpdate<"einsatz_position"> = {
    status: "abgelehnt",
    geprueft_von: k.user.id,
    geprueft_am: jetzt,
    notiz_buero: d.notiz_buero,
  };
  if (d.entscheidung === "bestaetigen") {
    if (d.preis_id) {
      const { data: preis } = await k.supabase
        .from("preisliste")
        .select("id, name, einheit, preis_cent, ust_satz")
        .eq("id", d.preis_id)
        .single();
      if (!preis) return fehler("Leistung nicht gefunden.");
      aenderung = {
        ...aenderung,
        status: "bestaetigt",
        preis_id: preis.id,
        einheit: preis.einheit,
        preis_cent: d.preis_cent ?? preis.preis_cent,
        ust_satz: preis.ust_satz,
      };
    } else {
      aenderung = { ...aenderung, status: "bestaetigt", preis_cent: d.preis_cent, ust_satz: 19 };
    }
  }
  const { error } = await k.supabase
    .from("einsatz_position")
    .update(aenderung)
    .eq("id", d.id)
    .eq("status", "vorgeschlagen");
  if (error) return fehler(dbFehler(error));
  revalidatePath("/rueckmeldungen");
  return {
    ok: true,
    meldung: d.entscheidung === "bestaetigen" ? "Leistung bestätigt." : "Leistung abgelehnt.",
  };
}

/** „Dauerhaft“-Leistung wurde in eine neue Vertragsversion übernommen. */
export async function positionUebernommen(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("einsatz_position")
    .update({ vertrag_uebernommen_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/rueckmeldungen");
  return { ok: true, meldung: "Als übernommen markiert." };
}

export async function meldungErledigt(id: string): Promise<AktionErgebnis> {
  const k = await bueroKontext();
  const { error } = await k.supabase
    .from("einsatz_meldung")
    .update({ erledigt_am: new Date().toISOString(), erledigt_von: k.user.id })
    .eq("id", id);
  if (error) return fehler(dbFehler(error));
  revalidatePath("/rueckmeldungen");
  return { ok: true, meldung: "Erledigt." };
}

// ---------------------------------------------------------------------------
// Zeiten (nur Büro, immer mit Grund; Protokoll entsteht in der Datenbank)
// ---------------------------------------------------------------------------
const neuLadenZeiten = () => revalidatePath("/zeiten");

export async function zeitKorrigieren(
  eingabe: z.input<typeof zeitKorrekturSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(zeitKorrekturSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase.rpc("zeitbuchung_korrigieren", {
    p_id: p.daten.id,
    p_zeitpunkt: berlinZuIso(p.daten.datum, p.daten.uhrzeit),
    p_grund: p.daten.grund,
  });
  if (error) return fehler(dbFehler(error));
  neuLadenZeiten();
  return { ok: true, meldung: "Zeit korrigiert." };
}

export async function zeitStornieren(
  eingabe: z.input<typeof zeitStornoSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(zeitStornoSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const { error } = await k.supabase.rpc("zeitbuchung_stornieren", {
    p_id: p.daten.id,
    p_grund: p.daten.grund,
  });
  if (error) return fehler(dbFehler(error));
  neuLadenZeiten();
  return { ok: true, meldung: "Buchung storniert." };
}

export async function zeitNachtragen(
  eingabe: z.input<typeof zeitNachtragSchema>,
): Promise<AktionErgebnis> {
  const p = pruefe(zeitNachtragSchema, eingabe);
  if (!p.ok) return p.ergebnis;
  const k = await bueroKontext();
  const d = p.daten;
  if ((d.art === "checkin" || d.art === "checkout") && !d.einsatz_id) {
    return { ok: false, fehler: "Einsatz wählen.", feldfehler: { einsatz_id: ["Einsatz wählen"] } };
  }
  const { error } = await k.supabase.rpc("zeitbuchung_nachtragen", {
    p_mitglied_id: d.mitglied_id,
    p_art: d.art,
    p_zeitpunkt: berlinZuIso(d.datum, d.uhrzeit),
    p_grund: d.grund,
    p_einsatz_id: d.einsatz_id ?? undefined,
  });
  if (error) return fehler(dbFehler(error));
  // Ein nachgetragener Check-in/-out zieht den Einsatzstatus nach (wie in der App).
  if (d.einsatz_id) {
    await k.supabase
      .from("einsatz")
      .update({ status: d.art === "checkout" ? "erledigt" : "begonnen" })
      .eq("id", d.einsatz_id)
      .in(
        "status",
        d.art === "checkout"
          ? ["zugewiesen", "begonnen", "unterwegs"]
          : ["geplant", "zugewiesen", "unterwegs"],
      );
  }
  neuLadenZeiten();
  return { ok: true, meldung: "Buchung nachgetragen." };
}
